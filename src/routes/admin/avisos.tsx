import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Ban, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

import { AdminShell } from "@/components/AdminShell";
import { Banner } from "@/components/Banner";
import { adminApi } from "@/lib/microfix/api";
import { errorText } from "@/lib/microfix-ui";

export const Route = createFileRoute("/admin/avisos")({
  head: () => ({
    meta: [
      { title: "Avisos — Súper Panel" },
      { name: "description", content: "Clínicas que quedaron suspendidas por falta de pago." },
      { property: "og:title", content: "Avisos — Súper Panel" },
      {
        property: "og:description",
        content: "Clínicas que quedaron suspendidas por falta de pago.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminShell>
      <AvisosPage />
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

// Fase 6, 6.5: cada vez que una clínica pasa a SUSPENDED (pierde el servicio).
function AvisosPage() {
  const qc = useQueryClient();
  const list = useInfiniteQuery({
    queryKey: ["admin", "billing-notices"],
    queryFn: ({ pageParam }) => adminApi.billingNotices({ limit: 20, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: 30_000,
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const unread = list.data?.pages[0]?.unreadCount ?? 0;

  const markRead = useMutation({
    mutationFn: (id: string) => adminApi.markBillingNoticeRead(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["admin", "billing-notices"] });
      qc.invalidateQueries({ queryKey: ["admin", "billing-notices-unread"] });
    },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Avisos</h1>
        <Button
          variant="ghost"
          onClick={() => void list.refetch()}
          disabled={list.isFetching}
          aria-label="Actualizar"
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${list.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Clínicas que quedaron suspendidas: su asistente virtual dejó de atender a sus pacientes
        hasta que regularicen su pago.
        {unread > 0 && <span className="font-semibold text-foreground"> {unread} sin leer.</span>}
      </p>

      {list.error && <Banner kind="error" message={errorText(list.error)} />}
      {markRead.error && <Banner kind="error" message={errorText(markRead.error)} />}
      {list.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {list.data && items.length === 0 && (
        <p className="card-zen p-4 text-sm text-muted-foreground">
          Sin avisos: ninguna clínica ha quedado suspendida.
        </p>
      )}

      <div className="space-y-3">
        {items.map((n) => (
          <article
            key={n.id}
            className={`card-zen flex flex-wrap items-start gap-x-3 gap-y-2 p-4 ${n.read ? "" : "ring-1 ring-destructive/40"}`}
          >
            <Ban className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            {/* En celular el botón baja debajo del texto para no apretarlo. */}
            <div className="min-w-0 flex-1 basis-[calc(100%-2rem)] sm:basis-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold">{n.organizationName}</p>
                {!n.read && (
                  <span className="rounded-full bg-status-cancelled-bg px-2 py-0.5 text-[11px] font-semibold text-status-cancelled">
                    Nuevo
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">{dateTime(n.createdAt)}</p>
            </div>
            {!n.read && (
              <Button
                variant="outline"
                size="sm"
                className="ml-8 sm:ml-0"
                onClick={() => markRead.mutate(n.id)}
                disabled={markRead.isPending && markRead.variables === n.id}
              >
                Marcar como leído
              </Button>
            )}
          </article>
        ))}
      </div>

      {list.hasNextPage && (
        <div className="mt-4 text-center">
          <Button
            variant="outline"
            onClick={() => void list.fetchNextPage()}
            disabled={list.isFetchingNextPage}
          >
            {list.isFetchingNextPage ? "Cargando…" : "Ver más"}
          </Button>
        </div>
      )}
    </div>
  );
}
