// Lógica de disponibilidad: calcula solapamientos y cupos.
import { addMinutes, isWithinInterval, parseISO } from "date-fns";
import { CAPACIDAD_DEFAULT, HORARIOS_DEFAULT } from "./constants";

// Determina si una fecha/hora está dentro del horario de apertura
export function estaEnHorario(fechaInicio, duracionMin, settings) {
  const d = new Date(fechaInicio);
  const dow = d.getDay();
  let open = "00:00";
  let close = "23:59";
  let enabled = true;

  if (settings?.horarios_by_day) {
    const dayCfg = settings.horarios_by_day[String(dow)] || settings.horarios_by_day[dow];
    if (dayCfg) {
      enabled = dayCfg.enabled !== false;
      open = dayCfg.open || open;
      close = dayCfg.close || close;
    }
  } else if (settings?.horarios) {
    const isWeekend = dow === 0 || dow === 6;
    const h = (settings.horarios.weekend && isWeekend) ? settings.horarios.weekend : settings.horarios.weekday || HORARIOS_DEFAULT.weekday;
    open = h.open || open;
    close = h.close || close;
  } else {
    const isWeekend = dow === 0 || dow === 6;
    const h = isWeekend ? HORARIOS_DEFAULT.weekend : HORARIOS_DEFAULT.weekday;
    open = h.open;
    close = h.close;
  }

  if (!enabled) return false;

  const [openH, openM] = (open || "00:00").split(":").map(Number);
  const [closeH, closeM] = (close || "23:59").split(":").map(Number);
  const from = new Date(d); from.setHours(openH, openM, 0, 0);
  const to = new Date(d); to.setHours(closeH, closeM, 0, 0);
  const end = addMinutes(d, duracionMin);
  return isWithinInterval(d, { start: from, end: to }) && isWithinInterval(end, { start: from, end: to });
}

// Calcula cupo disponible considerando reservas existentes en ese rango
export function calcularCupoDisponible(reservas, fechaInicio, duracionMin, capacidad) {
  const start = new Date(fechaInicio);
  const end = addMinutes(start, duracionMin);
  const cap = capacidad || CAPACIDAD_DEFAULT;

  let ocupadasSim = 0;
  for (const r of reservas) {
    const rStart = parseISO(r.fecha_hora);
    const rEnd = addMinutes(rStart, r.duracion_min);
    const solapa = r.status !== "cancelled" && (
      isWithinInterval(start, { start: rStart, end: rEnd }) ||
      isWithinInterval(end, { start: rStart, end: rEnd }) ||
      isWithinInterval(rStart, { start, end })
    );
    if (solapa) ocupadasSim += r.cantidad;
  }
  return Math.max(0, cap - ocupadasSim);
}
