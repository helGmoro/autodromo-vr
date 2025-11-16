// API: Calcula disponibilidad para una fecha/experiencia.
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { experienciaPorId } from "@/lib/constants";
import { calcularCupoDisponible, estaEnHorario } from "@/lib/availability";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const experienciaId = searchParams.get("experiencia");
    const fechaISO = searchParams.get("fecha"); // ISO string

    if (!experienciaId || !fechaISO) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

    const exp = experienciaPorId(experienciaId);
    if (!exp) return NextResponse.json({ error: "Experiencia inválida" }, { status: 400 });

    const sb = supabaseAdmin();

    // Obtener settings (capacidad y horarios)
    const { data: settings } = await sb.from("settings").select("*").single();

    // Validar horario de apertura
    const dentroHorario = estaEnHorario(fechaISO, exp.duracionMin, settings?.horarios || undefined);
    if (!dentroHorario) {
      return NextResponse.json({ disponible: false, motivo: "Fuera de horario" }, { status: 200 });
    }

    // Buscar reservas que potencialmente solapen ese día
    const desde = new Date(fechaISO);
    desde.setHours(0,0,0,0);
    const hasta = new Date(fechaISO);
    hasta.setHours(23,59,59,999);

    const { data: reservas, error: errRes } = await sb
      .from("reservations")
      .select("id, fecha_hora, duracion_min, cantidad, status")
      .gte("fecha_hora", desde.toISOString())
      .lte("fecha_hora", hasta.toISOString());
    if (errRes) throw errRes;

    const capacidad = settings?.capacidad || 6;
    const cupo = calcularCupoDisponible(reservas || [], fechaISO, exp.duracionMin, capacidad);

    return NextResponse.json({ disponible: cupo > 0, cupo, capacidad }, { status: 200 });
  } catch (e) {
    console.error("/api/availability error", e);
    return NextResponse.json({ error: "Error consultando disponibilidad" }, { status: 500 });
  }
}
