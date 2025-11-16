// API: Leer/actualizar settings (capacidad y horarios)
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET() {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("settings").select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data }, { status: 200 });
}

export async function PUT(req) {
  try {
    const sb = supabaseAdmin();
    const body = await req.json();
    const { capacidad, horarios, horarios_by_day, pricing } = body;
    const { data, error } = await sb
      .from("settings")
      .upsert({ id: 1, capacidad, horarios, horarios_by_day, pricing })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ settings: data }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: "Error actualizando settings" }, { status: 500 });
  }
}
