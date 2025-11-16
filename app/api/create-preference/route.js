// API: Crear preferencia de pago en Mercado Pago (seña 50%)
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { experienciaPorId } from "@/lib/constants";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function POST(req) {
  try {
    const body = await req.json();
    const { reserva_id } = body;
    if (!reserva_id) return NextResponse.json({ error: "Falta reserva_id" }, { status: 400 });

    const sb = supabaseAdmin();
    const { data: reserva, error } = await sb
      .from("reservations")
      .select("*")
      .eq("id", reserva_id)
      .single();
    if (error || !reserva) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });

    const exp = experienciaPorId(reserva.experiencia);
    if (!exp) return NextResponse.json({ error: "Experiencia inválida" }, { status: 400 });

    const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    if (!MP_ACCESS_TOKEN) return NextResponse.json({ error: "MP_ACCESS_TOKEN no configurado" }, { status: 500 });

    // Import v2 del SDK de Mercado Pago
    const { MercadoPagoConfig, Preference } = await import('mercadopago');
    const mpClient = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });
    const preferenceClient = new Preference(mpClient);

    // Normalizar y validar base URL
    const rawBase = (process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"));
    const baseUrl = String(rawBase).trim().replace(/\/$/, "");
    if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
      return NextResponse.json({ error: "NEXT_PUBLIC_BASE_URL inválida o no configurada" }, { status: 500 });
    }
    const notificationUrl = `${baseUrl}/api/webhook`;

    const preference = {
      items: [
        {
          title: `${exp.nombre} x${reserva.cantidad}`,
          quantity: 1,
          currency_id: "ARS",
          unit_price: reserva.deposito_requerido,
        },
      ],
      external_reference: String(reserva.id),
      back_urls: {
        success: `${baseUrl}/reservas?status=success&reserva=${reserva.id}`,
        failure: `${baseUrl}/reservas?status=failure&reserva=${reserva.id}`,
        pending: `${baseUrl}/reservas?status=pending&reserva=${reserva.id}`,
      },
      notification_url: notificationUrl,
    };

    // Nota: Mercado Pago no permite excluir 'account_money' en algunas regiones.
    // Evitamos forzar exclusiones para no romper la creación de preferencias.

    // Mercado Pago puede exigir HTTPS para auto_return; activarlo solo si es https
    if (baseUrl.startsWith('https://')) {
      preference.auto_return = 'approved';
    } else {
      console.warn('[MP] auto_return omitido en entorno no HTTPS:', baseUrl);
    }

    const result = await preferenceClient.create({ body: preference });
    return NextResponse.json({ init_point: result.init_point, sandbox_init_point: result.sandbox_init_point }, { status: 200 });
  } catch (e) {
    console.error("/api/create-preference", e);
    const msg = e?.message || e?.cause || 'Error creando preferencia';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
