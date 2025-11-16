"use client";
export const dynamic = "force-dynamic";
// Página de Login/Registro moderna con validaciones
import { useState, useEffect, useRef } from "react";
import { getSupabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [modo, setModo] = useState("login");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [session, setSession] = useState(null);
  const [showVerifyNotice, setShowVerifyNotice] = useState(false);
  const msgRef = useRef(null);

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener?.subscription?.unsubscribe?.();
  }, []);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function registrar() {
    setMsg("");
    setLoading(true);
    try {
      const sb = getSupabase();
      if (!sb) throw new Error("Faltan variables de entorno de Supabase");
      const { error } = await sb.auth.signUp({ email: form.email, password: form.password });
      if (error) throw error;
      setShowVerifyNotice(true);
      setMsg("✓ Te enviamos un correo para verificar tu cuenta. Revisa tu bandeja y confirma para ingresar.");
    } catch (e) {
      setMsg(e.message || "Error en registro");
    } finally {
      setLoading(false);
    }
  }

  async function ingresar() {
    setMsg("");
    setLoading(true);
    try {
      const sb = getSupabase();
      if (!sb) throw new Error("Faltan variables de entorno de Supabase");
      const { error, data } = await sb.auth.signInWithPassword({ email: form.email, password: form.password });
      if (error) throw error;
      // Bloquear acceso si email no verificado
      if (!data?.user?.email_confirmed_at) {
        await sb.auth.signOut();
        setShowVerifyNotice(true);
        setMsg("Tu correo no está verificado. Revisa tu email o reenvía el enlace de verificación.");
        return;
      }

      // Leer perfil si existe; si no, será null
      const { data: profile } = await sb
        .from("profiles")
        .select("dni, first_name, last_name, phone, age, height_cm, role")
        .eq("id", data.user.id)
        .maybeSingle();

      setMsg("✓ Ingreso correcto. Redirigiendo...");
      
      // Redirigir según rol
      setTimeout(() => {
        const incomplete = !profile || !profile.dni || !profile.first_name || !profile.last_name || !profile.phone || !profile.age || !profile.height_cm;
        if (incomplete) return (window.location.href = "/cuenta");
        if (profile?.role === "admin") return (window.location.href = "/admin");
        return (window.location.href = "/reservas");
      }, 1000);
    } catch (e) {
      setMsg(e.message || "Error en ingreso");
    } finally {
      setLoading(false);
    }
  }

  async function reenviarCorreo() {
    try {
      const sb = getSupabase();
      if (!sb) throw new Error("Faltan variables de entorno de Supabase");
      const { error } = await sb.auth.resend({ type: "signup", email: form.email });
      if (error) throw error;
      setMsg("✓ Enlace de verificación reenviado. Revisa tu correo.");
    } catch (e) {
      setMsg(e.message || "No se pudo reenviar el correo");
    }
  }

  // Si ya está logueado, redirigir automáticamente a cuenta
  useEffect(() => {
    if (session?.user && typeof window !== 'undefined') {
      window.location.href = '/cuenta';
    }
  }, [session]);

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-2xl p-8 shadow-2xl">
        {/* Tabs modernos */}
        <div className="flex gap-2 mb-8">
          <button 
            className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
              modo === "login" 
                ? "bg-[var(--naranja)] text-white shadow-lg shadow-orange-500/30" 
                : "bg-neutral-800 hover:bg-neutral-700 text-neutral-400"
            }`} 
            onClick={() => setModo("login")}
          >
            Ingresar
          </button>
          <button 
            className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
              modo === "registro" 
                ? "bg-[var(--rojo)] text-white shadow-lg shadow-red-500/30" 
                : "bg-neutral-800 hover:bg-neutral-700 text-neutral-400"
            }`} 
            onClick={() => setModo("registro")}
          >
            Registrarse
          </button>
        </div>

        {/* Formulario de Registro */}
        {modo === "registro" && (
          <div className="grid gap-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-2">Correo Electrónico</label>
              <input
                className="w-full bg-neutral-800 border border-neutral-700 focus:border-[var(--rojo)] p-3 rounded-xl transition-colors outline-none"
                placeholder="tu@email.com"
                type="email"
                name="email"
                value={form.email}
                onChange={onChange}
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-2">Contraseña</label>
              <input
                className="w-full bg-neutral-800 border border-neutral-700 focus:border-[var(--rojo)] p-3 rounded-xl transition-colors outline-none"
                placeholder="Mínimo 6 caracteres"
                type="password"
                name="password"
                value={form.password}
                onChange={onChange}
              />
            </div>
            <button
              disabled={loading}
              className="btn btn-rojo w-full py-3 text-lg mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={registrar}
            >
              {loading ? "Registrando..." : "Crear Cuenta"}
            </button>
          </div>
        )}

        {/* Formulario de Login */}
        {modo === "login" && (
          <div className="grid gap-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-2">Correo Electrónico</label>
              <input 
                className="w-full bg-neutral-800 border border-neutral-700 focus:border-[var(--naranja)] p-3 rounded-xl transition-colors outline-none" 
                placeholder="tu@email.com" 
                type="email"
                name="email" 
                value={form.email} 
                onChange={onChange} 
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-2">Contraseña</label>
              <input 
                className="w-full bg-neutral-800 border border-neutral-700 focus:border-[var(--naranja)] p-3 rounded-xl transition-colors outline-none" 
                placeholder="Tu contraseña" 
                type="password" 
                name="password" 
                value={form.password} 
                onChange={onChange} 
              />
            </div>
            <button 
              disabled={loading} 
              className="btn btn-naranja w-full py-3 text-lg mt-2 disabled:opacity-50 disabled:cursor-not-allowed" 
              onClick={ingresar}
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </div>
        )}

        {/* Mensaje de estado */}
        {msg && (
          <div ref={msgRef} tabIndex={-1} role="alert" aria-live="assertive" className={`mt-6 p-4 rounded-xl text-center ${
            msg.includes("✓") 
              ? "bg-green-500/10 border border-green-500/30 text-green-400" 
              : "bg-red-500/10 border border-red-500/30 text-red-400"
          }`}>
            {msg}
            {showVerifyNotice && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <button onClick={reenviarCorreo} className="btn btn-naranja">Reenviar correo</button>
                <a href="/login" className="text-neutral-400 hover:text-white underline">Ya confirmé</a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
