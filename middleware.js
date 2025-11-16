// Middleware de Next.js para proteger rutas admin
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Solo proteger rutas /admin
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // Verificar token de sesión en cookies
  const token = req.cookies.get("sb-access-token")?.value;
  // Si no hay cookie (caso común cuando Supabase guarda sesión en localStorage),
  // dejamos pasar y el cliente validará el rol dentro de la página /admin.
  if (!token) {
    return NextResponse.next();
  }

  try {
    // Verificar usuario y rol (usando anon key para validar JWT)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return NextResponse.redirect(new URL("/login?redirect=/admin", req.url));
    }

    // Consultar rol del perfil
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/?error=unauthorized", req.url));
    }

    return NextResponse.next();
  } catch (e) {
    console.error("Middleware error:", e);
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};
