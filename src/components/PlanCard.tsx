import { useQuery } from "@tanstack/react-query";
import { Check, Minus } from "lucide-react";

import { planLabel } from "@/lib/admin-ui";
import { organizationApi } from "@/lib/microfix/api";
import type { PlanFeatures } from "@/lib/microfix/types";
import type { OrganizationContext } from "@/types";

// Fase 5, 5.6.5: lo que incluye el plan del profesional y cuánto usa.
function planName(f: PlanFeatures | undefined): string {
  if (!f) return "…";
  if (f.profile === "PAID") return planLabel(f.planCode);
  if (f.profile === "DEMO") return "Demo";
  return "Sin plan";
}

function Feature({ label, on }: { label: string; on: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span>{label}</span>
      {on ? (
        <span className="flex items-center gap-1 font-semibold text-status-confirmed">
          <Check className="h-4 w-4" /> Incluido
        </span>
      ) : (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Minus className="h-4 w-4" /> No incluido
        </span>
      )}
    </li>
  );
}

export function PlanCard({ orgId }: { orgId: string }) {
  const { data: f } = useQuery({
    queryKey: ["plan-features", orgId],
    queryFn: () => organizationApi.planFeatures(orgId),
    enabled: !!orgId,
  });
  // Lo que cuenta para el límite es solo lo activo (el contexto ya trae solo lo activo).
  const { data: ctx } = useQuery({
    queryKey: ["context", orgId],
    queryFn: () => organizationApi.context(orgId) as unknown as Promise<OrganizationContext>,
    enabled: !!orgId,
  });

  const locations = ctx?.locations?.length;
  const services = ctx?.services?.length;

  return (
    <section className="card-zen mt-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">Mi plan</p>
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold">
          {planName(f)}
        </span>
      </div>
      {f && (
        <ul className="mt-3 divide-y divide-border">
          <li className="flex items-center justify-between gap-3 py-1.5 text-sm">
            <span>Ubicaciones</span>
            <span className="font-semibold">
              {locations ?? "…"} de {f.maxLocations}
            </span>
          </li>
          <li className="flex items-center justify-between gap-3 py-1.5 text-sm">
            <span>Servicios</span>
            <span className="font-semibold">
              {services ?? "…"} de {f.maxServices ?? "ilimitados"}
            </span>
          </li>
          <Feature label="Eventos y talleres" on={f.eventsEnabled} />
          <Feature label="Cancelación inteligente" on={f.smartCancellationEnabled} />
          <Feature label="Documentos para la IA" on={f.ragEnabled} />
          <Feature label="Notificaciones push" on={f.pushEnabled} />
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        ¿Necesitas más? Mejora tu plan de Mi Agenda Zen.
      </p>
    </section>
  );
}
