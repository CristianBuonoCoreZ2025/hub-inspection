/**
 * Utilidades de zona horaria del sistema.
 *
 * Regla de negocio:
 * - Toda fecha/hora visible para el usuario se muestra en la zona horaria del usuario.
 * - Por defecto se usa la zona horaria del dispositivo/navegador del usuario
 *   (detectada via `Intl.DateTimeFormat().resolvedOptions().timeZone`).
 * - Si el usuario tiene una zona horaria configurada en su perfil, se puede sobrescribir
 *   con `setUserTimeZone()` y se persiste en `localStorage`.
 * - Fallback en servidor: `America/Santiago`.
 * - La base de datos siempre almacena UTC (`timestamptz`).
 * - Cuando el usuario selecciona una fecha/hora local, se convierte a ISO con offset
 *   explícito antes de enviar al servidor.
 */

export const BUSINESS_TIME_ZONE = "America/Santiago";

let _overrideTimeZone: string | null = null;

export function setUserTimeZone(timeZone: string) {
  _overrideTimeZone = timeZone;
  if (typeof window !== "undefined") {
    localStorage.setItem("user-timezone", timeZone);
  }
}

export function getUserTimeZone() {
  if (_overrideTimeZone) return _overrideTimeZone;
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("user-timezone");
    if (saved) return saved;
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return BUSINESS_TIME_ZONE;
    }
  }
  return BUSINESS_TIME_ZONE;
}

function isDateOnly(value: string) {
  return value.length === 10 && !value.includes("T") && value.includes("-");
}

function parseInput(value: string | Date) {
  if (value instanceof Date) return value;
  if (isDateOnly(value)) return new Date(`${value}T00:00:00Z`);
  return new Date(value);
}

/** Formatea un UTC/ISO a la zona horaria del usuario. */
export function formatUserDateTime(dateStr: string | Date | null | undefined) {
  if (!dateStr) return "—";
  const d = parseInput(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL", {
    timeZone: getUserTimeZone(),
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Formatea solo fecha (date o timestamp). */
export function formatUserDate(dateStr: string | Date | null | undefined) {
  if (!dateStr) return "—";
  const dateOnly = typeof dateStr === "string" && isDateOnly(dateStr);
  const d = parseInput(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", {
    timeZone: dateOnly ? "UTC" : getUserTimeZone(),
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Formatea solo hora. */
export function formatUserTime(dateStr: string | Date | null | undefined) {
  if (!dateStr) return "—";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("es-CL", {
    timeZone: getUserTimeZone(),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Convierte una fecha local del usuario (yyyy-MM-dd) y hora (HH:mm) a ISO con offset. */
export function toUserISO(dateStr: string, timeStr?: string) {
  const timeZone = getUserTimeZone();
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = (timeStr ?? "00:00").split(":").map(Number);

  // Usar mediodía UTC del día seleccionado para obtener el offset de la zona horaria
  const utcNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(utcNoon);
  const p = (type: string) => parts.find((x) => x.type === type)?.value ?? "0";
  const localDate = new Date(Date.UTC(Number(p("year")), Number(p("month")) - 1, Number(p("day")), Number(p("hour")), Number(p("minute")), Number(p("second"))));
  const offsetMinutes = (utcNoon.getTime() - localDate.getTime()) / 60000;

  const sign = offsetMinutes <= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const oh = String(Math.floor(abs / 60)).padStart(2, "0");
  const om = String(abs % 60).padStart(2, "0");
  const isoOffset = `${sign}${oh}:${om}`;
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${dateStr}T${hh}:${mm}:00${isoOffset}`;
}

/**
 * Convierte un valor de <input type="datetime-local"> (yyyy-MM-ddTHH:mm, sin offset)
 * a ISO con offset de la zona horaria del usuario, para guardar en BD.
 *
 * El input datetime-local SIEMPRE devuelve la hora local del usuario sin offset.
 * Si se guarda tal cual en un timestamptz, Postgres lo interpreta como UTC,
 * causando un desfase igual al offset de la zona horaria (ej: -4h en Santiago).
 */
export function fromDateTimeLocalInput(value: string): string {
  // value = "2026-07-26T10:00"
  const [datePart, timePart] = value.split("T");
  return toUserISO(datePart, timePart);
}

/**
 * Convierte un ISO (con offset o UTC) al formato que espera <input type="datetime-local">
 * (yyyy-MM-ddTHH:mm en la zona horaria del usuario, sin offset).
 *
 * Esto es necesario para mostrar correctamente el valor guardado en el input.
 */
export function toDateTimeLocalInput(isoStr: string): string {
  if (!isoStr) return "";
  const d = parseInput(isoStr);
  if (Number.isNaN(d.getTime())) return "";

  // Formatear en la zona horaria del usuario
  const timeZone = getUserTimeZone();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const p = (type: string) => parts.find((x) => x.type === type)?.value ?? "0";
  const yyyy = p("year");
  const mm = p("month");
  const dd = p("day");
  const hh = p("hour") === "24" ? "00" : p("hour");
  const min = p("minute");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

/** Timestamp actual en UTC (para created_on, updated_on, etc.). */
export function nowUTC() {
  return new Date().toISOString();
}
