// Webhook de Mercado Pago para actualizar pagos de reservas
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { supabaseAdmin } from "@/lib/supabaseServer";

// Helper: obtener pago desde Mercado Pago usando SDK modular v2
async function fetchPaymentById(id) {
  const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!MP_ACCESS_TOKEN) throw new Error("MP_ACCESS_TOKEN faltante");
  const { MercadoPagoConfig, Payment } = await import("mercadopago");
  const client = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });
  const paymentClient = new Payment(client);
  const res = await paymentClient.get({ id });
  return res;
}

export async function POST(req) {
  try {
    const sb = supabaseAdmin();
    const body = await req.json();

    // Estructuras posibles de notificación
    const topic = body.topic || body.type; // 'payment'
    const dataId = body.data?.id || (body.resource ? body.resource.split("/").pop() : null);

    if (topic !== "payment" || !dataId) {
      return NextResponse.json({ ignored: true }, { status: 200 });
    }

    // Obtener detalle de pago
    let mp;
    try {
      mp = await fetchPaymentById(dataId);
    } catch (err) {
      console.error("[WEBHOOK] Error obteniendo pago", dataId, err.message);
      return NextResponse.json({ retry: true }, { status: 500 }); // Forzar retry si falla fetch
    }

    const reservaId = mp.external_reference;
    if (!reservaId) {
      console.warn("[WEBHOOK] payment sin external_reference", mp.id);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Idempotencia: ¿ya existe este mp_payment_id?
    const { data: existing } = await sb
      .from("payments")
      .select("id")
      .eq("mp_payment_id", String(mp.id))
      .limit(1);
    if (!existing || existing.length === 0) {
      const insertRes = await sb.from("payments").insert({
        reservation_id: reservaId,
        mp_payment_id: String(mp.id),
        status: mp.status,
        amount: mp.transaction_amount,
        raw: mp,
      });
      if (insertRes.error) {
        console.error("[WEBHOOK] Error insert pago", insertRes.error);
        return NextResponse.json({ retry: true }, { status: 500 });
      }
    }

    // Actualizar reserva si aprobado
    if (mp.status === "approved") {
      const upd = await sb
        .from("reservations")
        .update({ status: "confirmed", deposito_pagado: mp.transaction_amount })
        .eq("id", reservaId)
        .select("id, status")
        .single();
      if (upd.error) {
        console.error("[WEBHOOK] Error update reserva", upd.error);
        return NextResponse.json({ retry: true }, { status: 500 });
      }
    }

    return NextResponse.json({ processed: true, status: mp.status }, { status: 200 });
  } catch (e) {
    console.error("/api/webhook", e);
    // 500 para que MP reintente
    return NextResponse.json({ error: "Error webhook" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
