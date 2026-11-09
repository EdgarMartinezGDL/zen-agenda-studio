// E1.2 — Plantillas de Meta de una organización (solo Súper Admin).
// Sin estas plantillas aprobadas, los avisos a pacientes fuera de la ventana de 24 h
// (confirmación desde el panel, recordatorio, reagenda y cancelación) no salen.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { Banner } from "@/components/Banner";
import { Modal } from "@/components/Modal";
import { adminApi } from "@/lib/microfix/api";
import type {
  TemplateRefreshOutcome,
  TemplateSendStatus,
  TemplateSubmitOutcome,
} from "@/lib/microfix/types";
import { errorText } from "@/lib/microfix-ui";

const API_URL = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:3000";
export const YCLOUD_WEBHOOK_URL = `${API_URL.replace(/\/+$/, "")}/webhooks/ycloud`;

export const TEMPLATE_LABEL: Record<string, string> = {
  cita_confirmada_v1: "Cita confirmada",
  cita_recordatorio_v1: "Recordatorio de cita",
  cita_reagendada_v1: "Cita reagendada",
  cita_cancelada_v1: "Cita cancelada",
  cita_cancelada_motivo_v1: "Cita cancelada (con motivo)",
};
const label = (name: string) => TEMPLATE_LABEL[name] ?? name;

const SEND_STATUS: Record<TemplateSendStatus, { text: string; cls: string }> = {
  APPROVED: { text: "Aprobada", cls: "bg-status-confirmed-bg text-status-confirmed" },
  PENDING: { text: "En revisión", cls: "bg-status-pending-bg text-status-pending" },
  MISSING: { text: "Falta dar de alta", cls: "bg-muted text-muted-foreground" },
  UNUSABLE: { text: "Rechazada", cls: "bg-status-cancelled-bg text-status-cancelled" },
};

const RESULT_TEXT: Record<string, string> = {
  SUBMITTED: "enviada a revisión",
  EXISTING: "ya estaba en YCloud",
  UPDATED: "estado actualizado",
  FAILED: "no se pudo",
};

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

/** Resultado de un alta o una actualización, plantilla por plantilla. */
export function TemplateOutcomes({
  outcomes,
  error,
}: {
  outcomes: (TemplateSubmitOutcome | TemplateRefreshOutcome)[];
  error?: string | undefined;
}) {
  return (
    <div className="space-y-2 text-sm">
      {error && <Banner kind="error" message={error} />}
      {outcomes.length === 0 && !error && (
        <p className="text-muted-foreground">No había plantillas pendientes de dar de alta.</p>
      )}
      {outcomes.length > 0 && (
        <ul className="space-y-1">
          {outcomes.map((o) => (
            <li key={o.name} className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-medium">{label(o.name)}</span>
              <span
                className={
                  o.result === "FAILED" ? "text-status-cancelled" : "text-muted-foreground"
                }
              >
                {RESULT_TEXT[o.result] ?? o.result}
                {o.result === "FAILED" ? `: ${o.error}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WhatsAppTemplatesModal({
  org,
  onClose,
}: {
  org: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const queryKey = ["admin", "whatsapp-templates", org?.id ?? ""];
  const [last, setLast] = useState<{
    title: string;
    outcomes: (TemplateSubmitOutcome | TemplateRefreshOutcome)[];
  } | null>(null);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey,
    queryFn: () => {
      if (!org) throw new Error("No hay organización seleccionada");
      return adminApi.whatsappTemplates(org.id);
    },
    enabled: !!org,
  });

  const done =
    (title: string) => (r: { outcomes: (TemplateSubmitOutcome | TemplateRefreshOutcome)[] }) => {
      setLast({ title, outcomes: r.outcomes });
      void queryClient.invalidateQueries({ queryKey });
    };
  const submit = useMutation({
    mutationFn: () => {
      if (!org) throw new Error("No hay organización seleccionada");
      return adminApi.submitWhatsappTemplates(org.id);
    },
    onSuccess: done("Alta de plantillas"),
    onError: (e) => toast.error(errorText(e)),
  });
  const refresh = useMutation({
    mutationFn: () => {
      if (!org) throw new Error("No hay organización seleccionada");
      return adminApi.refreshWhatsappTemplates(org.id);
    },
    onSuccess: done("Estado actualizado desde YCloud"),
    onError: (e) => toast.error(errorText(e)),
  });

  const close = () => {
    setLast(null);
    onClose();
  };
  const copyUrl = () => {
    void navigator.clipboard
      ?.writeText(YCLOUD_WEBHOOK_URL)
      .then(() => toast.success("URL copiada"))
      .catch(() => toast.error("No se pudo copiar; selecciónala a mano"));
  };

  const missing = data?.templates.filter((t) => t.sendStatus === "MISSING").length ?? 0;
  const approved = data?.templates.filter((t) => t.sendStatus === "APPROVED").length ?? 0;
  const busy = submit.isPending || refresh.isPending;

  return (
    <Modal open={!!org} onClose={close} title={`Plantillas de WhatsApp: ${org?.name ?? ""}`}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Meta debe aprobar estas plantillas para que salgan los avisos a pacientes (confirmación
          desde el panel, recordatorio, reagenda y cancelación). La revisión tarda hasta 24 h;
          mientras tanto los avisos esperan.
        </p>

        {error && <Banner kind="error" message={errorText(error)} />}
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}

        {data && !data.ready && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            Esta organización todavía no usa WhatsApp oficial (YCloud). Las plantillas se dan de
            alta solas al convertirla en cliente.
          </p>
        )}

        {data && (
          <>
            <p className="text-sm font-semibold">
              {approved} de {data.templates.length} aprobadas
              {isFetching && (
                <span className="ml-2 font-normal text-muted-foreground">actualizando…</span>
              )}
            </p>
            <ul className="divide-y divide-border rounded-md border border-border">
              {data.templates.map((t) => {
                const s = SEND_STATUS[t.sendStatus];
                return (
                  <li key={t.name} className="space-y-1 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">{label(t.name)}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>
                        {t.sendStatus === "UNUSABLE" && t.status && t.status !== "REJECTED"
                          ? `No disponible (${t.status})`
                          : s.text}
                      </span>
                    </div>
                    {t.reason && t.sendStatus !== "APPROVED" && (
                      <p className="text-xs text-status-cancelled">Motivo de Meta: {t.reason}</p>
                    )}
                    {(t.reviewedAt || t.submittedAt) && (
                      <p className="text-xs text-muted-foreground">
                        {t.reviewedAt
                          ? `Revisada: ${dateTime(t.reviewedAt)}`
                          : t.submittedAt ? `Enviada a revisión: ${dateTime(t.submittedAt)}` : null}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>

            {data.ready && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  onClick={() => submit.mutate()}
                  disabled={busy || missing === 0}
                  className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
                >
                  {submit.isPending
                    ? "Dando de alta…"
                    : `Dar de alta las que faltan${missing ? ` (${missing})` : ""}`}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => refresh.mutate()}
                  disabled={busy}
                  className="btn-3d btn-3d-primary flex items-center gap-2 px-3 py-2 text-sm disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${refresh.isPending ? "animate-spin" : ""}`} />
                  Actualizar estado
                </Button>
              </div>
            )}

            {last && (
              <div className="rounded-md bg-accent px-3 py-2">
                <p className="mb-1 text-sm font-semibold">{last.title}</p>
                <TemplateOutcomes outcomes={last.outcomes} />
              </div>
            )}
          </>
        )}

        <div className="space-y-2 border-t border-border pt-3 text-sm">
          <p className="font-semibold">Pasos en YCloud (una vez por cliente)</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>
              En YCloud, crea un webhook con esta URL:
              <span className="mt-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded bg-muted px-2 py-1 text-xs text-foreground">
                  {YCLOUD_WEBHOOK_URL}
                </code>
                <Button
                  variant="ghost"
                  onClick={copyUrl}
                  aria-label="Copiar URL"
                  className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </span>
            </li>
            <li>
              Suscríbelo a <code className="text-xs">whatsapp.inbound_message.received</code>,{" "}
              <code className="text-xs">whatsapp.message.updated</code> y{" "}
              <code className="text-xs">whatsapp.template.reviewed</code>.
            </li>
            <li>Su secreto de firma es el que se captura en «Convertir a cliente».</li>
            <li>
              Al convertir, las plantillas se dan de alta solas; aquí ves cuándo Meta las aprueba.
            </li>
          </ol>
        </div>

        <Button variant="ghost" onClick={close} className="btn-primary w-full px-4 py-2 text-sm">
          Cerrar
        </Button>
      </div>
    </Modal>
  );
}
