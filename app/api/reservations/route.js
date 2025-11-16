// API: Crear y listar reservas
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { experienciaPorId } from "@/lib/constants";
import { calcularCupoDisponible, estaEnHorario } from "@/lib/availability";

export async function GET(req) {
  try {
    const sb = supabaseAdmin();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");
    const status = searchParams.get("status");
    const from = searchParams.get("from"); // ISO date
    const to = searchParams.get("to"); // ISO date

    // Primero obtener reservas
    let query = sb
      .from("reservations")
      .select("*")
      .order("fecha_hora", { ascending: false })
      .limit(200);

    if (userId) {
      query = query.eq("user_id", userId);
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (from) {
      query = query.gte("fecha_hora", from);
    }
    if (to) {
      query = query.lte("fecha_hora", to);
    }

    const { data: reservas, error } = await query;
    if (error) throw error;

    // Enriquecer con datos de profiles manualmente
    const userIds = [...new Set(reservas.map(r => r.user_id).filter(Boolean))];
    let profilesMap = {};
    
    if (userIds.length > 0) {
      const { data: profiles } = await sb
        .from("profiles")
        .select("id, dni, first_name, last_name, email, phone")
        .in("id", userIds);
      
      if (profiles) {
        profilesMap = Object.fromEntries(profiles.map(p => [p.id, p]));
      }
    }

    // Adjuntar perfiles a reservas
    const enriched = reservas.map(r => ({
      ...r,
      profiles: profilesMap[r.user_id] || null
    }));

    return NextResponse.json({ reservas: enriched }, { status: 200 });
  } catch (e) {
    console.error("/api/reservations GET", e);
    return NextResponse.json({ error: "Error listando reservas", details: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { user_id, experiencia, fechaISO, cantidad } = body;

    if (!user_id || !experiencia || !fechaISO || !cantidad) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const exp = experienciaPorId(experiencia);
    if (!exp) return NextResponse.json({ error: "Experiencia inválida" }, { status: 400 });

    const sb = supabaseAdmin();
    // Leer settings
    const { data: settings } = await sb.from("settings").select("*").single();
    if (!estaEnHorario(fechaISO, exp.duracionMin, settings || undefined)) {
      return NextResponse.json({ error: "Fuera de horario" }, { status: 400 });
    }

    // Verificar disponibilidad
    const desde = new Date(fechaISO); desde.setHours(0,0,0,0);
    const hasta = new Date(fechaISO); hasta.setHours(23,59,59,999);
    const { data: reservas } = await sb
      .from("reservations")
      .select("id, fecha_hora, duracion_min, cantidad, status")
      .gte("fecha_hora", desde.toISOString())
      .lte("fecha_hora", hasta.toISOString());
    const capacidad = settings?.capacidad || 6;
    const cupo = calcularCupoDisponible(reservas || [], fechaISO, exp.duracionMin, capacidad);
    if (cupo < cantidad) {
      return NextResponse.json({ error: "No hay cupos suficientes", cupo }, { status: 409 });
    }

    // Consultar promociones activas
    const { data: promos } = await sb
      .from("promotions")
      .select("*")
      .eq("active", true)
      .or('start_date.is.null,end_date.is.null')
      .or(`start_date.lte.${fechaISO},end_date.gte.${fechaISO}`);
    let descuento = 0;
    const fecha = new Date(fechaISO);
    const diaSemana = fecha.getDay(); // 0=domingo, 3=miércoles
    let promoApplied = null;
    let promoPriceOverrides = null;

    // Si viene promo_id seleccionada por el usuario, priorizar esa
    const { promo_id } = body;
    let selectedPromo = null;
    if (promo_id && Array.isArray(promos)) {
      selectedPromo = promos.find(p => String(p.id) === String(promo_id));
    }

    const candidates = selectedPromo ? [selectedPromo] : (promos || []);
    if (candidates.length) {
      for (const p of candidates) {
        const rule = p.rule || {};
        // Si la promo tiene días específicos
        if (Array.isArray(rule.days) && rule.days.length && !rule.days.includes(diaSemana)) {
          continue;
        }
        // Si tiene franja horaria específica HH:mm
        if (rule.timeStart && rule.timeEnd) {
          const hh = fecha.getHours();
          const mm = fecha.getMinutes();
          const curr = hh * 60 + mm;
          const [tsH, tsM] = rule.timeStart.split(':').map(Number);
          const [teH, teM] = rule.timeEnd.split(':').map(Number);
          const sMin = tsH * 60 + tsM;
          const eMin = teH * 60 + teM;
          if (!(curr >= sMin && curr <= eMin)) continue;
        }
        // Regla 2x1 miércoles
        if (rule.twoForOneWednesday && diaSemana === 3) {
          descuento = Math.max(descuento, 0.5);
          promoApplied = p.name || 'twoForOneWednesday';
        }
        // Regla porcentaje: { percentOff: 20, days: [1,2,3], min_quantity: 2 }
        if (rule.percentOff && (!rule.days || rule.days.includes(diaSemana))) {
          if (!rule.min_quantity || cantidad >= rule.min_quantity) {
            const pct = rule.percentOff / 100;
            if (pct > descuento) {
              descuento = pct;
              promoApplied = p.name || `percent_${rule.percentOff}`;
            }
          }
        }
        // Reglas de precio fijo por experiencia para ese día/horario
        if (rule.priceOverrides && rule.priceOverrides[exp.id] !== undefined) {
          promoPriceOverrides = Number(rule.priceOverrides[exp.id]);
          promoApplied = p.name || 'price_override';
          // Al usar price override, descartamos descuento porcentual
          descuento = 0;
        }
        // Si es una promo seleccionada, tomar la primera que aplique
        if (selectedPromo && promoApplied) break;
      }
    }

    // Precio dinámico desde settings (si existe), fallback al de constantes
    let precioUnit = (settings?.pricing && settings.pricing[exp.id]) ? Number(settings.pricing[exp.id]) : exp.precio;
    if (promoPriceOverrides !== null) {
      precioUnit = promoPriceOverrides;
    }
    let total = precioUnit * cantidad;
    if (descuento > 0) total = Math.round(total * (1 - descuento));
    const seña = Math.round(total * 0.5);

    const { data: inserted, error } = await sb
      .from("reservations")
      .insert({
        user_id,
        experiencia,
        fecha_hora: fechaISO,
        duracion_min: exp.duracionMin,
        cantidad,
        precio_total: total,
        deposito_requerido: seña,
        status: "pending",
        promo_applied: promoApplied,
      })
      .select("*")
      .single();
    if (error) throw error;

    return NextResponse.json({ reserva: inserted }, { status: 201 });
  } catch (e) {
    console.error("/api/reservations POST", e);
    return NextResponse.json({ error: "Error creando reserva" }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, action, user_id, reason } = body;
    if (!id || action !== 'cancel') {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
    }
    const sb = supabaseAdmin();
    const { data: reserva, error: errRes } = await sb
      .from('reservations')
      .select('*')
      .eq('id', id)
      .single();
    if (errRes || !reserva) throw errRes || new Error('Reserva no encontrada');
    if (reserva.status !== 'pending' && reserva.status !== 'confirmed') {
      return NextResponse.json({ error: 'Esta reserva no se puede cancelar' }, { status: 409 });
    }
    // Verificar ventana de 24h SOLO si la reserva ya está confirmada (pagada)
    if (reserva.status === 'confirmed') {
      const inicio = new Date(reserva.fecha_hora);
      const ahora = new Date();
      const horasDiff = (inicio.getTime() - ahora.getTime()) / (1000 * 60 * 60);
      if (horasDiff < 24) {
        return NextResponse.json({ error: 'Solo se puede cancelar con 24h de antelación' }, { status: 409 });
      }
    }
    const { error: errUpd } = await sb
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', id);
    if (errUpd) throw errUpd;
    if (user_id) {
      await sb.from('cancellations').insert({ reservation_id: id, user_id, reason });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('/api/reservations PATCH', e);
    return NextResponse.json({ error: 'Error cancelando reserva' }, { status: 500 });
  }
}
