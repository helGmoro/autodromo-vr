"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useRef } from "react";
import { z } from "zod";
import { getSupabase } from "@/lib/supabaseClient";
import { SkeletonCard } from "../components/Skeleton";
import { useToast } from "../components/ToastProvider";

export default function CuentaPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [userRole, setUserRole] = useState("user");
  const [reservas, setReservas] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [filters, setFilters] = useState({ status: "", from: "", to: "" });
  const [error, setError] = useState("");
  const [edit, setEdit] = useState(false);
  const [incomplete, setIncomplete] = useState(false);
  const [emailEdit, setEmailEdit] = useState(false);
  const [passwordEdit, setPasswordEdit] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    dni: "",
    phone: "",
    age: "",
    height_cm: "",
    email: "",
  });
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState("");
  const toast = useToast();

  useEffect(() => {
    async function load() {
      try {
        const sb = getSupabase();
        if (!sb) throw new Error("Faltan variables de entorno de Supabase");
        const { data: { session } } = await sb.auth.getSession();
        if (!session?.user) {
          window.location.href = "/login";
          return;
        }
        const uid = session.user.id;
        // Usar datos de la sesión como fuente primaria del perfil
        let profileData = { id: uid, email: session.user.email, email_confirmed_at: session.user.email_confirmed_at };
        // Intentar enriquecer con datos del backend si está disponible, pero no bloquear
        try {
          const pr = await fetch(`/api/profile?id=${uid}`);
          if (pr.ok) {
            const { profile: p } = await pr.json();
            profileData = { ...profileData, ...p };
          }
        } catch {}

        setProfile(profileData);
        setUserRole(profileData?.role || "user");
        let baseForm = {
          first_name: profileData?.first_name || "",
          last_name: profileData?.last_name || "",
          dni: profileData?.dni || "",
          phone: profileData?.phone || "",
          age: profileData?.age ?? "",
          height_cm: profileData?.height_cm ?? "",
          email: profileData?.email || "",
        };
        // Precargar con datos del registro si existen en localStorage
        try {
          const raw = localStorage.getItem('pendingProfile');
          if (raw) {
            const pending = JSON.parse(raw);
            if (pending?.email === profileData?.email || pending?.id === profileData?.id) {
              baseForm = {
                ...baseForm,
                first_name: baseForm.first_name || pending.first_name || "",
                last_name: baseForm.last_name || pending.last_name || "",
                dni: baseForm.dni || pending.dni || "",
                phone: baseForm.phone || pending.phone || "",
                age: baseForm.age || pending.age || "",
                height_cm: baseForm.height_cm || pending.height_cm || "",
              };
              setMsg('Precargamos tus datos del registro. Guardá para confirmarlos.');
            }
          }
        } catch {}
        setForm(baseForm);

        // Si faltan datos obligatorios, activar modo edición y avisar
        const inc = !baseForm.dni || !baseForm.first_name || !baseForm.last_name || !baseForm.phone || !baseForm.age || !baseForm.height_cm;
        setIncomplete(inc);
        if (inc) {
          setEdit(true);
          setMsg('Bienvenido! Por favor, completá tu perfil para poder realizar reservas.');
        }
        // Reservas del usuario inicial
        const rs = await fetch(`/api/reservations?user_id=${uid}`);
        if (rs.ok) {
          const { reservas: r } = await rs.json();
          setReservas(r || []);
        }
        // Pagos del usuario
        const pay = await fetch(`/api/payments?user_id=${uid}`);
        if (pay.ok) {
          const { pagos } = await pay.json();
          setPagos(pagos || []);
        }
      } catch (e) {
        // No bloquear la pantalla por errores de backend; mostrar con mínimos
        setError("");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Si viene con ?complete=1, forzar edición y mensaje
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('complete') === '1') {
      setEdit(true);
      setMsg('Por favor, completá tu perfil para poder realizar reservas.');
      setIncomplete(true);
    }
  }, []);

  // Actualizar estado de verificación de email sin recargar
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    // Suscribirse a cambios de auth (TOKEN_REFRESHED / USER_UPDATED)
    const { data: subscription } = sb.auth.onAuthStateChange((_event, session) => {
      const confirmed = session?.user?.email_confirmed_at;
      if (confirmed) {
        setProfile((prev) => ({ ...prev, email_confirmed_at: confirmed }));
      }
    });
    // Polling suave si aún está pendiente (cada 5s)
    let intervalId;
    if (profile && !profile.email_confirmed_at) {
      intervalId = setInterval(async () => {
        const { data } = await sb.auth.getUser();
        const confirmed = data?.user?.email_confirmed_at;
        if (confirmed) {
          setProfile((prev) => ({ ...prev, email_confirmed_at: confirmed }));
          setMsg('¡Correo verificado!');
          clearInterval(intervalId);
        }
      }, 5000);
    }
    return () => {
      subscription?.subscription?.unsubscribe?.();
      if (intervalId) clearInterval(intervalId);
    };
  }, [profile?.email_confirmed_at]);

  async function aplicarFiltros() {
    if (!profile) return;
    const params = new URLSearchParams();
    params.set('user_id', profile.id);
    if (filters.status) params.set('status', filters.status);
    if (filters.from) params.set('from', new Date(filters.from).toISOString());
    if (filters.to) params.set('to', new Date(filters.to).toISOString());
    const r = await fetch(`/api/reservations?${params.toString()}`);
    const j = await r.json();
    if (r.ok) setReservas(j.reservas || []);
  }

  function exportCSV() {
    const header = ['id','fecha','experiencia','cantidad','duracion','status','precio_total','deposito_requerido','deposito_pagado','promo_applied'];
    const rows = reservas.map(r => [r.id, r.fecha_hora, r.experiencia, r.cantidad, r.duracion_min, r.status, r.precio_total, r.deposito_requerido, r.deposito_pagado, r.promo_applied||'']);
    const csv = [header.join(','), ...rows.map(r=>r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'reservas.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  async function cancelarReserva(id) {
    try {
      const res = await fetch('/api/reservations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'cancel', user_id: profile.id }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error al cancelar');
      setReservas(prev => prev.map(r => r.id === id ? { ...r, status: 'cancelled' } : r));
      toast?.push('Reserva cancelada exitosamente', 'success');
    } catch (e) {
      toast?.push(e.message || 'Error al cancelar', 'error');
    }
  }

  async function guardarEmail() {
    setMsg('');
    try {
      const sb = getSupabase();
      if (!sb) throw new Error('Faltan envs');
      if (!newEmail) throw new Error('Ingresa nuevo email');
      const { error } = await sb.auth.updateUser({ email: newEmail });
      if (error) throw error;
      setMsg('Se envió verificación al nuevo correo.');
      setEmailEdit(false);
    } catch (e) { setMsg(e.message); }
  }

  async function guardarPassword() {
    setMsg('');
    try {
      const sb = getSupabase();
      if (!sb) throw new Error('Faltan envs');
      if (!newPassword || newPassword.length < 6) throw new Error('Min 6 caracteres');
      const { error } = await sb.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setMsg('Contraseña actualizada');
      setPasswordEdit(false);
      setNewPassword('');
    } catch (e) { setMsg(e.message); }
  }

  async function salir() {
    try {
      const sb = getSupabase();
      if (sb) await sb.auth.signOut();
    } catch (e) {
      // Ignorar errores de signOut
    } finally {
      window.location.href = '/login';
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl p-6">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto grid gap-8">
      {/* Card de Perfil */}
      <section className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-2xl p-8">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-full bg-[var(--rojo)]/10 flex items-center justify-center">
            <svg className="w-10 h-10 text-[var(--rojo)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Mi Perfil {profile?.email_confirmed_at ? <span className="text-green-400 text-sm ml-2">Verificado</span> : <span className="text-yellow-400 text-sm ml-2">Pendiente</span>}</h2>
              <button className="btn bg-neutral-800 hover:bg-neutral-700" onClick={salir}>Cerrar sesión</button>
            </div>
            {incomplete && (
              <div className="mb-5 bg-[var(--naranja)]/10 border border-[var(--naranja)]/40 text-[var(--naranja)] rounded-xl px-4 py-3 text-sm">
                <b>Faltan datos del perfil.</b> Completalos para poder realizar reservas.
              </div>
            )}
            {!edit ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="bg-neutral-800/50 rounded-xl p-4">
                    <div className="text-neutral-400">Nombre</div>
                    <div className="font-semibold">{profile?.first_name} {profile?.last_name}</div>
                  </div>
                  <div className="bg-neutral-800/50 rounded-xl p-4">
                    <div className="text-neutral-400">Email</div>
                    <div className="font-semibold">{profile?.email}</div>
                  </div>
                  <div className="bg-neutral-800/50 rounded-xl p-4">
                    <div className="text-neutral-400">DNI</div>
                    <div className="font-semibold">{profile?.dni}</div>
                  </div>
                  <div className="bg-neutral-800/50 rounded-xl p-4">
                    <div className="text-neutral-400">Teléfono</div>
                    <div className="font-semibold">{profile?.phone}</div>
                  </div>
                  <div className="bg-neutral-800/50 rounded-xl p-4">
                    <div className="text-neutral-400">Edad</div>
                    <div className="font-semibold">{profile?.age}</div>
                  </div>
                  <div className="bg-neutral-800/50 rounded-xl p-4">
                    <div className="text-neutral-400">Altura (cm)</div>
                    <div className="font-semibold">{profile?.height_cm}</div>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button className="btn bg-neutral-800 hover:bg-neutral-700" onClick={() => setEdit(true)}>Editar perfil</button>
                  <button className="btn bg-neutral-800 hover:bg-neutral-700" onClick={() => setEmailEdit(true)}>Cambiar email</button>
                  <button className="btn bg-neutral-800 hover:bg-neutral-700" onClick={() => setPasswordEdit(true)}>Cambiar contraseña</button>
                  {!profile?.email_confirmed_at && <button className="btn btn-naranja" onClick={async ()=>{
                    const sb = getSupabase(); if (!sb) return; const { error } = await sb.auth.resend({ type: 'signup', email: profile.email }); if (!error) setMsg('Reenviado correo de verificación'); else setMsg(error.message);
                  }}>Reenviar verificación</button>}
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="block text-neutral-400 mb-2">Nombre</label>
                    <input className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-3"
                      value={form.first_name}
                      onChange={(e)=>setForm({...form, first_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-400 mb-2">Apellido</label>
                    <input className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-3"
                      value={form.last_name}
                      onChange={(e)=>setForm({...form, last_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-400 mb-2">DNI</label>
                    <input className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-3"
                      value={form.dni}
                      onChange={(e)=>setForm({...form, dni: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-400 mb-2">Teléfono</label>
                    <input className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-3"
                      value={form.phone}
                      onChange={(e)=>setForm({...form, phone: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-400 mb-2">Edad</label>
                    <input type="number" className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-3"
                      value={form.age}
                      onChange={(e)=>setForm({...form, age: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-400 mb-2">Altura (cm)</label>
                    <input type="number" className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-3"
                      value={form.height_cm}
                      onChange={(e)=>setForm({...form, height_cm: e.target.value})}
                    />
                  </div>
                  <div className="sm:col-span-2 opacity-70">
                    <label className="block text-neutral-400 mb-2">Email (no editable)</label>
                    <input className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3" value={form.email} disabled />
                  </div>
                </div>
                <div className="mt-6 flex gap-3">
                  <button className="btn btn-naranja" onClick={async ()=>{
                    try {
                      const sb = getSupabase();
                      if (!sb) throw new Error('Faltan variables de entorno');
                      const payload = {
                        id: profile.id,
                        first_name: form.first_name,
                        last_name: form.last_name,
                        dni: form.dni || '',
                        phone: form.phone || '',
                        age: form.age ? Number(form.age) : null,
                        height_cm: form.height_cm ? Number(form.height_cm) : null,
                        email: form.email,
                      };
                      const { data: saved, error } = await sb
                        .from('profiles')
                        .upsert(payload)
                        .select('*')
                        .single();
                      if (error) throw error;
                      setProfile(saved);
                      // Si el perfil quedó completo, esconder el banner sin recargar
                      const isComplete = !!(saved && saved.dni && saved.first_name && saved.last_name && saved.phone && saved.age && saved.height_cm);
                      if (isComplete) setIncomplete(false);
                      try { localStorage.removeItem('pendingProfile'); } catch {}
                      setEdit(false);
                      toast?.push('Perfil actualizado correctamente', 'success');
                    } catch (e) {
                      const msg = e?.message || 'Error guardando perfil';
                      toast?.push(msg, 'error');
                    }
                  }}>Guardar</button>
                  <button className="btn bg-neutral-800 hover:bg-neutral-700" onClick={()=>{ setEdit(false); setForm({
                    first_name: profile?.first_name || '',
                    last_name: profile?.last_name || '',
                    dni: profile?.dni || '',
                    phone: profile?.phone || '',
                    age: profile?.age ?? '',
                    height_cm: profile?.height_cm ?? '',
                    email: profile?.email || '',
                  }); }}>Cancelar</button>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Historial de Reservas (oculto para admins) */}
      {userRole !== "admin" && (
        <section>
          <div className="flex items-center mb-4 gap-3">
            <h3 className="text-xl font-bold">Historial de reservas</h3>
            <button className="ml-auto btn bg-neutral-800 hover:bg-neutral-700" onClick={exportCSV}>Exportar CSV</button>
          </div>
          <div className="grid md:grid-cols-5 gap-2 mb-4 text-sm">
          <select className="bg-neutral-800 p-2 rounded" value={filters.status} onChange={(e)=>setFilters({...filters, status: e.target.value})}>
            <option value="">Todos estados</option>
            <option value="pending">Pendiente</option>
            <option value="confirmed">Confirmada</option>
            <option value="cancelled">Cancelada</option>
          </select>
          <input type="date" className="bg-neutral-800 p-2 rounded" value={filters.from} onChange={(e)=>setFilters({...filters, from: e.target.value})} />
          <input type="date" className="bg-neutral-800 p-2 rounded" value={filters.to} onChange={(e)=>setFilters({...filters, to: e.target.value})} />
          <button className="btn btn-naranja" onClick={aplicarFiltros}>Filtrar</button>
          <button className="btn bg-neutral-800 hover:bg-neutral-700" onClick={()=>{setFilters({status:'',from:'',to:''}); aplicarFiltros();}}>Limpiar</button>
        </div>
        {reservas.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 text-neutral-400">No tienes reservas aún.</div>
        ) : (
          <div className="grid gap-3">
            {reservas.map((r) => (
              <div key={r.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 grid md:grid-cols-5 gap-2 text-sm items-center">
                <div className="md:col-span-2">
                  <div className="font-semibold">{new Date(r.fecha_hora).toLocaleString()}</div>
                  <div className="text-neutral-400">{r.experiencia} • {r.cantidad} sim • {r.duracion_min}m</div>
                  {r.promo_applied && <div className="text-xs text-[var(--naranja)] mt-1">Promo: {r.promo_applied}</div>}
                </div>
                <div>
                  <div>Seña: ${r.deposito_requerido}</div>
                  <div>Total: ${r.precio_total}</div>
                  {r.status === 'confirmed' && r.precio_total > (r.deposito_pagado||r.deposito_requerido) && (
                    <div className="text-xs text-neutral-400">Saldo: ${r.precio_total - (r.deposito_pagado||r.deposito_requerido)}</div>
                  )}
                </div>
                <div>
                  <div className={`font-semibold ${r.status === 'confirmed' ? 'text-green-400' : r.status === 'pending' ? 'text-yellow-400' : 'text-neutral-400'}`}>{r.status}</div>
                  {pagos.filter(p=>p.reservation_id===r.id && p.status==='approved').map(p=> (
                    <div key={p.id} className="text-xs text-green-300 mt-1">Pago: ${p.amount}</div>
                  ))}
                </div>
                <div className="flex flex-col gap-1">
                  {r.status === 'pending' && <button className="btn bg-neutral-800 hover:bg-neutral-700" onClick={()=>cancelarReserva(r.id)}>Cancelar</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      )}
      {msg && <div className="text-sm text-center text-neutral-300" role="status" aria-live="polite">{msg}</div>}
      {emailEdit && (
        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl grid gap-3">
          <h4 className="font-semibold">Cambiar email</h4>
          <input className="bg-neutral-800 p-2 rounded" placeholder="Nuevo email" value={newEmail} onChange={(e)=>setNewEmail(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn btn-naranja" onClick={guardarEmail}>Guardar</button>
            <button className="btn bg-neutral-800" onClick={()=>{setEmailEdit(false); setNewEmail('');}}>Cerrar</button>
          </div>
        </div>
      )}
      {passwordEdit && (
        <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl grid gap-3">
          <h4 className="font-semibold">Cambiar contraseña</h4>
          <input type="password" className="bg-neutral-800 p-2 rounded" placeholder="Nueva contraseña" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn btn-naranja" onClick={guardarPassword}>Guardar</button>
            <button className="btn bg-neutral-800" onClick={()=>{setPasswordEdit(false); setNewPassword('');}}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
