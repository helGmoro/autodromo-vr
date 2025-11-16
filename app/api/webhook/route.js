// Webhook de Mercado Pago para actualizar pagos de reservas
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function POST(req) {
  try {
    const sb = supabaseAdmin();
    const body = await req.json();

    // Mercado Pago puede enviar notificaciones con diferentes estructuras
    const topic = body.topic || body.type;
    const dataId = body.data?.id || body.resource?.split("/").pop();

    if (topic !== "payment" || !dataId) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Consultar detalle del pago para obtener estado y external_reference
    const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    const mercadopago = (await import("mercadopago")).default;
    mercadopago.configure({ access_token: MP_ACCESS_TOKEN });
    const payment = await mercadopago.payment.findById(dataId);
    const mp = payment.body;

    const reservaId = mp.external_reference;
    if (!reservaId) return NextResponse.json({ ok: true }, { status: 200 });

    // Guardar registro de pago
    await sb.from("payments").insert({
      reservation_id: reservaId,
      mp_payment_id: String(mp.id),
      status: mp.status,
      amount: mp.transaction_amount,
      raw: mp,
    });

    // Si aprobado, marcar seña pagada y estado confirmado
    if (mp.status === "approved") {
      await sb
        .from("reservations")
        .update({ status: "confirmed", deposito_pagado: mp.transaction_amount })
        .eq("id", reservaId);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("/api/webhook", e);
    return NextResponse.json({ error: "Error webhook" }, { status: 200 });
  }
}

export async function GET() {
  // Endpoint simple para pruebas del webhook
  return NextResponse.json({ ok: true }, { status: 200 });
}
