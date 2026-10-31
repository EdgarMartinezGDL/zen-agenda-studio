// Zona horaria de la sede (reparación R2): el panel SIEMPRE muestra y captura
// horas en la zona de la sede, nunca en la del dispositivo.

export const ZONAS_HORARIAS = [
  { value: "America/Mexico_City", label: "Centro — CDMX, Guadalajara, Monterrey, Chihuahua" },
  { value: "America/Mazatlan", label: "Pacífico — Sinaloa, Nayarit, Baja California Sur" },
  { value: "America/Hermosillo", label: "Sonora" },
  { value: "America/Cancun", label: "Sureste — Quintana Roo" },
  { value: "America/Tijuana", label: "Baja California — Tijuana, Mexicali" },
  { value: "America/Ciudad_Juarez", label: "Frontera Chihuahua — Ciudad Juárez" },
  { value: "America/Matamoros", label: "Frontera noreste — Matamoros, Reynosa, Nuevo Laredo, Piedras Negras, Acuña" },
] as const;

export const ZONA_CENTRO = "America/Mexico_City";

export const zonaLabel = (tz?: string | null) =>
  ZONAS_HORARIAS.find((z) => z.value === tz)?.label ?? ZONAS_HORARIAS[0].label;

/** Zona de la clínica: la que comparten todas sus sedes; si difieren o no hay, Centro. */
export function zonaClinica(locations?: { timezone?: string | null }[] | null): string {
  const set = new Set((locations ?? []).map((l) => l.timezone || ZONA_CENTRO));
  return set.size === 1 ? [...set][0] : ZONA_CENTRO;
}

/** Zona de una sede por id; si no se encuentra, la de la clínica. */
export function zonaDeSede(
  locations: { id: string; timezone?: string | null }[] | null | undefined,
  locationId?: string | null,
): string {
  const loc = (locations ?? []).find((l) => l.id === locationId);
  return loc?.timezone || zonaClinica(locations);
}

const partes = (d: Date, tz: string) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
};

/** "AAAA-MM-DD" de un instante en la zona dada. */
export function ymdEnZona(d: Date | string, tz: string): string {
  const p = partes(new Date(d), tz);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** "HH:MM" (24 h) de un instante en la zona dada. */
export function hhmmEnZona(d: Date | string, tz: string): string {
  const p = partes(new Date(d), tz);
  return `${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}`;
}

/** Hoy ("AAAA-MM-DD") en la zona dada. */
export const hoyEnZona = (tz: string) => ymdEnZona(new Date(), tz);

/** Suma días a "AAAA-MM-DD" (calendario puro, sin zona). */
export function sumarDias(ymd: string, dias: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Días entre dos fechas "AAAA-MM-DD" (b − a). */
export function diasEntre(a: string, b: string): number {
  const t = (s: string) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86_400_000);
}

const desfaseMin = (d: Date, tz: string) => {
  const p = partes(d, tz);
  return (Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(d.getTime() / 1000) * 1000) / 60000;
};

/** Fecha "AAAA-MM-DD" + hora "HH:MM" en la zona de la sede → instante real (Date). */
export function aInstante(ymd: string, hhmm: string, tz: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const local = Date.UTC(y, m - 1, d, h, mi);
  let t = local - desfaseMin(new Date(local), tz) * 60000;
  t = local - desfaseMin(new Date(t), tz) * 60000; // segunda pasada por si cruza el cambio de horario
  return new Date(t);
}

/** Rango [inicio, fin] de un día completo de la sede, para filtrar en el backend. */
export function rangoDelDia(ymd: string, tz: string): { from: string; to: string } {
  const from = aInstante(ymd, "00:00", tz);
  const to = new Date(aInstante(sumarDias(ymd, 1), "00:00", tz).getTime() - 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Formatea un instante en la zona dada (mismas opciones de toLocale*String). */
export const fmtEnZona = (d: Date | string, tz: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(d).toLocaleString("es-MX", { ...opts, timeZone: tz });

/** Etiqueta de una fecha de calendario "AAAA-MM-DD" (no depende de ninguna zona). */
export const fmtFecha = (ymd: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString("es-MX", { ...opts, timeZone: "UTC" });
