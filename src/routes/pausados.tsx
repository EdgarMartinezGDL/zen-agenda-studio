import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Pause, Play, RefreshCw } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

import { Banner } from "@/components/Banner";
import { pausedApi } from "@/lib/microfix/api";
import { useAuth } from "@/lib/microfix/auth";
import type { PausedConversation } from "@/lib/microfix/types";
import { errorText } from "@/lib/microfix-ui";

export const Route = createFileRoute("/pausados")({
  head: () => ({
    meta: [
      { title: "Conversaciones en pausa — Mi Agenda Zen" },
      { property: "og:title", content: "Conversaciones en pausa — Mi Agenda Zen" },
      { property: "og:description", content: "Pacientes que esperan tu respuesta por WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "description", content: "Pacientes que esperan tu respuesta por WhatsApp." },
    ],
  }),
  component: () => (
    <AppShell>
      <PausadosPage />
    </AppShell>
  ),
});

const ORIGIN: Record<PausedConversation["origin"], string> = {
  BOT: "La IA pidió tu ayuda",
  WHATSAPP: "Pausada desde tu WhatsApp",
  PANEL: "Pausada desde el panel",
};

const inputCls =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

function PausadosPage() {
  const orgId = useAuth().user?.organizationId ?? "";
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["paused", orgId],
    queryFn: () => pausedApi.list(orgId),
    enabled: !!orgId,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["paused", orgId] });

  const resume = useMutation({
    mutationFn: (p: string) => pausedApi.resume(orgId, p),
    onSuccess: () => {
      toast.success("La IA vuelve a responder a este paciente.");
      refresh();
    },
    onError: (e) => toast.error(errorText(e)),
  });
  const pause = useMutation({
    mutationFn: (p: string) => pausedApi.pause(orgId, p),
    onSuccess: (r) => {
      setPhone("");
      toast.success(
        r.changed ? "Listo: la IA ya no responde a ese número." : "Ese número ya estaba en pausa.",
      );
      refresh();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    pause.mutate(phone.trim());
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Hoy
      </Link>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Conversaciones en pausa</h1>
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
        La IA no responde a estos pacientes: te esperan a ti por WhatsApp. Cuando termines, reanuda
        la IA.
      </p>

      {error && <Banner kind="error" message={errorText(error)} />}
      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {data && data.length === 0 && (
        <p className="card-zen p-4 text-sm text-muted-foreground">
          Nadie está esperando: la IA atiende a todos.
        </p>
      )}

      <ul className="space-y-3">
        {data?.map((c) => (
          <li key={c.id} className="card-zen flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate font-semibold">{c.name ?? "Paciente sin nombre"}</p>
              <p className="text-sm text-muted-foreground">{c.phone}</p>
              <p className="text-xs text-muted-foreground">
                {ORIGIN[c.origin]} · desde {dateTime(c.pausedAt)}
              </p>
            </div>
            <Button variant="ghost"
              onClick={() => resume.mutate(c.phone)}
              disabled={resume.isPending}
              className="btn-3d btn-3d-primary flex items-center gap-2 px-3 py-2 text-sm disabled:opacity-60"
            >
              <Play className="h-4 w-4" />
              Reanudar IA
            </Button>
          </li>
        ))}
      </ul>

      <section className="card-zen mt-6 p-4">
        <p className="font-semibold">Pausar a un paciente</p>
        <p className="mb-3 text-xs text-muted-foreground">
          La IA deja de responder a ese número hasta que la reanudes aquí o con el comando de
          WhatsApp.
        </p>
        {pause.error && <Banner kind="error" message={errorText(pause.error)} />}
        <form onSubmit={submit} className="flex flex-wrap gap-2">
          <input
            className={`${inputCls} min-w-[12rem] flex-1`}
            type="tel"
            required
            placeholder="+5215512345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Button variant="ghost"
            type="submit"
            disabled={pause.isPending}
            className="btn-3d btn-3d-warning flex items-center gap-2 px-3 py-2 text-sm disabled:opacity-60"
          >
            <Pause className="h-4 w-4" />
            Pausar IA
          </Button>
        </form>
      </section>
    </div>
  );
}
