"use client";
export const dynamic = "force-dynamic";
// Panel Admin: reservas, métricas, settings, promociones y carga manual
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";
import { EXPERIENCIAS } from "@/lib/constants";

function formatARMoney(n) { return new Intl.NumberFormat('es-AR').format(n); }
const AR_TZ = 'America/Argentina/Buenos_Aires';
const fmtARDateTime = (d) => new Intl.DateTimeFormat('es-AR', { timeZone: AR_TZ, dateStyle: 'short', timeStyle: 'short' }).format(new Date(d));

export default function AdminPage() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [tab, setTab] = useState("reservas");
  const [reservas, setReservas] = useState([]);
  const [stats, setStats] = useState({ semana: 0, mes: 0, anio: 0 });
  const [settings, setSettings] = useState({
    capacidad: 6,
    horarios: { weekday: { open: "16:00", close: "22:00" }, weekend: { open: "14:00", close: "20:00" } },
    horarios_by_day: {
      0: { enabled: true, open: "14:00", close: "20:00" },
      1: { enabled: true, open: "16:00", close: "22:00" },
      2: { enabled: true, open: "16:00", close: "22:00" },
      3: { enabled: true, open: "16:00", close: "22:00" },
      4: { enabled: true, open: "16:00", close: "22:00" },
      5: { enabled: true, open: "16:00", close: "22:00" },
      6: { enabled: true, open: "14:00", close: "20:00" },
    },
    pricing: {
      GRAND_PRIX: 15000,
      MINI_GRAND_PRIX: 10000,
      QUICK_RACE: 8000,
    }
  });
  const [promos, setPromos] = useState([]);
  const [extendedMetrics, setExtendedMetrics] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Carga de sesión y rol de perfil
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      const user = data.session?.user;
      if (user) {
        try {
          const res = await fetch(`/api/profile?id=${user.id}`);
          const json = await res.json();
          if (res.ok && json.profile?.role) {
            setRole(json.profile.role);
          } else {
            setProfileError(json.error || 'No se pudo cargar el perfil');
            setRole('user');
          }
        } catch (e) {
          setProfileError('Error de red al cargar perfil');
          setRole('user');
        }
      }
    });
  }, []);

  useEffect(() => {
    if (role !== "admin") return;
    listarReservas();
    cargarSettings();
    cargarPromos();
  }, [role]);

  async function listarReservas() {
    const r = await fetch("/api/reservations");
    const j = await r.json();
    setReservas(j.reservas || []);
    // Cargar métricas reales desde API
    await cargarMetricas();
  }

  async function cargarMetricas() {
    const [semana, mes, anio] = await Promise.all([
      fetch("/api/metrics?periodo=semana").then(r => r.json()),
      fetch("/api/metrics?periodo=mes").then(r => r.json()),
      fetch("/api/metrics?periodo=anio").then(r => r.json()),
    ]);
    setStats({
      semana: semana.total || 0,
      mes: mes.total || 0,
      anio: anio.total || 0,
    });
    setLoadingMetrics(true);
    const ext = await fetch('/api/metrics?periodo=mes&extended=true').then(r=>r.json()).catch(()=>null);
    setExtendedMetrics(ext);
    setLoadingMetrics(false);
  }

  async function cargarSettings() {
    const r = await fetch("/api/settings");
    const j = await r.json();
    if (j.settings) setSettings(j.settings);
  }

  async function guardarSettings() {
    await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    await cargarSettings();
  }

  async function cargarPromos() {
    const r = await fetch("/api/promotions?all=true");
    const j = await r.json();
    setPromos(j.promociones || []);
  }

  async function agregarPromo() {
    const name = prompt("Nombre de la promo (ej 2x1 Miércoles)");
    if (!name) return;
    await fetch("/api/promotions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description: name, rule: { twoForOneWednesday: true }, active: true }) });
    await cargarPromos();
  }

  async function eliminarPromo(id) {
    await fetch(`/api/promotions?id=${id}`, { method: "DELETE" });
    await cargarPromos();
  }

  async function cancelarReserva(id) {
    if (!confirm('¿Cancelar esta reserva?')) return;
    try {
      const res = await fetch('/api/reservations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'cancel', user_id: session.user.id }),
      });
      if (res.ok) {
        await listarReservas();
        alert('Reserva cancelada');
      }
    } catch (e) {
      alert('Error cancelando: ' + e.message);
    }
  }

  function exportarExcel() {
    // Filtrar reservas por estado si hay filtros activos
    let data = reservas;
    const [statusFilter, setStatusFilter] = [null, null]; // placeholder para el filtro
    
    // Preparar CSV (Excel puede abrirlo)
    const headers = ['Fecha y Hora', 'Cliente', 'DNI', 'Email', 'Teléfono', 'Experiencia', 'Cantidad', 'Estado', 'Precio Total', 'Seña Requerida', 'Seña Pagada'];
    const rows = data.map(r => [
      new Intl.DateTimeFormat('es-AR', { timeZone: AR_TZ, dateStyle: 'short', timeStyle: 'short' }).format(new Date(r.fecha_hora)),
      `${r.profiles?.first_name || ''} ${r.profiles?.last_name || ''}`.trim(),
      r.profiles?.dni || '',
      r.profiles?.email || '',
      r.profiles?.phone || '',
      r.experiencia,
      r.cantidad,
      r.status,
      r.precio_total,
      r.deposito_requerido,
      r.deposito_pagado || 0
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reservas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  if (role === null) {
    return <div className="card">Cargando acceso...</div>;
  }
  if (role !== "admin") {
    return <div className="card">Acceso restringido. Debes ser administrador.<br/>{profileError && <div className="text-xs text-red-400 mt-2">{profileError}</div>}</div>;
  }

  // Filtrar reservas por estado para tabs
  const reservasPendientes = reservas.filter(r => r.status === 'pending');
  const reservasConfirmadas = reservas.filter(r => r.status === 'confirmed');
  const reservasCanceladas = reservas.filter(r => r.status === 'cancelled');

  return (
    <div className="grid gap-6">
      {/* Resumen rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card bg-blue-500/5 border-blue-500/20">
          <div className="text-xs text-blue-400">Reservas totales</div>
          <div className="text-2xl font-bold">{reservas.length}</div>
        </div>
        <div className="card bg-yellow-500/5 border-yellow-500/20">
          <div className="text-xs text-yellow-400">Pendientes</div>
          <div className="text-2xl font-bold">{reservasPendientes.length}</div>
        </div>
        <div className="card bg-green-500/5 border-green-500/20">
          <div className="text-xs text-green-400">Confirmadas</div>
          <div className="text-2xl font-bold">{reservasConfirmadas.length}</div>
        </div>
        <div className="card bg-red-500/5 border-red-500/20">
          <div className="text-xs text-red-400">Canceladas</div>
          <div className="text-2xl font-bold">{reservasCanceladas.length}</div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button className={`btn ${tab==='reservas'?'btn-naranja':'bg-neutral-800'}`} onClick={() => setTab('reservas')}>Reservas</button>
        <button className={`btn ${tab==='metrics'?'btn-naranja':'bg-neutral-800'}`} onClick={() => setTab('metrics')}>Ingresos</button>
        <button className={`btn ${tab==='analytics'?'btn-naranja':'bg-neutral-800'}`} onClick={() => setTab('analytics')}>Analytics</button>
        <button className={`btn ${tab==='settings'?'btn-naranja':'bg-neutral-800'}`} onClick={() => setTab('settings')}>Configuración</button>
        <button className={`btn ${tab==='promos'?'btn-naranja':'bg-neutral-800'}`} onClick={() => setTab('promos')}>Promociones</button>
      </div>

      {tab === 'reservas' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Reservas</h2>
            <button className="btn bg-green-600 hover:bg-green-700" onClick={exportarExcel}>📥 Exportar Excel</button>
          </div>
          {reservas.length === 0 ? (
            <div className="text-center py-8 text-neutral-400">
              No hay reservas aún. Las reservas aparecerán aquí cuando los clientes reserven.
            </div>
          ) : (
            <div className="overflow-x-auto text-sm">
              <table className="w-full">
                <thead className="text-left text-neutral-400 border-b border-neutral-800">
                  <tr>
                    <th className="pb-2">Fecha</th>
                    <th className="pb-2">Cliente</th>
                    <th className="pb-2">Contacto</th>
                    <th className="pb-2">Experiencia</th>
                    <th className="pb-2">Cant.</th>
                    <th className="pb-2">Estado</th>
                    <th className="pb-2">Total / Seña</th>
                    <th className="pb-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {reservas.map(r => (
                    <tr key={r.id} className="border-t border-neutral-800 hover:bg-neutral-900/50">
                      <td className="py-3">{fmtARDateTime(r.fecha_hora)}</td>
                      <td className="py-3">
                        <div className="font-semibold">{r.profiles?.first_name} {r.profiles?.last_name}</div>
                        <div className="text-xs text-neutral-500">DNI: {r.profiles?.dni}</div>
                      </td>
                      <td className="py-3 text-xs">
                        <div>{r.profiles?.email}</div>
                        <div>{r.profiles?.phone}</div>
                      </td>
                      <td className="py-3">{r.experiencia}</td>
                      <td className="py-3">{r.cantidad}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          r.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                          r.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <div>${formatARMoney(r.precio_total)}</div>
                        <div className="text-xs text-neutral-500">${formatARMoney(r.deposito_pagado || 0)} / ${formatARMoney(r.deposito_requerido)}</div>
                      </td>
                      <td className="py-3">
                        {(r.status === 'pending' || r.status === 'confirmed') && (
                          <button 
                            className="text-xs text-red-400 hover:text-red-300 underline"
                            onClick={() => cancelarReserva(r.id)}
                          >
                            Cancelar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'metrics' && (
        <div className="card">
          <h2 className="text-xl font-bold mb-3">Ingresos</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="card"><div className="text-neutral-400 text-sm">Semana</div><div className="text-2xl font-bold">${formatARMoney(stats.semana)}</div></div>
            <div className="card"><div className="text-neutral-400 text-sm">Mes</div><div className="text-2xl font-bold">${formatARMoney(stats.mes)}</div></div>
            <div className="card"><div className="text-neutral-400 text-sm">Año</div><div className="text-2xl font-bold">${formatARMoney(stats.anio)}</div></div>
          </div>
        </div>
      )}

      {tab === 'analytics' && (
        <div className="card grid gap-6">
          <h2 className="text-xl font-bold">Analytics</h2>
          {!extendedMetrics && loadingMetrics && <div>Cargando métricas...</div>}
          {extendedMetrics && (
            <>
              <div className="grid md:grid-cols-3 gap-3">
                <div className="card"><div className="text-neutral-400 text-xs">Conversion</div><div className="text-xl font-bold">{(extendedMetrics.conversion*100).toFixed(1)}%</div></div>
                <div className="card"><div className="text-neutral-400 text-xs">Uso de promos</div><div className="text-xl font-bold">{(extendedMetrics.promoUsage*100).toFixed(1)}%</div></div>
                <div className="card"><div className="text-neutral-400 text-xs">Reservas totales</div><div className="text-xl font-bold">{extendedMetrics.totalReservas}</div></div>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <div className="card"><div className="text-neutral-400 text-xs">Ingresos confirmados</div><div className="text-xl font-bold">${formatARMoney(extendedMetrics.ingresosConfirmados)}</div></div>
                <div className="card"><div className="text-neutral-400 text-xs">Ingresos potenciales</div><div className="text-xl font-bold">${formatARMoney(extendedMetrics.ingresosPotenciales)}</div></div>
                <div className="card"><div className="text-neutral-400 text-xs">Gap</div><div className="text-xl font-bold">${formatARMoney(extendedMetrics.gapIngresos)}</div></div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Ocupación por hora (último período)</h3>
                <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
                  {extendedMetrics.heatmap.map(h => (
                    <div key={h.hour} className="bg-neutral-800 rounded p-2 text-center text-xs">
                      <div>{h.hour}h</div>
                      <div className="font-bold">{h.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div className="card grid gap-4">
          <h2 className="text-xl font-bold">Configuración</h2>
          <div>
            <label className="block text-sm">Capacidad (simuladores disponibles)</label>
            <input className="bg-neutral-800 p-2 rounded" type="number" value={settings.capacidad} onChange={(e)=>setSettings({...settings, capacidad: Number(e.target.value)})} />
          </div>
          <div className="grid gap-3">
            <div className="font-semibold">Días y horarios</div>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                {k:0,l:'Domingo'},{k:1,l:'Lunes'},{k:2,l:'Martes'},{k:3,l:'Miércoles'},{k:4,l:'Jueves'},{k:5,l:'Viernes'},{k:6,l:'Sábado'}
              ].map(d => (
                <div key={d.k} className="bg-neutral-900 border border-neutral-800 rounded p-3 grid gap-3 sm:flex sm:items-center sm:gap-3">
                  <div className="sm:w-24 text-sm font-medium">{d.l}</div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={settings.horarios_by_day?.[d.k]?.enabled !== false} onChange={(e)=>setSettings({
                      ...settings,
                      horarios_by_day: {
                        ...(settings.horarios_by_day||{}),
                        [d.k]: { ...(settings.horarios_by_day?.[d.k]||{}), enabled: e.target.checked }
                      }
                    })} />
                    Habilitado
                  </label>
                  <input type="time" className="bg-neutral-800 p-2 rounded w-full sm:w-28 sm:ml-auto" placeholder="Apertura" value={settings.horarios_by_day?.[d.k]?.open||""} onChange={(e)=>setSettings({
                    ...settings,
                    horarios_by_day: {
                      ...(settings.horarios_by_day||{}),
                      [d.k]: { ...(settings.horarios_by_day?.[d.k]||{}), open: e.target.value }
                    }
                  })} />
                  <input type="time" className="bg-neutral-800 p-2 rounded w-full sm:w-28" placeholder="Cierre" value={settings.horarios_by_day?.[d.k]?.close||""} onChange={(e)=>setSettings({
                    ...settings,
                    horarios_by_day: {
                      ...(settings.horarios_by_day||{}),
                      [d.k]: { ...(settings.horarios_by_day?.[d.k]||{}), close: e.target.value }
                    }
                  })} />
                </div>
              ))}
            </div>
            <div className="text-xs text-neutral-400">Si completás esta grilla, se usará en lugar de los horarios por semana.</div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="font-semibold mb-1">Lun a Vie</div>
              <div className="grid grid-cols-2 gap-2">
                <input type="time" className="bg-neutral-800 p-2 rounded w-full" value={settings.horarios?.weekday?.open||""} onChange={(e)=>setSettings({...settings, horarios: {...settings.horarios, weekday: {...(settings.horarios?.weekday||{}), open: e.target.value}}})} />
                <input type="time" className="bg-neutral-800 p-2 rounded w-full" value={settings.horarios?.weekday?.close||""} onChange={(e)=>setSettings({...settings, horarios: {...settings.horarios, weekday: {...(settings.horarios?.weekday||{}), close: e.target.value}}})} />
              </div>
            </div>
            <div>
              <div className="font-semibold mb-1">Sáb y Dom</div>
              <div className="grid grid-cols-2 gap-2">
                <input type="time" className="bg-neutral-800 p-2 rounded w-full" value={settings.horarios?.weekend?.open||""} onChange={(e)=>setSettings({...settings, horarios: {...settings.horarios, weekend: {...(settings.horarios?.weekend||{}), open: e.target.value}}})} />
                <input type="time" className="bg-neutral-800 p-2 rounded w-full" value={settings.horarios?.weekend?.close||""} onChange={(e)=>setSettings({...settings, horarios: {...settings.horarios, weekend: {...(settings.horarios?.weekend||{}), close: e.target.value}}})} />
              </div>
            </div>
          </div>
          <div className="grid gap-3">
            <div className="font-semibold mt-2">Precios por experiencia</div>
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm">Grand Prix</label>
                <input className="bg-neutral-800 p-2 rounded w-full" type="number" value={settings.pricing?.GRAND_PRIX ?? 15000} onChange={(e)=>setSettings({...settings, pricing: {...(settings.pricing||{}), GRAND_PRIX: Number(e.target.value)}})} />
              </div>
              <div>
                <label className="block text-sm">Mini Grand Prix</label>
                <input className="bg-neutral-800 p-2 rounded w-full" type="number" value={settings.pricing?.MINI_GRAND_PRIX ?? 10000} onChange={(e)=>setSettings({...settings, pricing: {...(settings.pricing||{}), MINI_GRAND_PRIX: Number(e.target.value)}})} />
              </div>
              <div>
                <label className="block text-sm">Quick Race</label>
                <input className="bg-neutral-800 p-2 rounded w-full" type="number" value={settings.pricing?.QUICK_RACE ?? 8000} onChange={(e)=>setSettings({...settings, pricing: {...(settings.pricing||{}), QUICK_RACE: Number(e.target.value)}})} />
              </div>
            </div>
          </div>
          <button className="btn btn-rojo w-max" onClick={guardarSettings}>Guardar</button>
        </div>
      )}

      {tab === 'promos' && (
        <div className="card grid gap-4">
          <div className="flex items-center">
            <h2 className="text-xl font-bold">Promociones</h2>
          </div>
          {/* Crear promoción avanzada */}
          <PromoCreator onCreated={cargarPromos} />
          <div className="grid gap-2">
            {promos.length === 0 && (
              <div className="text-neutral-400 text-sm">No hay promociones creadas.</div>
            )}
            {promos.map(p => (
              <PromoRow key={p.id} promo={p} onChanged={cargarPromos} onDelete={()=>eliminarPromo(p.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PromoCreator({ onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [days, setDays] = useState([]); // [0..6]
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [gp, setGp] = useState("");
  const [mgp, setMgp] = useState("");
  const [qr, setQr] = useState("");

  async function crear() {
    const rule = {};
    if (days.length) rule.days = days;
    if (timeStart && timeEnd) { rule.timeStart = timeStart; rule.timeEnd = timeEnd; }
    const priceOverrides = {};
    if (gp) priceOverrides.GRAND_PRIX = Number(gp);
    if (mgp) priceOverrides.MINI_GRAND_PRIX = Number(mgp);
    if (qr) priceOverrides.QUICK_RACE = Number(qr);
    if (Object.keys(priceOverrides).length) rule.priceOverrides = priceOverrides;
    const body = { name: name || 'Promoción', description, rule, active };
    await fetch('/api/promotions', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    setName(""); setDescription(""); setActive(true); setDays([]); setTimeStart(""); setTimeEnd(""); setGp(""); setMgp(""); setQr("");
    onCreated?.();
  }

  const dayOpts = [
    {k:0,l:'Dom'}, {k:1,l:'Lun'}, {k:2,l:'Mar'}, {k:3,l:'Mié'}, {k:4,l:'Jue'}, {k:5,l:'Vie'}, {k:6,l:'Sáb'}
  ];

  function toggleDay(k) {
    setDays(prev => prev.includes(k) ? prev.filter(x=>x!==k) : [...prev, k]);
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded p-4 grid gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Columna 1: nombre/descr/activa */}
        <div className="grid gap-2">
          <label className="text-xs uppercase tracking-wide text-neutral-400">Nombre</label>
          <input className="bg-neutral-800 p-2 rounded" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Nombre de la promo" />
          <label className="text-xs uppercase tracking-wide text-neutral-400 mt-2">Descripción</label>
          <input className="bg-neutral-800 p-2 rounded" value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Descripción corta" />
          <label className="flex items-center gap-2 text-sm mt-2">
            <input type="checkbox" checked={active} onChange={(e)=>setActive(e.target.checked)} /> Activa
          </label>
        </div>

        {/* Columna 2: días y horarios */}
        <div className="grid gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-400 mb-2">Días aplicables</div>
            <div className="flex flex-wrap gap-2">
              {dayOpts.map(d => {
                const pressed = days.includes(d.k);
                return (
                  <button
                    key={d.k}
                    type="button"
                    aria-pressed={pressed}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${pressed ? 'bg-[var(--naranja)]/20 border-[var(--naranja)] text-[var(--naranja)]' : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'}`}
                    onClick={()=>toggleDay(d.k)}
                  >
                    {d.l}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-neutral-400 mb-1">Desde</div>
              <input type="time" className="bg-neutral-800 p-2 rounded w-full" value={timeStart} onChange={(e)=>setTimeStart(e.target.value)} />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-neutral-400 mb-1">Hasta</div>
              <input type="time" className="bg-neutral-800 p-2 rounded w-full" value={timeEnd} onChange={(e)=>setTimeEnd(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Columna 3: precios especiales */}
        <div className="grid gap-2">
          <div className="text-xs uppercase tracking-wide text-neutral-400">Precios especiales (opcional)</div>
          <div>
            <label className="block text-sm mb-1">Grand Prix</label>
            <input className="bg-neutral-800 p-2 rounded w-full" inputMode="numeric" type="number" placeholder="Ej 14000" value={gp} onChange={(e)=>setGp(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">Mini Grand Prix</label>
            <input className="bg-neutral-800 p-2 rounded w-full" inputMode="numeric" type="number" placeholder="Ej 9000" value={mgp} onChange={(e)=>setMgp(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">Quick Race</label>
            <input className="bg-neutral-800 p-2 rounded w-full" inputMode="numeric" type="number" placeholder="Ej 7000" value={qr} onChange={(e)=>setQr(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <button className="btn btn-naranja w-full sm:w-auto" onClick={crear}>Crear promoción</button>
      </div>
    </div>
  );
}

function PromoRow({ promo, onChanged, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(promo.name || "");
  const [description, setDescription] = useState(promo.description || "");
  const [active, setActive] = useState(!!promo.active);
  // campos dentro de rule
  const rule = promo.rule || {};
  const [days, setDays] = useState(Array.isArray(rule.days) ? rule.days : []);
  const [timeStart, setTimeStart] = useState(rule.timeStart || "");
  const [timeEnd, setTimeEnd] = useState(rule.timeEnd || "");
  const [gp, setGp] = useState(rule.priceOverrides?.GRAND_PRIX ?? "");
  const [mgp, setMgp] = useState(rule.priceOverrides?.MINI_GRAND_PRIX ?? "");
  const [qr, setQr] = useState(rule.priceOverrides?.QUICK_RACE ?? "");

  const dayOpts = [
    {k:0,l:'Dom'}, {k:1,l:'Lun'}, {k:2,l:'Mar'}, {k:3,l:'Mié'}, {k:4,l:'Jue'}, {k:5,l:'Vie'}, {k:6,l:'Sáb'}
  ];
  function toggleDay(k) {
    setDays(prev => prev.includes(k) ? prev.filter(x=>x!==k) : [...prev, k]);
  }

  async function save() {
    const updates = { id: promo.id, name, description, active };
    const newRule = {};
    if (days.length) newRule.days = days;
    if (timeStart && timeEnd) { newRule.timeStart = timeStart; newRule.timeEnd = timeEnd; }
    const po = {};
    if (gp) po.GRAND_PRIX = Number(gp);
    if (mgp) po.MINI_GRAND_PRIX = Number(mgp);
    if (qr) po.QUICK_RACE = Number(qr);
    if (Object.keys(po).length) newRule.priceOverrides = po;
    updates.rule = newRule;
    await fetch('/api/promotions', { method: 'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(updates) });
    setEditing(false);
    onChanged?.();
  }

  return (
    <div className="bg-neutral-800 rounded">
      <div className="px-3 py-2 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{promo.name}</div>
          <div className="text-xs text-neutral-400 truncate">{promo.description}</div>
        </div>
        <label className="text-xs flex items-center gap-2">
          <input type="checkbox" checked={active} onChange={(e)=>{setActive(e.target.checked);}} /> Activa
        </label>
        <button className="text-sm underline" onClick={()=>setEditing(v=>!v)}>{editing?'Cancelar':'Editar'}</button>
        <button className="text-sm underline text-red-400" onClick={onDelete}>Eliminar</button>
      </div>
      {editing && (
        <div className="border-t border-neutral-700 p-3 grid gap-3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <label className="text-xs uppercase tracking-wide text-neutral-400">Nombre</label>
              <input className="bg-neutral-900 p-2 rounded" value={name} onChange={(e)=>setName(e.target.value)} />
              <label className="text-xs uppercase tracking-wide text-neutral-400">Descripción</label>
              <input className="bg-neutral-900 p-2 rounded" value={description} onChange={(e)=>setDescription(e.target.value)} />
            </div>
            <div className="grid gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-neutral-400 mb-2">Días aplicables</div>
                <div className="flex flex-wrap gap-2">
                  {dayOpts.map(d => {
                    const pressed = days.includes(d.k);
                    return (
                      <button key={d.k} type="button" aria-pressed={pressed} className={`px-3 py-1.5 rounded-full text-sm border ${pressed?'bg-[var(--naranja)]/20 border-[var(--naranja)] text-[var(--naranja)]':'border-neutral-600 text-neutral-300'}`} onClick={()=>toggleDay(d.k)}>{d.l}</button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-neutral-400 mb-1">Desde</div>
                  <input type="time" className="bg-neutral-900 p-2 rounded w-full" value={timeStart} onChange={(e)=>setTimeStart(e.target.value)} />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-neutral-400 mb-1">Hasta</div>
                  <input type="time" className="bg-neutral-900 p-2 rounded w-full" value={timeEnd} onChange={(e)=>setTimeEnd(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              <div className="text-xs uppercase tracking-wide text-neutral-400">Precios especiales</div>
              <div>
                <label className="block text-sm mb-1">Grand Prix</label>
                <input className="bg-neutral-900 p-2 rounded w-full" type="number" inputMode="numeric" value={gp} onChange={(e)=>setGp(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm mb-1">Mini Grand Prix</label>
                <input className="bg-neutral-900 p-2 rounded w-full" type="number" inputMode="numeric" value={mgp} onChange={(e)=>setMgp(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm mb-1">Quick Race</label>
                <input className="bg-neutral-900 p-2 rounded w-full" type="number" inputMode="numeric" value={qr} onChange={(e)=>setQr(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button className="btn btn-naranja w-full sm:w-auto" onClick={save}>Guardar cambios</button>
          </div>
        </div>
      )}
    </div>
  );
}


