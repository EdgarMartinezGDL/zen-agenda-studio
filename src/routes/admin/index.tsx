import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pause, Play, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { AdminShell } from "@/components/AdminShell";
import { Banner } from "@/components/Banner";
import { Confirm } from "@/components/Confirm";
import { Modal } from "@/components/Modal";
import { PLANS, planLabel } from "@/lib/admin-ui";
import { adminApi } from "@/lib/microfix/api";
import type {
  AdminOrganization,
  PlanChangeResult,
  PlanExcessItem,
  PlanFeatures,
  TokenAdjustment,
} from "@/lib/microfix/types";
import { errorText } from "@/lib/microfix-ui";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Organizaciones — Súper Panel" },
      { name: "description", content: "Planes, consumo de IA y pausa de IA de cada organización." },
      { property: "og:title", content: "Organizaciones — Súper Panel" },
      { property: "og:description", content: "Planes, consumo de IA y pausa de IA de cada organización." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminShell>
      <OrganizationsPage />
    </AdminShell>
  ),
});

function profileLabel(f: PlanFeatures | undefined): string {
  if (!f) return "…";
  if (f.profile === "PAID") return planLabel(f.planCode);
  if (f.profile === "DEMO") return "Demo";
  return "Sin plan";
}

const TOKEN_TEXT: Record<TokenAdjustment, string> = {
  RAISED_CURRENT_PERIOD: "Los tokens de este mes subieron al tope del plan nuevo.",
  CURRENT_PERIOD_ALREADY_AT_LIMIT:
    "Los tokens de este mes ya tenían ese tope o uno mayor; no cambian.",
  NEXT_PERIOD:
    "Este mes conserva su tope de tokens; el del plan nuevo aplica desde el siguiente aniversario.",
  NO_PERIOD: "Aún no hay consumo este mes: el periodo empezará con el tope del plan nuevo.",
};

const num = (n: number) => n.toLocaleString("es-MX");
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

function OrganizationsPage() {
  const {
    data: orgs,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["admin", "organizations"],
    queryFn: adminApi.organizations,
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Organizaciones</h1>
        <Button variant="ghost"
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label="Actualizar"
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {error && <Banner kind="error" message={errorText(error)} />}
      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {orgs && orgs.length === 0 && (
        <p className="card-zen p-4 text-sm text-muted-foreground">Aún no hay organizaciones.</p>
      )}

      <div className="space-y-4">
        {orgs?.map((org) => (
          <OrganizationCard key={org.id} org={org} />
        ))}
      </div>
    </div>
  );
}

function OrganizationCard({ org }: { org: AdminOrganization }) {
  const queryClient = useQueryClient();
  const [pauseOpen, setPauseOpen] = useState(false);
  const [planCode, setPlanCode] = useState<string>("");
  const [planOpen, setPlanOpen] = useState(false);
  const [planResult, setPlanResult] = useState<PlanChangeResult | null>(null);

  const features = useQuery({
    queryKey: ["admin", "plan-features", org.id],
    queryFn: () => adminApi.planFeatures(org.id),
  });
  const usage = useQuery({
    queryKey: ["admin", "ai-usage", org.id],
    queryFn: () => adminApi.aiUsage(org.id),
  });

  const pausedAt = usage.data ? usage.data.aiPausedAt : org.aiPausedAt;
  const paused = !!pausedAt;
  const isPaid = features.data?.profile === "PAID";
  const currentPlan = features.data?.planCode ?? "";

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "plan-features", org.id] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "ai-usage", org.id] });
  };

  const pauseMutation = useMutation({
    mutationFn: () => (paused ? adminApi.resumeAi(org.id) : adminApi.pauseAi(org.id)),
    onSuccess: (r) => {
      setPauseOpen(false);
      toast.success(r.aiPausedAt ? "IA pausada" : "IA reanudada");
      refresh();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const planMutation = useMutation({
    mutationFn: () => adminApi.changePlan(org.id, planCode),
    onSuccess: (r) => {
      setPlanOpen(false);
      setPlanResult(r);
      setPlanCode("");
      refresh();
    },
    onError: (e) => {
      setPlanOpen(false);
      toast.error(errorText(e));
    },
  });

  const period = usage.data?.period ?? null;
  const percent = period?.percentUsed ?? 0;
  const barCls = percent >= 100 ? "bg-status-cancelled" : percent >= 80 ? "bg-gold" : "bg-primary";

  // Los diálogos van fuera de la tarjeta: card-zen atrapa a los elementos fixed.
  return (
    <>
      <section className="card-zen space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{org.name}</h2>
            <p className="text-xs text-muted-foreground">Alta: {day(org.createdAt)}</p>
          </div>
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold">
            {features.error ? "Plan: error" : `Plan: ${profileLabel(features.data)}`}
          </span>
        </div>

        {/* Consumo de IA del periodo */}
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">
            Consumo de IA del periodo
          </p>
          {usage.error ? (
            <p className="text-sm text-status-cancelled">{errorText(usage.error)}</p>
          ) : !usage.data ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : period ? (
            <>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full ${barCls}`}
                  style={{ width: `${Math.min(percent, 100)}%` }}
                />
              </div>
              <p className="mt-1 text-sm">
                <span className="font-semibold">{percent} %</span> · {num(period.consumedTokens)} de{" "}
                {num(period.tokenLimit)} tokens
              </p>
              <p className="text-xs text-muted-foreground">
                Del {day(period.start)} al {day(period.end)}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sin plan ni demo activa: la IA no responde.
            </p>
          )}
        </div>

        {/* Estado de la IA */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <p
            className={`text-sm font-semibold ${paused ? "text-status-cancelled" : "text-status-confirmed"}`}
          >
            {paused && pausedAt ? `IA pausada desde ${dateTime(pausedAt)}` : "IA activa"}
          </p>
          <Button variant="ghost"
            onClick={() => setPauseOpen(true)}
            className={`btn-3d ${paused ? "btn-3d-primary" : "btn-3d-warning"} flex items-center gap-2 px-3 py-2 text-sm`}
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {paused ? "Reanudar IA" : "Pausar IA"}
          </Button>
        </div>

        {/* Cambio de plan: solo clientes con suscripción */}
        {isPaid && (
          <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
            <label className="block min-w-[10rem] flex-1">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                Cambiar plan
              </span>
              <select
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={planCode}
                onChange={(e) => setPlanCode(e.target.value)}
              >
                <option value="">Elige un plan…</option>
                {PLANS.filter((p) => p.code !== currentPlan).map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <Button variant="ghost"
              onClick={() => setPlanOpen(true)}
              disabled={!planCode}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
            >
              Cambiar
            </Button>
          </div>
        )}
        {features.data?.profile === "DEMO" && (
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            Es una demo: el plan se asigna al convertirla.
          </p>
        )}
      </section>

      <Confirm
        open={pauseOpen}
        title={paused ? "Reanudar la IA" : "Pausar la IA"}
        message={
          paused
            ? `La IA de ${org.name} volverá a responder a sus pacientes.`
            : `La IA de ${org.name} dejará de responder a sus pacientes hasta que la reanudes. Los recordatorios y avisos de citas siguen funcionando.`
        }
        confirmLabel={paused ? "Sí, reanudar" : "Sí, pausar"}
        tone={paused ? "primary" : "danger"}
        pending={pauseMutation.isPending}
        onConfirm={() => pauseMutation.mutate()}
        onCancel={() => setPauseOpen(false)}
      />

      <Confirm
        open={planOpen}
        title="Cambiar plan"
        message={`${org.name} pasará de ${planLabel(currentPlan)} a ${planLabel(planCode)}. No se desactiva nada: si algo queda por encima del plan nuevo, te lo avisamos.`}
        confirmLabel="Sí, cambiar"
        tone="primary"
        pending={planMutation.isPending}
        onConfirm={() => planMutation.mutate()}
        onCancel={() => setPlanOpen(false)}
      />

      <Modal
        open={!!planResult}
        onClose={() => setPlanResult(null)}
        title="Resultado del cambio de plan"
      >
        {planResult && <PlanResult result={planResult} />}
        <Button variant="ghost"
          onClick={() => setPlanResult(null)}
          className="btn-primary mt-5 w-full px-4 py-2 text-sm"
        >
          Entendido
        </Button>
      </Modal>
    </>
  );
}

function PlanResult({ result }: { result: PlanChangeResult }) {
  const excess: [string, PlanExcessItem][] = [
    ["Ubicaciones activas", result.excess.locations],
    ["Servicios activos", result.excess.services],
  ];
  const exceeded = excess.filter(([, e]) => e.exceeded);

  return (
    <div className="space-y-3 text-sm">
      <p className="font-semibold">
        {result.changed
          ? `Plan cambiado de ${planLabel(result.fromPlan)} a ${planLabel(result.toPlan)}.`
          : `Ya tenía el plan ${planLabel(result.toPlan)}: no se cambió nada.`}
      </p>
      {result.tokenAdjustment && (
        <p className="text-muted-foreground">{TOKEN_TEXT[result.tokenAdjustment]}</p>
      )}
      {exceeded.length > 0 ? (
        <div className="rounded-md bg-status-cancelled-bg px-3 py-2 text-status-cancelled">
          <p className="font-semibold">Excede el plan nuevo:</p>
          <ul className="mt-1 list-disc pl-5">
            {exceeded.map(([label, e]) => (
              <li key={label}>
                {label}: {e.active} (el plan nuevo permite {e.max})
              </li>
            ))}
          </ul>
          <p className="mt-2">
            Todo lo activo sigue funcionando; solo no podrá crear ni reactivar más hasta quedar
            dentro del límite.
          </p>
        </div>
      ) : (
        <p className="text-status-confirmed">Todo lo activo cabe en el plan nuevo.</p>
      )}
    </div>
  );
}
