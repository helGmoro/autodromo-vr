// API: Calcula métricas de ingresos por período (semana, mes, año)
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const periodo = searchParams.get("periodo") || "mes"; // semana | mes | anio
    const extended = searchParams.get("extended") === "true";

    const sb = supabaseAdmin();
    const ahora = new Date();
    let desde;

    switch (periodo) {
      case "semana":
        desde = new Date(ahora);
        desde.setDate(ahora.getDate() - 7);
        break;
      case "mes":
        desde = new Date(ahora);
        desde.setMonth(ahora.getMonth() - 1);
        break;
      case "anio":
        desde = new Date(ahora);
        desde.setFullYear(ahora.getFullYear() - 1);
        break;
      default:
        desde = new Date(ahora);
        desde.setMonth(ahora.getMonth() - 1);
    }

    // Reservas en periodo para métricas básicas
    const { data: resPeriodo, error: errPeriodo } = await sb
      .from("reservations")
      .select("id, status, created_at, precio_total, deposito_pagado, promo_applied, fecha_hora")
      .gte("created_at", desde.toISOString());
    if (errPeriodo) throw errPeriodo;

    const confirmadas = resPeriodo.filter(r => r.status === 'confirmed');
    const totalSenias = confirmadas.reduce((acc,r)=>acc + (r.deposito_pagado||0),0);

    if (!extended) {
      return NextResponse.json({ periodo, total: totalSenias, cantidad: confirmadas.length }, { status: 200 });
    }

    // Conversion: confirmed / (pending + confirmed)
    const pendientes = resPeriodo.filter(r => r.status === 'pending');
    const conversion = (confirmadas.length) / ((pendientes.length + confirmadas.length) || 1);

    // Promo usage: promo_applied not null / total
    const conPromo = resPeriodo.filter(r => !!r.promo_applied).length;
    const promoUsage = conPromo / (resPeriodo.length || 1);

    // Potential incomes: sum precio_total confirmed vs all (pending+confirmed)
    const ingresosConfirmados = confirmadas.reduce((acc,r)=>acc + r.precio_total,0);
    const ingresosPotenciales = [...pendientes, ...confirmadas].reduce((acc,r)=>acc + r.precio_total,0);
    const gapIngresos = ingresosPotenciales - ingresosConfirmados;

    // Occupancy heatmap: count reservations by hour (0-23) last 30 days
    const heatmap = Array.from({ length:24 }, (_,h)=>({ hour:h, count:0 }));
    resPeriodo.forEach(r => {
      const d = new Date(r.fecha_hora);
      const h = d.getHours();
      if (heatmap[h]) heatmap[h].count++;
    });

    return NextResponse.json({
      periodo,
      totalSenias,
      conversion: Number(conversion.toFixed(3)),
      promoUsage: Number(promoUsage.toFixed(3)),
      ingresosConfirmados,
      ingresosPotenciales,
      gapIngresos,
      heatmap,
      cantidadConfirmadas: confirmadas.length,
      cantidadPendientes: pendientes.length,
      totalReservas: resPeriodo.length,
    }, { status: 200 });
  } catch (e) {
    console.error("/api/metrics error", e);
    return NextResponse.json({ error: "Error calculando métricas" }, { status: 500 });
  }
}
