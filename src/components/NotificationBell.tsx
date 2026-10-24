import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CalendarClock, CalendarPlus, CalendarX, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { notificationsApi } from "@/lib/microfix/api";
import type { AppNotification } from "@/lib/microfix/types";

const ICON = { created: CalendarPlus, cancelled: CalendarX, rescheduled: CalendarClock } as const;
const ICON_CLASS = {
  created: "text-status-confirmed",
  cancelled: "text-status-cancelled",
  rescheduled: "text-gold",
} as const;

// "AAAA-MM-DD" del día de la cita en la hora local (la agenda también usa la local).
const localDay = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function ago(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export function NotificationBell({ orgId, full = false, autoOpen = false }: {
  orgId: string;
  full?: boolean;
  /** Abrir el panel al montar desde un aviso push. */
  autoOpen?: boolean;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  const { data: unread } = useQuery({
    queryKey: ["notifications-unread", orgId],
    queryFn: () => notificationsApi.unreadCount(),
    enabled: !!orgId,
    refetchInterval: 20_000,
  });
  const count = unread?.count ?? 0;

  const list = useInfiniteQuery({
    queryKey: ["notifications", orgId],
    queryFn: ({ pageParam }) => notificationsApi.list({ limit: 20, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!orgId && open,
    refetchInterval: open ? 20_000 : false,
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["notifications-unread", orgId] });
      qc.invalidateQueries({ queryKey: ["notifications", orgId] });
    },
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const openNotification = (n: AppNotification) => {
    if (!n.read) markRead.mutate(n.id);
    setOpen(false);
    if (n.startAt) navigate({ to: "/", search: { dia: localDay(n.startAt) } });
  };

  const badge =
    count > 0 ? (
      // top-0.5: con -top-1 se salía de la cabecera móvil (h-16) y el borde de
      // la pantalla lo recortaba. Anclado al centro de la campana (left-1/2)
      // para que "99+" crezca hacia la derecha sin tapar el ícono.
      <span className="pointer-events-none absolute left-1/2 top-0.5 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold leading-none tabular-nums text-destructive-foreground ring-2 ring-card">
        {count > 99 ? "99+" : count}
      </span>
    ) : null;
  const label = count > 0 ? `Notificaciones (${count} sin leer)` : "Notificaciones";

  return (
    <>
      {full ? (
        <button
          onClick={() => setOpen(true)}
          aria-label={label}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Bell className="h-4 w-4 text-gold" />
          <span className="flex-1 text-left">Notificaciones</span>
          {count > 0 && (
            <span className="rounded-full bg-destructive px-2 py-0.5 text-[11px] font-bold leading-none text-destructive-foreground">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label={label}
          className="relative mr-1 overflow-visible rounded-md px-1.5 pb-1 pt-2 text-foreground transition-colors hover:bg-accent"
        >
          <Bell className="h-6 w-6" />
          {badge}
        </button>
      )}

      {/* En <body>: dentro de la cabecera o la barra lateral quedaría atrapado en su capa. */}
      {open && createPortal(
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-label="Notificaciones"
            className="absolute inset-x-2 top-2 flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl md:inset-x-auto md:left-[17rem] md:top-4 md:w-96"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-bold">Notificaciones</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar notificaciones"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {list.isLoading ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Cargando…</p>
              ) : list.isError ? (
                <p className="p-6 text-center text-sm text-destructive">No se pudieron cargar las notificaciones.</p>
              ) : items.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">No tienes notificaciones.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((n) => {
                    const Icon = ICON[n.type];
                    return (
                      <li key={n.id}>
                        <button
                          onClick={() => openNotification(n)}
                          className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent ${
                            n.read ? "" : "bg-primary/5"
                          }`}
                        >
                          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${ICON_CLASS[n.type]}`} />
                          <span className="min-w-0 flex-1">
                            <span className={`block text-sm ${n.read ? "font-medium text-muted-foreground" : "font-bold text-foreground"}`}>
                              {n.title}
                            </span>
                            <span className="mt-0.5 block text-sm text-muted-foreground">{n.message}</span>
                            <span className="mt-1 block text-xs text-muted-foreground">{ago(n.createdAt)}</span>
                          </span>
                          {!n.read && <span aria-label="Sin leer" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {list.hasNextPage && (
                <div className="p-3 text-center">
                  <button
                    onClick={() => list.fetchNextPage()}
                    disabled={list.isFetchingNextPage}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-60"
                  >
                    {list.isFetchingNextPage ? "Cargando…" : "Ver más"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
