"use client";
export const dynamic = "force-dynamic";
// Página de reservas: selecciona experiencia, fecha/hora, cantidad y paga seña
import { useEffect, useState, useRef } from "react";
import { z } from "zod";
import { getSupabase } from "@/lib/supabaseClient";
import { EXPERIENCIAS, HORARIOS_DEFAULT } from "@/lib/constants";
import { useToast } from "../components/ToastProvider";

function toLocalInputValue(d) {
  const pad = (n) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${y}-${m}-${day}T${h}:${min}`;
}

function toDateInputValue(d) {
  const pad = (n) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  return `${y}-${m}-${day}`;
}

function combineDateTime(dateStr, timeStr) {
  // dateStr: YYYY-MM-DD, timeStr: HH:mm
  return `${dateStr}T${timeStr}`;
}

export default function ReservasPage() {
  const toast = useToast();
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState("user");
  const [experiencia, setExperiencia] = useState(EXPERIENCIAS.GRAND_PRIX.id);
  const [fecha, setFecha] = useState(toLocalInputValue(new Date()));
  const [selectedDate, setSelectedDate] = useState(toDateInputValue(new Date()));
  const [selectedTime, setSelectedTime] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [cupo, setCupo] = useState(null);
  const [statusMsg, setStatusMsg] = useState("");
  const statusRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [promos, setPromos] = useState([]);
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [pendingReservations, setPendingReservations] = useState([]);
  const [settings, setSettings] = useState(null);
  const [slots, setSlots] = useState([]); // [{time: '16:00', iso: ..., cupo, disponible}]
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Admin: crear reserva para cliente
  const [adminClientData, setAdminClientData] = useState({ dni: "", first_name: "", last_name: "", email: "", phone: "", age: "", height_cm: "" });
  const [adminReservaLink, setAdminReservaLink] = useState("");

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener?.subscription?.unsubscribe?.();
  }, []);

  // Cargar rol del usuario
  useEffect(() => {
    async function loadRole() {
      if (!session?.user) return;
      try {
        const res = await fetch(`/api/profile?id=${session.user.id}`);
        const json = await res.json();
        if (res.ok && json.profile?.role) {
          setUserRole(json.profile.role);
        }
      } catch {}
    }
    loadRole();
  }, [session]);

  // Guardar: si el perfil está incompleto, redirigir a /cuenta (solo usuarios normales, admins pueden acceder sin completar)
  useEffect(() => {
    async function checkProfile() {
      if (!session?.user || userRole === "admin") return;
      const sb = getSupabase();
      if (!sb) return;
      const { data: profile } = await sb
        .from('profiles')
        .select('dni, first_name, last_name, phone, age, height_cm')
        .eq('id', session.user.id)
        .maybeSingle();
      const incomplete = !profile || !profile.dni || !profile.first_name || !profile.last_name || !profile.phone || !profile.age || !profile.height_cm;
      if (incomplete) {
        window.location.href = '/cuenta?complete=1';
      }
    }
    checkProfile();
  }, [session, userRole]);

  useEffect(() => {
    // Cargar promos (solo activas). El filtrado por día/horario se hace cliente/servidor.
    async function loadPromos() {
      try {
        const r = await fetch('/api/promotions');
        const j = await r.json();
        setPromos(j.promociones || []);
      } catch {}
    }
    loadPromos();
  }, []);

  // Cargar settings (horarios/capacidad)
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        const json = await res.json();
        if (res.ok) setSettings(json.settings || null);
      } catch {}
    }
    loadSettings();
  }, []);

  // Cargar reservas pendientes del usuario
  useEffect(() => {
    async function loadPending() {
      if (!session?.user) return;
      try {
        const res = await fetch(`/api/reservations?user_id=${session.user.id}&status=pending`);
        if (res.ok) {
          const { reservas } = await res.json();
          setPendingReservations(reservas || []);
        }
      } catch (e) {
        console.error('Error cargando pendientes:', e);
      }
    }
    loadPending();
  }, [session]);

  // Generar y consultar slots disponibles para la fecha/experiencia seleccionadas
  useEffect(() => {
    async function buildSlots() {
      setSlots([]);
      setSlotsLoading(true);
      try {
        const exp = Object.values(EXPERIENCIAS).find(e => e.id === experiencia);
        if (!exp || !selectedDate) { setSlotsLoading(false); return; }
        const d = new Date(selectedDate + 'T00:00');
        const weekday = d.getDay();
        const isWeekend = weekday === 0 || weekday === 6;
        let horas;
        if (settings?.horarios_by_day && (settings.horarios_by_day[String(weekday)] || settings.horarios_by_day[weekday])) {
          const cfg = settings.horarios_by_day[String(weekday)] || settings.horarios_by_day[weekday];
          if (cfg?.enabled === false) { setSlots([]); setSlotsLoading(false); return; }
          horas = { open: cfg.open || '00:00', close: cfg.close || '23:59' };
        } else {
          horas = (settings?.horarios && (isWeekend ? settings.horarios.weekend : settings.horarios.weekday)) || (isWeekend ? HORARIOS_DEFAULT.weekend : HORARIOS_DEFAULT.weekday);
        }
        const [openH, openM] = (horas.open || '00:00').split(':').map(Number);
        const [closeH, closeM] = (horas.close || '23:59').split(':').map(Number);

        // Construir lista de horarios con step = duracion de la experiencia
        const start = new Date(selectedDate + 'T00:00'); start.setHours(openH, openM, 0, 0);
        const end = new Date(selectedDate + 'T00:00'); end.setHours(closeH, closeM, 0, 0);

        const stepMin = exp.duracionMin; // Grand Prix = 60min → slots por hora
        const tmp = [];
        for (let t = new Date(start); t < end; t = new Date(t.getTime() + stepMin * 60000)) {
          const slotStart = new Date(t);
          const slotEnd = new Date(t.getTime() + stepMin * 60000);
          if (slotEnd > end) break; // garantizar que entra en el horario
          const hh = String(slotStart.getHours()).padStart(2, '0');
          const mm = String(slotStart.getMinutes()).padStart(2, '0');
          const timeStr = `${hh}:${mm}`;
          const iso = new Date(combineDateTime(selectedDate, timeStr)).toISOString();
          tmp.push({ time: timeStr, iso });
        }

        // Consultar disponibilidad para cada slot
        const results = await Promise.all(tmp.map(async (s) => {
          try {
            const r = await fetch(`/api/availability?experiencia=${experiencia}&fecha=${encodeURIComponent(s.iso)}`);
            const j = await r.json();
            if (!r.ok || j.error) return { ...s, disponible: false, cupo: 0 };
            return { ...s, disponible: !!j.disponible, cupo: j.cupo, capacidad: j.capacidad };
          } catch {
            return { ...s, disponible: false, cupo: 0 };
          }
        }));
        setSlots(results);
      } finally {
        setSlotsLoading(false);
      }
    }
    buildSlots();
  }, [experiencia, selectedDate, settings]);

  async function consultarCupo() {
    setCupo(null);
    const fechaISO = new Date(fecha).toISOString();
    const res = await fetch(`/api/availability?experiencia=${experiencia}&fecha=${encodeURIComponent(fechaISO)}`);
    const json = await res.json();
    if (json.error) setStatusMsg(json.error);
    else setCupo(json);
  }

  async function reservar() {
    setStatusMsg("");
    if (!session?.user) return setStatusMsg("Debes iniciar sesión para reservar.");
    // Validaciones con zod
    const schema = z.object({
      experiencia: z.string().min(1),
      fechaISO: z.string().datetime(),
      cantidad: z.number().min(1).max(12),
    });
    const fechaISO = new Date(fecha).toISOString();
    const parse = schema.safeParse({ experiencia, fechaISO, cantidad: Number(cantidad) });
    if (!parse.success) {
      setStatusMsg(parse.error.errors.map(e=>e.message).join(', '));
      return;
    }
    setLoading(true);
    try {
      const reservaRes = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: session.user.id,
          experiencia,
          fechaISO,
          cantidad: Number(cantidad),
          promo_id: selectedPromo || undefined,
        }),
      });
      const reservaJson = await reservaRes.json();
      if (!reservaRes.ok) throw new Error(reservaJson.error || "No se pudo crear la reserva");

      const prefRes = await fetch("/api/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reserva_id: reservaJson.reserva.id }),
      });
      const prefJson = await prefRes.json();
      if (!prefRes.ok) throw new Error(prefJson.error || "No se pudo crear el pago");

      // Redirigir a MP (Checkout Pro): priorizar init_point
      window.location.href = prefJson.init_point || prefJson.sandbox_init_point;
    } catch (e) {
      setStatusMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  const expObj = Object.values(EXPERIENCIAS).find((e) => e.id === experiencia);
  const precioUnitBase = (settings?.pricing && settings.pricing[expObj?.id]) ? Number(settings.pricing[expObj.id]) : (expObj?.precio || 0);
  let totalBase = precioUnitBase * Number(cantidad);
  // Preview de promos aplicables: siempre por día; por horario solo si hay hora seleccionada
  const diaSemana = new Date(selectedDate + 'T12:00').getDay();
  function aplicaPromo(p) {
    const rule = p.rule || {};
    if (Array.isArray(rule.days) && rule.days.length && !rule.days.includes(diaSemana)) return false;
    if (rule.timeStart && rule.timeEnd && selectedTime) {
      const [hh, mm] = selectedTime.split(':').map(Number);
      const curr = hh*60+mm;
      const [sH,sM] = rule.timeStart.split(':').map(Number);
      const [eH,eM] = rule.timeEnd.split(':').map(Number);
      const sMin = sH*60+sM, eMin = eH*60+eM;
      if (!(curr>=sMin && curr<=eMin)) return false;
    }
    return true;
  }
  const promosAplicables = promos.filter(aplicaPromo);
  let descuento = 0; let tagPromo = null; let precioOverride = null;
  const chosen = selectedPromo ? promosAplicables.find(p => String(p.id) === String(selectedPromo)) : null;
  const list = chosen ? [chosen] : promosAplicables;
  for (const p of list) {
    const rule = p.rule || {};
    if (rule.priceOverrides && rule.priceOverrides[expObj?.id] !== undefined) {
      precioOverride = Number(rule.priceOverrides[expObj.id]); tagPromo = p.name; descuento = 0; break;
    }
    if (rule.twoForOneWednesday && diaSemana === 3) { descuento = Math.max(descuento, 0.5); tagPromo = p.name; }
    if (rule.percentOff && (!rule.days || rule.days.includes(diaSemana))) {
      if (!rule.min_quantity || Number(cantidad) >= rule.min_quantity) {
        const pct = rule.percentOff / 100; if (pct > descuento) { descuento = pct; tagPromo = p.name; }
      }
    }
  }
  const precioUnit = precioOverride ?? precioUnitBase;
  totalBase = precioUnit * Number(cantidad);
  const total = Math.round(totalBase * (1 - descuento));
  const sena = Math.round(total * 0.5);

  async function pagarReserva(reservaId) {
    try {
      setLoading(true);
      const prefRes = await fetch("/api/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reserva_id: reservaId }),
      });
      const prefJson = await prefRes.json();
      if (!prefRes.ok) throw new Error(prefJson.error || "No se pudo crear el pago");
      const checkoutUrl = prefJson.init_point || prefJson.sandbox_init_point;
      window.location.href = checkoutUrl;
    } catch (e) {
      toast?.push(e.message || "Error al iniciar el pago", "error");
    } finally {
      setLoading(false);
    }
  }

  async function cancelarReserva(reservaId) {
    if (!confirm('¿Cancelar esta reserva pendiente?')) return;
    try {
      const res = await fetch('/api/reservations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reservaId, action: 'cancel', user_id: session.user.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo cancelar');
      setPendingReservations(prev => prev.filter(r => r.id !== reservaId));
      toast?.push('Reserva cancelada correctamente', 'success');
    } catch (e) {
      toast?.push(e.message || 'Error cancelando reserva', 'error');
    }
  }

  // Admin: crear reserva para cliente y generar link de pago
  async function crearReservaParaCliente() {
    if (userRole !== "admin") return;
    setAdminReservaLink("");
    try {
      setLoading(true);
      // Validar datos del cliente
      const schema = z.object({
        dni: z.string().min(1),
        first_name: z.string().min(1),
        last_name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(1),
        age: z.number().min(1),
        height_cm: z.number().min(1)
      });
      const clientParse = schema.safeParse({
        ...adminClientData,
        age: Number(adminClientData.age),
        height_cm: Number(adminClientData.height_cm)
      });
      if (!clientParse.success) {
        toast?.push("Completá todos los datos del cliente correctamente", "error");
        return;
      }

      // Crear perfil del cliente (o actualizar si ya existe por email)
      const profileRes = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: crypto.randomUUID(), // Se ignorará si ya existe por email
          ...clientParse.data
        })
      });
      const profileJson = await profileRes.json();
      if (!profileRes.ok) throw new Error(profileJson.error || "No se pudo crear el perfil del cliente");

      const clientUserId = profileJson.profile.id;

      // Crear reserva para el cliente
      const fechaISO = new Date(fecha).toISOString();
      const reservaRes = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: clientUserId,
          experiencia,
          fechaISO,
          cantidad: Number(cantidad),
          promo_id: selectedPromo || undefined,
        }),
      });
      const reservaJson = await reservaRes.json();
      if (!reservaRes.ok) throw new Error(reservaJson.error || "No se pudo crear la reserva");

      // Generar preferencia MP y obtener link
      const prefRes = await fetch("/api/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reserva_id: reservaJson.reserva.id }),
      });
      const prefJson = await prefRes.json();
      if (!prefRes.ok) throw new Error(prefJson.error || "No se pudo crear el pago");

      const link = prefJson.init_point || prefJson.sandbox_init_point;
      setAdminReservaLink(link);
      toast?.push("Reserva creada. Copiá el link para compartir.", "success");
      // Limpiar form
      setAdminClientData({ dni: "", first_name: "", last_name: "", email: "", phone: "", age: "", height_cm: "" });
    } catch (e) {
      toast?.push(e.message || "Error creando reserva para cliente", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      {/* Reservas pendientes de pago (solo usuarios normales) */}
      {userRole !== "admin" && pendingReservations.length > 0 && (
        <div className="card bg-yellow-500/5 border-yellow-500/20">
          <h3 className="text-lg font-bold mb-3 text-yellow-400">Reservas pendientes de pago</h3>
          <p className="text-sm text-neutral-300 mb-4">Tenés reservas sin pagar. Completá el pago en 24hs o serán canceladas automáticamente.</p>
          <div className="grid gap-3">
            {pendingReservations.map((r) => {
              const exp = Object.values(EXPERIENCIAS).find(e => e.id === r.experiencia);
              const horasRestantes = Math.max(0, 24 - Math.floor((Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60)));
              return (
                <div key={r.id} className="bg-neutral-800/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="font-semibold">{exp?.nombre} x{r.cantidad}</div>
                    <div className="text-sm text-neutral-400">{new Date(r.fecha_hora).toLocaleString()}</div>
                    <div className="text-xs text-yellow-400 mt-1">Expira en {horasRestantes}hs • Seña: ${r.deposito_requerido}</div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto flex-col sm:flex-row sm:justify-end">
                    <button className="btn btn-naranja text-sm w-full sm:w-auto" onClick={() => pagarReserva(r.id)}>Pagar ahora</button>
                    <button className="btn bg-neutral-700 hover:bg-neutral-600 text-sm w-full sm:w-auto" onClick={() => cancelarReserva(r.id)}>Cancelar</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-xl font-bold mb-4">{userRole === "admin" ? "Crear reserva para cliente" : "Nueva reserva"}</h2>
        {!session?.user && (
          <div className="mb-3 text-sm text-neutral-300">Debes <a className="underline text-[var(--naranja)]" href="/login">iniciar sesión</a> para continuar.</div>
        )}
        
        {/* Admin: Datos del cliente */}
        {userRole === "admin" && (
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 mb-4">
            <h3 className="font-semibold mb-3 text-blue-400">Datos del cliente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">DNI</label>
                <input className="bg-neutral-800 p-2 rounded w-full" value={adminClientData.dni} onChange={(e) => setAdminClientData({...adminClientData, dni: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input className="bg-neutral-800 p-2 rounded w-full" type="email" value={adminClientData.email} onChange={(e) => setAdminClientData({...adminClientData, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Nombre</label>
                <input className="bg-neutral-800 p-2 rounded w-full" value={adminClientData.first_name} onChange={(e) => setAdminClientData({...adminClientData, first_name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Apellido</label>
                <input className="bg-neutral-800 p-2 rounded w-full" value={adminClientData.last_name} onChange={(e) => setAdminClientData({...adminClientData, last_name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Teléfono</label>
                <input className="bg-neutral-800 p-2 rounded w-full" value={adminClientData.phone} onChange={(e) => setAdminClientData({...adminClientData, phone: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Edad</label>
                <input className="bg-neutral-800 p-2 rounded w-full" type="number" value={adminClientData.age} onChange={(e) => setAdminClientData({...adminClientData, age: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm mb-1">Altura (cm)</label>
                <input className="bg-neutral-800 p-2 rounded w-full" type="number" value={adminClientData.height_cm} onChange={(e) => setAdminClientData({...adminClientData, height_cm: e.target.value})} />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{/* ...existing code... */}
          <div>
            <label className="block text-sm mb-1">Experiencia</label>
            <select className="bg-neutral-800 p-2 rounded w-full" value={experiencia} onChange={(e) => setExperiencia(e.target.value)}>
              {Object.values(EXPERIENCIAS).map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Fecha</label>
            <input
              className="bg-neutral-800 p-2 rounded w-full"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedTime("");
              }}
            />
            <div className="mt-3">
              <div className="text-sm mb-2">Horarios disponibles</div>
              {slotsLoading && <div className="text-sm text-neutral-400">Cargando horarios…</div>}
              {!slotsLoading && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {slots.map((s) => {
                    const selected = selectedTime === s.time;
                    return (
                      <button
                        key={s.time}
                        type="button"
                        disabled={!s.disponible}
                        onClick={() => {
                          setSelectedTime(s.time);
                          const combined = combineDateTime(selectedDate, s.time);
                          setFecha(combined);
                          setCupo({ cupo: s.cupo, capacidad: s.capacidad });
                        }}
                        className={`px-3 py-2 rounded text-sm border transition-colors ${
                          !s.disponible
                            ? 'bg-neutral-800/50 border-neutral-700 text-neutral-500 cursor-not-allowed'
                            : selected
                              ? 'bg-[var(--naranja)] border-[var(--naranja)] text-black font-semibold'
                              : 'bg-neutral-800 border-neutral-700 hover:bg-neutral-700'
                        }`}
                        title={s.disponible ? `Cupo ${s.cupo}/${s.capacidad}` : 'Sin disponibilidad'}
                      >
                        {s.time}
                      </button>
                    );
                  })}
                </div>
              )}
              {!slotsLoading && slots.length === 0 && (
                <div className="text-sm text-neutral-400">No hay horarios configurados para este día.</div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">Cantidad de simuladores</label>
            <input className="bg-neutral-800 p-2 rounded w-full" type="number" min={1} max={6} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">Promoción</label>
            <select className="bg-neutral-800 p-2 rounded w-full" value={selectedPromo || ''} onChange={(e)=>setSelectedPromo(e.target.value || null)}>
              <option value="">(Seleccionar automáticamente)</option>
              {promos.filter(p=>{
                const rule=p.rule||{}; const dw=new Date(selectedDate+'T12:00').getDay();
                if (Array.isArray(rule.days)&&rule.days.length&&!rule.days.includes(dw)) return false;
                if (rule.timeStart&&rule.timeEnd&&selectedTime){ const [hh,mm]=selectedTime.split(':').map(Number); const cur=hh*60+mm; const [sH,sM]=rule.timeStart.split(':').map(Number); const [eH,eM]=rule.timeEnd.split(':').map(Number); const s=sH*60+sM,e=eH*60+eM; if(!(cur>=s&&cur<=e)) return false; }
                return true;
              }).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button className="btn btn-naranja" onClick={consultarCupo}>Consultar disponibilidad</button>
            {cupo && <span className="text-sm text-neutral-300">Cupo disponible: <b>{cupo.cupo}</b> / {cupo.capacidad}</span>}
          </div>
        </div>
        {tagPromo && <div className="mt-4 text-sm text-[var(--naranja)]">Aplicará promo: {tagPromo}{descuento>0?` (descuento ${(descuento*100).toFixed(0)}%)`:''}</div>}
        
        {/* Admin: Botón y link generado */}
        {userRole === "admin" && (
          <div className="mt-4">
            <button disabled={loading} className="btn btn-naranja w-full sm:w-auto mb-3" onClick={crearReservaParaCliente}>Crear reserva y generar link</button>
            
            {adminReservaLink && (
              <div className="bg-neutral-800 rounded p-3">
                <div className="text-sm text-neutral-400 mb-1">Link de pago generado:</div>
                <div className="flex gap-2 flex-col sm:flex-row">
                  <input readOnly className="bg-neutral-900 p-2 rounded flex-1 text-sm" value={adminReservaLink} />
                  <button className="btn bg-neutral-700 hover:bg-neutral-600" onClick={() => { navigator.clipboard.writeText(adminReservaLink); toast?.push("Link copiado", "success"); }}>Copiar</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resumen (solo usuarios normales) */}
      {userRole !== "admin" && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-2">Resumen</h3>
          <div className="grid gap-1 text-neutral-300">
            <div>Experiencia: <b>{expObj.nombre}</b></div>
            <div>Duración: <b>{expObj.duracionMin} min</b></div>
            <div>Simuladores: <b>{cantidad}</b></div>
            {descuento > 0 && <div className="text-xs text-[var(--naranja)]">Descuento aplicado {(descuento*100).toFixed(0)}% (Antes ${totalBase.toLocaleString('es-AR')})</div>}
            <div>Total a pagar: <b>${total.toLocaleString("es-AR")}</b></div>
            <div>Seña (50%): <b>${sena.toLocaleString("es-AR")}</b></div>
          </div>
          <div className="mt-4">
            <button disabled={loading || !session?.user} className="btn btn-rojo w-full sm:w-auto" onClick={reservar}>Pagar seña y confirmar</button>
            {statusMsg && <p ref={statusRef} role="alert" aria-live="assertive" className="mt-2 text-sm text-neutral-300">{statusMsg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
