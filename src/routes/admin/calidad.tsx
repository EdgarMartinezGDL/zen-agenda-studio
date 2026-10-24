import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { AdminShell } from "@/components/AdminShell";
import { Banner } from "@/components/Banner";
import { planLabel } from "@/lib/admin-ui";
import { adminApi } from "@/lib/microfix/api";
import type { VerifierRejection } from "@/lib/microfix/types";
import { errorText } from "@/lib/microfix-ui";

export const Route = createFileRoute("/admin/calidad")({
  head: () => ({
    meta: [
      { title: "Calidad IA — Súper Panel" },
      { name: "description", content: "Respuestas de la IA bloqueadas por el verificador." },
      { property: "og:title", content: "Calidad IA — Súper Panel" },
      { property: "og:description", content: "Respuestas de la IA bloqueadas por el verificador." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminShell>
      <CalidadPage />
    </AdminShell>
  ),
});

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function planOf(r: VerifierRejection): string {
  if (r.profile === "DEMO") return "Demo";
  return r.planCode ? planLabel(r.planCode) : "Sin plan";
}

function CalidadPage() {
  const [orgId, setOrgId] = useState("");

  const { data: orgs } = useQuery({
    queryKey: ["admin", "organizations"],
    queryFn: adminApi.organizations,
  });
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "rejections", orgId],
    queryFn: () => adminApi.rejections(orgId || undefined),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Calidad IA</h1>
        <Button variant="ghost"
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label="Actualizar"
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Respuestas de la IA que el verificador bloqueó por dar un precio o una hora que no existe.
        El paciente recibió el texto seguro. Solo tú ves esta lista; el profesional no.
      </p>

      <section className="card-zen mb-5 p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
            Organización
          </span>
          <select
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
          >
            <option value="">Todas</option>
            {orgs?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error && <Banner kind="error" message={errorText(error)} />}
      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {data && data.length === 0 && (
        <p className="card-zen p-4 text-sm text-muted-foreground">
          Sin rechazos: la IA no ha intentado dar precios ni horarios que no existen.
        </p>
      )}
      {data && data.length > 0 && (
        <p className="mb-2 text-xs text-muted-foreground">
          Últimos {data.length} (máximo 50), más nuevos primero.
        </p>
      )}

      <div className="space-y-3">
        {data?.map((r) => (
          <article key={r.id} className="card-zen space-y-2 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {r.organizationName ?? "Organización borrada"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dateTime(r.createdAt)} · {planOf(r)}
                </p>
              </div>
              {r.paused && (
                <span className="rounded-full bg-status-cancelled-bg px-3 py-1 text-xs font-semibold text-status-cancelled">
                  Paciente en atención humana
                </span>
              )}
            </div>
            {r.unknownPrices.length > 0 && (
              <p className="text-sm">
                <span className="text-muted-foreground">Precios rechazados: </span>
                {r.unknownPrices.map((p, i) => (
                  <span
                    key={i}
                    className="mr-1 inline-block rounded bg-accent px-2 py-0.5 font-mono text-xs"
                  >
                    {p}
                  </span>
                ))}
              </p>
            )}
            {r.unknownTimes.length > 0 && (
              <p className="text-sm">
                <span className="text-muted-foreground">Horas rechazadas: </span>
                {r.unknownTimes.map((t, i) => (
                  <span
                    key={i}
                    className="mr-1 inline-block rounded bg-accent px-2 py-0.5 font-mono text-xs"
                  >
                    {t}
                  </span>
                ))}
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
