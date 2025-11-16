// API: Crear/actualizar perfil de usuario tras registro/login
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
    const sb = supabaseAdmin();
    const { data, error } = await sb.from("profiles").select("*").eq("id", id).single();
    if (error) {
      console.error('Error obteniendo perfil:', error);
      return NextResponse.json({ error: `Error obteniendo perfil: ${error.message}` }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Perfil no encontrado o inactivo" }, { status: 404 });
    }
    return NextResponse.json({ profile: data }, { status: 200 });
  } catch (e) {
    console.error('Error en GET profile:', e);
    return NextResponse.json({ error: `Error obteniendo perfil: ${e.message}` }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { id, dni, first_name, last_name, email, phone, age, height_cm, role, active } = body;
    if (!id || !email) return NextResponse.json({ error: "Datos insuficientes (id y email requeridos)" }, { status: 400 });
    const sb = supabaseAdmin();
    
    // Fetch existing profile to merge data instead of overwriting
    const { data: existing } = await sb.from("profiles").select("*").eq("id", id).single();
    
    // Merge: only update fields that are explicitly provided (not undefined)
    const merged = {
      id,
      email,
      dni: dni !== undefined ? dni : (existing?.dni || ""),
      first_name: first_name !== undefined ? first_name : existing?.first_name,
      last_name: last_name !== undefined ? last_name : existing?.last_name,
      phone: phone !== undefined ? phone : existing?.phone,
      age: age !== undefined ? age : existing?.age,
      height_cm: height_cm !== undefined ? height_cm : existing?.height_cm,
      role: role !== undefined ? role : (existing?.role || "user"),
      active: active !== undefined ? active : (existing?.active !== undefined ? existing.active : true)
    };
    
    const { data, error } = await sb
      .from("profiles")
      .upsert(merged)
      .select("*")
      .single();
    if (error) {
      console.error('Error en POST profile:', error);
      throw error;
    }
    return NextResponse.json({ profile: data }, { status: 200 });
  } catch (e) {
    console.error('Error guardando perfil:', e);
    return NextResponse.json({ error: `Error guardando perfil: ${e.message}` }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, active } = body;
    if (!id || active === undefined) return NextResponse.json({ error: 'Datos insuficientes' }, { status: 400 });
    const sb = supabaseAdmin();
    const { error } = await sb.from('profiles').update({ active }).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: 'Error actualizando perfil' }, { status: 500 });
  }
}
