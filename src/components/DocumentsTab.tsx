import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Lock, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { Banner } from "@/components/Banner";
import { Confirm } from "@/components/Confirm";
import { knowledgeApi, organizationApi } from "@/lib/microfix/api";
import type {
  KnowledgeDocument,
  KnowledgeDocumentStatus,
  PlanFeatures,
} from "@/lib/microfix/types";
import { errorText } from "@/lib/microfix-ui";

// Fase 5, 5.6.5: documentos que la IA consulta (bloque 5.4b). Solo planes con
// documentos; los demás ven la pestaña bloqueada con la invitación a mejorar.
const MAX_FILE_MB = 20;
const ACCEPT = ".pdf,.txt,.md,application/pdf,text/plain,text/markdown";

const STATUS: Record<KnowledgeDocumentStatus, { label: string; cls: string }> = {
  PROCESSING: { label: "Procesando…", cls: "bg-gold/15 text-gold" },
  READY: { label: "Listo", cls: "bg-status-confirmed-bg text-status-confirmed" },
  FAILED: { label: "Error", cls: "bg-status-cancelled-bg text-status-cancelled" },
};

function lockedText(f: PlanFeatures): string {
  if (f.profile === "PAID" && f.planCode === "ESSENTIAL") {
    return "Tu plan Esencial no incluye documentos de consulta para la IA. Para usarlos, mejora tu plan de Mi Agenda Zen.";
  }
  if (f.profile === "DEMO") {
    return "Tu demo no incluye documentos de consulta para la IA. Para usarlos, mejora tu plan de Mi Agenda Zen.";
  }
  return "Tu plan no incluye documentos de consulta para la IA. Para usarlos, mejora tu plan de Mi Agenda Zen.";
}

// Menos de 1 MB en KB (un .txt pequeño no debe verse como "0 MB").
const mb = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toLocaleString("es-MX", { maximumFractionDigits: 1 })} MB`;
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });

export function DocumentsTab({ orgId }: { orgId: string }) {
  const { data: f, error: fError } = useQuery({
    queryKey: ["plan-features", orgId],
    queryFn: () => organizationApi.planFeatures(orgId),
    enabled: !!orgId,
  });

  if (fError) return <Banner kind="error" message={errorText(fError)} />;
  if (!f) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!f.ragEnabled) {
    return (
      <section className="card-zen flex items-start gap-3 p-5">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
        <div>
          <p className="font-semibold">Documentos para la IA</p>
          <p className="mt-1 text-sm text-muted-foreground">{lockedText(f)}</p>
        </div>
      </section>
    );
  }
  return <DocumentsManager orgId={orgId} />;
}

function DocumentsManager({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [toDelete, setToDelete] = useState<KnowledgeDocument | null>(null);

  const { data, error } = useQuery({
    queryKey: ["knowledge", orgId],
    queryFn: () => knowledgeApi.list(orgId),
    // Mientras haya archivos procesándose, se revisa cada 3 s.
    refetchInterval: (q) =>
      q.state.data?.documents.some((d) => d.status === "PROCESSING") ? 3_000 : false,
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["knowledge", orgId] });

  const upload = useMutation({
    mutationFn: (file: File) => knowledgeApi.upload(orgId, file),
    onSuccess: () => {
      toast.success("Archivo recibido: se está procesando.");
      refresh();
    },
    onError: (e) => toast.error(errorText(e)),
    onSettled: () => {
      if (inputRef.current) inputRef.current.value = "";
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => knowledgeApi.remove(orgId, id),
    onSuccess: () => {
      setToDelete(null);
      toast.success("Documento eliminado");
      refresh();
    },
    onError: (e) => {
      setToDelete(null);
      toast.error(errorText(e));
    },
  });

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`El archivo supera el máximo de ${MAX_FILE_MB} MB.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    upload.mutate(file);
  };

  const usage = data?.usage;

  return (
    <>
      <section className="card-zen space-y-3 p-4">
        <div>
          <p className="font-semibold">Documentos para la IA</p>
          <p className="text-xs text-muted-foreground">
            La IA los consulta para responder dudas de tus pacientes que no están en tus servicios
            ni en tus preguntas frecuentes. PDF con texto, .txt o .md, hasta {MAX_FILE_MB} MB cada
            uno.
          </p>
        </div>
        {usage && (
          <p className="text-sm">
            <span className="font-semibold">
              {usage.documents} de {usage.maxDocuments}
            </span>{" "}
            documentos · {mb(usage.bytes)} de {mb(usage.maxBytes)}
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button variant="ghost"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
        >
          <Upload className="h-4 w-4" />
          {upload.isPending ? "Subiendo…" : "Subir documento"}
        </Button>
      </section>

      {error && <Banner kind="error" message={errorText(error)} />}
      {data && data.documents.length === 0 && (
        <p className="card-zen mt-4 p-4 text-sm text-muted-foreground">
          Aún no has subido documentos.
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {data?.documents.map((d) => (
          <li key={d.id} className="card-zen flex items-start gap-3 p-4">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{d.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {mb(d.sizeBytes)} · {day(d.createdAt)}
              </p>
              {d.status === "FAILED" && d.failureReason && (
                <p className="mt-1 text-sm text-status-cancelled">{d.failureReason}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS[d.status].cls}`}
              >
                {STATUS[d.status].label}
              </span>
              <Button variant="ghost"
                onClick={() => setToDelete(d)}
                aria-label={`Eliminar ${d.fileName}`}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-status-cancelled"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Confirm
        open={!!toDelete}
        message={`Se eliminará "${toDelete?.fileName ?? ""}" y la IA dejará de consultarlo.`}
        pending={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
