// API: Sincronizar manualmente el estado de una reserva desde Mercado Pago
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { MercadoPagoConfig, Payment } from "mercadopago";

console.log("[PAYMENTS_SYNC] v1 static-import loaded");

function getPaymentClient() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("MP_ACCESS_TOKEN faltante");
  const client = new MercadoPagoConfig({ accessToken: token });
  return new Payment(client);
}

function getPaymentById(id) {
  const payment = getPaymentClient();
  return payment.get({ id });
}

function searchPaymentByExternalReference(external_reference) {
  const payment = getPaymentClient();
  return payment.search({ options: { external_reference } });
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const paymentId = url.searchParams.get("paymentId");
    const reservationId = url.searchParams.get("reservationId");
    if (!paymentId && !reservationId) {
      return NextResponse.json({ error: "Falta paymentId o reservationId" }, { status: 400 });
    }

    let mp;
    if (paymentId) mp = await getPaymentById(paymentId);
    else {
      const searchRes = await searchPaymentByExternalReference(reservationId);
      if (searchRes?.results?.length) mp = searchRes.results[0];
    }

    if (!mp) return NextResponse.json({ found: false }, { status: 404 });

    const reservaId = mp.external_reference;
    const sb = supabaseAdmin();

    // Upsert en payments por idempotencia
    await sb.from("payments").upsert({
      reservation_id: reservaId,
      mp_payment_id: String(mp.id),
      status: mp.status,
      amount: mp.transaction_amount,
      raw: mp,
    }, { onConflict: 'mp_payment_id' });

    if (mp.status === 'approved') {
      await sb.from("reservations")
        .update({ status: 'confirmed', deposito_pagado: mp.transaction_amount })
        .eq('id', reservaId);
    }

    return NextResponse.json({ ok: true, status: mp.status, payment_id: mp.id, reservation_id: reservaId });
  } catch (e) {
    console.error('/api/payments/sync', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}


