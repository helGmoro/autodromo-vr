// API: Promociones (2x1 miércoles u otras)
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET(req) {
  const sb = supabaseAdmin();
  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "true";
  let query = sb.from("promotions").select("*").order("id", { ascending: false });
  if (!all) {
    // Modo público: solo activas (el filtrado por día/hora se realiza en el cliente/servidor al calcular precios)
    query = query.eq("active", true);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ promociones: data || [] }, { status: 200 });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const sb = supabaseAdmin();
    const { data, error } = await sb.from("promotions").insert(body).select("*").single();
    if (error) throw error;
    return NextResponse.json({ promocion: data }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Error creando promoción" }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, ...updates } = body || {};
    if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("promotions")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ promocion: data }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: "Error actualizando promoción" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
    const sb = supabaseAdmin();
    await sb.from("promotions").delete().eq("id", id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: "Error eliminando promoción" }, { status: 500 });
  }
}
