// API: Cancelar automáticamente reservas pendientes de pago después de 24 horas
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req) {
  try {
    // Verificación de autorización:
    // - Permite ejecuciones desde Vercel Cron (header x-vercel-cron)
    // - O desde clientes que envíen Authorization: Bearer <CRON_SECRET>
    const isVercelCron = req.headers.get('x-vercel-cron') !== null;
    const authHeader = req.headers.get('authorization');
    const CRON_SECRET = process.env.CRON_SECRET || 'dev-secret';
    const isAuthorized = isVercelCron || authHeader === `Bearer ${CRON_SECRET}`;
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sb = supabaseAdmin();
    
    // Buscar reservas pendientes creadas hace más de 24 horas
    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: reservasPendientes, error: fetchError } = await sb
      .from('reservations')
      .select('id, user_id, experiencia, fecha_hora, created_at')
      .eq('status', 'pending')
      .lt('created_at', hace24h);

    if (fetchError) throw fetchError;

    if (!reservasPendientes || reservasPendientes.length === 0) {
      return NextResponse.json({ 
        message: 'No hay reservas pendientes para cancelar',
        cancelled: 0 
      }, { status: 200 });
    }

    // Cancelar todas las reservas encontradas
    const ids = reservasPendientes.map(r => r.id);
    const { error: updateError } = await sb
      .from('reservations')
      .update({ status: 'cancelled' })
      .in('id', ids);

    if (updateError) throw updateError;

    // Registrar en cancellations
    const cancellations = reservasPendientes.map(r => ({
      reservation_id: r.id,
      user_id: r.user_id,
      reason: 'Auto-cancelada por falta de pago (>24h)',
    }));

    await sb.from('cancellations').insert(cancellations);

    return NextResponse.json({
      message: `${ids.length} reserva(s) cancelada(s) automáticamente`,
      cancelled: ids.length,
      ids
    }, { status: 200 });

  } catch (e) {
    console.error('/api/cron-cancel-pending', e);
    return NextResponse.json({ 
      error: 'Error cancelando reservas pendientes',
      details: e.message 
    }, { status: 500 });
  }
}
