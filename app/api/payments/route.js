// API: Listar pagos (opcional filtro por user via reservas)
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    const sb = supabaseAdmin();
    let query = sb.from('payments').select('*, reservations:reservations(id, user_id, experiencia, fecha_hora)');
    if (userId) {
      query = query.eq('reservations.user_id', userId);
    }
    const { data, error } = await query.order('created_at', { ascending: false }).limit(500);
    if (error) throw error;
    return NextResponse.json({ pagos: data }, { status: 200 });
  } catch (e) {
    console.error('/api/payments GET', e);
    return NextResponse.json({ error: 'Error listando pagos' }, { status: 500 });
  }
}