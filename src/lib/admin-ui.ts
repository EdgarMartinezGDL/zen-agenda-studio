// Súper Panel (Fase 5, 5.6): etiquetas compartidas entre sus pantallas.

// Planes que se pueden asignar (el backend valida el código).
export const PLANS = [
  { code: "ESSENTIAL", label: "Esencial" },
  { code: "PREMIUM", label: "Premium" },
] as const;

export function planLabel(code: string | null | undefined): string {
  return PLANS.find((p) => p.code === code)?.label ?? code ?? "—";
}
