// Layout raíz de la app
"use client";
import "./globals.css";
import { useEffect, useState } from "react";
import { ToastProvider } from "./components/ToastProvider";
import { getSupabase } from "@/lib/supabaseClient";

export default function RootLayout({ children }) {
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLogged, setIsLogged] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    async function checkUser() {
      const sb = getSupabase();
      if (!sb) {
        setLoading(false);
        return;
      }

      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) {
        setIsLogged(true);
        // Rol se cargará en un efecto separado para evitar errores si aún no existe el perfil
        setUserRole(null);
      }
      setLoading(false);
    }

    checkUser();
  }, []);

  // Cargar rol del usuario para mostrar enlace al Panel (sin modificar perfil)
  useEffect(() => {
    async function loadRole() {
      try {
        const sb = getSupabase();
        if (!sb) return;
        const { data: { session } } = await sb.auth.getSession();
        const id = session?.user?.id;
        if (!id) return;
        const res = await fetch(`/api/profile?id=${id}`);
        const json = await res.json();
        if (res.ok && json.profile?.role) {
          setUserRole(json.profile.role);
        }
      } catch (e) {
        // ignorar errores silenciosamente
      }
    }
    if (isLogged && userRole === null) {
      loadRole();
    }
  }, [isLogged, userRole]);

  return (
    <html lang="es">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <ToastProvider>
        <header className="border-b border-neutral-800">
          <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
            <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer">
              <div className="w-3 h-6 bg-[var(--rojo)]" />
              <h1 className="text-xl font-bold tracking-wider">VR Autódromo</h1>
            </a>
            <nav className="hidden md:flex gap-4 text-sm">
              <a className="hover:text-[var(--naranja)] transition-colors" href="/">Inicio</a>
              <a className="hover:text-[var(--naranja)] transition-colors" href="/reservas">Reservar</a>
              {!isLogged && (
                <a className="hover:text-[var(--naranja)] transition-colors" href="/login">Ingresar</a>
              )}
              {!loading && isLogged && (
                <a className="hover:text-[var(--naranja)] transition-colors" href="/cuenta">Mi cuenta</a>
              )}
              {!loading && userRole === "admin" && (
                <a className="hover:text-[var(--naranja)] transition-colors font-semibold" href="/admin">Panel</a>
              )}
            </nav>
            <button
              type="button"
              className="md:hidden inline-flex flex-col items-center justify-center gap-1 h-10 w-10 rounded border border-neutral-700 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-[var(--naranja)]"
              aria-label="Menú"
              aria-expanded={mobileOpen ? 'true' : 'false'}
              onClick={() => setMobileOpen(v => !v)}
            >
              <span className="sr-only">Abrir menú</span>
              <span aria-hidden className="block w-6 h-[2px] bg-current"></span>
              <span aria-hidden className="block w-6 h-[2px] bg-current"></span>
              <span aria-hidden className="block w-6 h-[2px] bg-current"></span>
            </button>
          </div>
          {mobileOpen && (
            <div className="md:hidden border-t border-neutral-800 bg-neutral-950/80 backdrop-blur">
              <div className="mx-auto max-w-5xl px-4 py-3 flex flex-col gap-3 text-sm">
                <a className="hover:text-[var(--naranja)] transition-colors" href="/" onClick={() => setMobileOpen(false)}>Inicio</a>
                <a className="hover:text-[var(--naranja)] transition-colors" href="/reservas" onClick={() => setMobileOpen(false)}>Reservar</a>
                {!isLogged && (
                  <a className="hover:text-[var(--naranja)] transition-colors" href="/login" onClick={() => setMobileOpen(false)}>Ingresar</a>
                )}
                {!loading && isLogged && (
                  <a className="hover:text-[var(--naranja)] transition-colors" href="/cuenta" onClick={() => setMobileOpen(false)}>Mi cuenta</a>
                )}
                {!loading && userRole === "admin" && (
                  <a className="hover:text-[var(--naranja)] transition-colors font-semibold" href="/admin" onClick={() => setMobileOpen(false)}>Panel</a>
                )}
              </div>
            </div>
          )}
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mt-20 border-top border-neutral-800">
          <div className="mx-auto max-w-5xl px-4 py-8 grid gap-6 md:grid-cols-3 text-sm">
            <div>
              <div className="font-semibold mb-2">VR Autódromo</div>
              <div className="text-neutral-400">Av. Ejemplo 1234, Ciudad, Provincia</div>
              <div className="text-neutral-400">Horario: Lun-Vie 16:00-22:00 • Sáb-Dom 14:00-20:00</div>
            </div>
            <div>
              <div className="font-semibold mb-2">Redes</div>
              <div className="flex gap-3 text-neutral-300">
                <a href="#" className="hover:text-[var(--naranja)]">Instagram</a>
                <a href="#" className="hover:text-[var(--naranja)]">Facebook</a>
                <a href="#" className="hover:text-[var(--naranja)]">TikTok</a>
              </div>
            </div>
            <div>
              <div className="font-semibold mb-2">Soporte</div>
              <div className="text-neutral-300">Correo: soporte@vrautodromo.com</div>
              <a href="https://wa.me/5491122334455" target="_blank" rel="noopener" className="inline-block mt-2 btn btn-naranja">WhatsApp</a>
            </div>
          </div>
          <div className="mx-auto max-w-5xl px-4 py-4 text-xs text-neutral-500 border-t border-neutral-800">
            © {new Date().getFullYear()} VR Autódromo — Velocidad y precisión.
          </div>
        </footer>
        </ToastProvider>
      </body>
    </html>
  );
}
