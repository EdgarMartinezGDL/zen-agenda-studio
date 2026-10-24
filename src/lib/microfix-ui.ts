// Utilidades de presentación para la integración con MicroFix Cloud.
import { ApiError } from "@/lib/microfix/client";
import type { AppointmentStatus } from "@/lib/microfix/types";

/** Mensaje legible para la UI; sin backend → "Sin conexión con el servidor". */
export function errorText(e: unknown): string {
  if (e instanceof ApiError && e.status === 0) return "Sin conexión con el servidor";
  if (e instanceof Error && e.message) return e.message;
  return "Ocurrió un error inesperado";
}

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
  ASISTIO: "Asistió",
  NO_ASISTIO: "No asistió",
  REAGENDADA: "Reagendada",
};

/** Fecha YYYY-MM-DD de la próxima ocurrencia (desde hoy) de un día de la semana. */
export function nextDateForDow(dow: number, base = new Date()): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Quita las claves con valor undefined (el backend solo recibe lo que cambia). */
export function compact<T extends Record<string, unknown>>(obj: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as never;
}
