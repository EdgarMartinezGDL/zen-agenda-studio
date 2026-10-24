import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Banner } from "@/components/Banner";
import { Confirm } from "@/components/Confirm";
import { Modal } from "@/components/Modal";
import { Field, inputCls } from "@/routes/index";
import { eventsApi, type CreateEventInput } from "@/lib/microfix/api";
import { useAuth } from "@/lib/microfix/auth";
import { compact, errorText } from "@/lib/microfix-ui";
import { toast } from "sonner";
import type { Event as ZenEvent, EventRegistration } from "@/types";

export const Route = createFileRoute("/eventos")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Talleres y eventos — Mi Agenda Zen" },
      { name: "description", content: "Administra talleres, eventos y sus inscritos." },
      { property: "og:title", content: "Talleres y eventos — Mi Agenda Zen" },
      { property: "og:description", content: "Administra talleres, eventos y sus inscritos." },
    ],
  }),
  component: () => (
    <AppShell>
      <EventosPage />
    </AppShell>
  ),
});

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function EventosPage() {
  const orgId = useAuth().user?.organizationId ?? "";
  const [editing, setEditing] = useState<ZenEvent | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["events", orgId],
    queryFn: () => eventsApi.list({ organizationId: orgId }) as unknown as Promise<ZenEvent[]>,
    enabled: !!orgId,
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-5 text-2xl font-bold tracking-tight">Talleres y eventos</h1>
      {error && <Banner kind="error" message={errorText(error)} />}
      {isLoading && <p className="text-sm text-muted-foreground">Cargando eventos…</p>}

      <ul className="space-y-3">
        {(data ?? []).map((ev) => (
          <li key={ev.id} className="card-zen p-4">
            <button
              onClick={() => setEditing(ev)}
              className="w-full text-left transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{ev.name}</p>
                  <p className="text-xs text-muted-foreground">{fmt(ev.startAt)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {ev.location?.name ?? ev.venueName ?? "Sin ubicación"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-full bg-status-confirmed-bg px-2.5 py-1 text-[11px] font-semibold text-status-confirmed">
                    {ev.bookedCount}/{ev.capacity}
                  </span>
                  {ev.bookedCount >= ev.capacity && (
                    <span className="rounded-full bg-status-pending-bg px-2 py-0.5 text-[10px] font-semibold text-status-pending">
                      Lleno
                    </span>
                  )}
                  {!ev.isActive && (
                    <span className="rounded-full bg-status-completed-bg px-2 py-0.5 text-[10px] font-semibold text-status-completed">
                      Inactivo
                    </span>
                  )}
                </div>
              </div>
            </button>
            {ev.mapsLink && (
              <a
                href={ev.mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-accent"
              >
                <MapPin className="h-3.5 w-3.5" />
                Ver ubicación en el mapa
              </a>
            )}
          </li>
        ))}
      </ul>

      <button
        onClick={() => setCreating(true)}
        className="mt-4 w-full rounded-lg border-2 border-dashed border-border px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        + Nuevo taller o evento
      </button>

      {(creating || editing) && (
        <EventModal
          orgId={orgId}
          event={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EventModal({
  orgId,
  event,
  onClose,
}: {
  orgId: string;
  event: ZenEvent | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(!!event);
  const [askUnlock, setAskUnlock] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [form, setForm] = useState({
    name: event?.name ?? "",
    description: event?.description ?? "",
    start: event ? event.startAt.slice(0, 16) : "",
    end: event ? event.endAt.slice(0, 16) : "",
    capacity: String(event?.capacity ?? 10),
    venueName: event?.venueName ?? "",
    venueAddress: event?.venueAddress ?? "",
    mapsLink: event?.mapsLink ?? "",
    requirements: event?.requirements ?? "",
    isActive: event?.isActive ?? true,
  });

  const done = () => {
    qc.invalidateQueries({ queryKey: ["events"] });
    onClose();
  };

  const save = useMutation({
    mutationFn: () => {
      const body = compact({
        name: form.name,
        description: form.description || undefined,
        startAt: new Date(form.start).toISOString(),
        endAt: new Date(form.end).toISOString(),
        capacity: Number(form.capacity),
        venueName: form.venueName || undefined,
        venueAddress: form.venueAddress || undefined,
        mapsLink: form.mapsLink.trim() || undefined,
        requirements: form.requirements || undefined,
        isActive: form.isActive,
      }) as Omit<CreateEventInput, "organizationId">;
      return event
        ? eventsApi.update(event.id, body)
        : eventsApi.create({ organizationId: orgId, ...body });
    },
    onSuccess: done,
    onError: (e: Error) => setError(errorText(e)),
  });

  const remove = useMutation({
    mutationFn: () => eventsApi.remove(event!.id),
    onSuccess: done,
    onError: (e: Error) => setError(errorText(e)),
  });

  const ro = `${inputCls} disabled:cursor-not-allowed disabled:bg-muted/40 disabled:opacity-80`;

  return (
    <Modal open onClose={onClose} title={event ? "Detalle del evento" : "Nuevo taller o evento"}>
      {error && <Banner kind="error" message={error} />}
      <div className="space-y-3">
        {event && locked && (
          <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Modo solo lectura. Pulsa “Modificar evento” para habilitar la edición.
          </p>
        )}
        <Field label="Nombre">
          <input
            className={ro}
            disabled={locked}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Descripción">
          <textarea
            rows={2}
            className={ro}
            disabled={locked}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Inicio">
            <input
              type="datetime-local"
              className={ro}
              disabled={locked}
              value={form.start}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
            />
          </Field>
          <Field label="Fin">
            <input
              type="datetime-local"
              className={ro}
              disabled={locked}
              value={form.end}
              onChange={(e) => setForm({ ...form, end: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Cupo">
          <input
            type="number"
            className={ro}
            disabled={locked}
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
          />
        </Field>
        <Field label="Lugar (nombre)">
          <input
            className={ro}
            disabled={locked}
            value={form.venueName}
            onChange={(e) => setForm({ ...form, venueName: e.target.value })}
          />
        </Field>
        <Field label="Dirección">
          <input
            className={ro}
            disabled={locked}
            value={form.venueAddress}
            onChange={(e) => setForm({ ...form, venueAddress: e.target.value })}
          />
        </Field>
        <div>
          <Field label="Enlace de Google Maps (opcional)">
            <input
              type="url"
              placeholder="https://maps.app.goo.gl/..."
              className={ro}
              disabled={locked}
              value={form.mapsLink}
              onChange={(e) => setForm({ ...form, mapsLink: e.target.value })}
            />
          </Field>
          <p className="mt-1 text-xs text-muted-foreground">
            Pega el enlace de ubicación para que los clientes puedan abrirlo directamente desde
            WhatsApp o el mapa.
          </p>
          {form.mapsLink.trim() && (
            <a
              href={form.mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-accent"
            >
              <MapPin className="h-3.5 w-3.5" />
              Abrir en el mapa
            </a>
          )}
        </div>
        <Field label="Requisitos">
          <textarea
            rows={2}
            className={ro}
            disabled={locked}
            value={form.requirements}
            onChange={(e) => setForm({ ...form, requirements: e.target.value })}
          />
        </Field>
        {event && (
          <label
            className={`flex items-center gap-2 text-sm font-semibold ${
              locked && form.isActive ? "text-primary" : ""
            }`}
          >
            <input
              type="checkbox"
              aria-readonly={locked}
              tabIndex={locked ? -1 : 0}
              checked={form.isActive}
              onChange={(e) => {
                if (locked) return;
                setForm({ ...form, isActive: e.target.checked });
              }}
              className={`h-4 w-4 accent-[var(--color-primary)] ${
                locked ? "pointer-events-none cursor-not-allowed" : ""
              }`}
            />
            Activo
          </label>
        )}

        {event && locked ? (
          <button
            onClick={() => setAskUnlock(true)}
            className="btn-primary flex w-full items-center justify-center gap-2 px-4 py-3 text-base"
          >
            <Pencil className="h-4 w-4" />
            Modificar evento
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="btn-primary flex-1 px-3 py-2.5 text-sm"
            >
              Guardar
            </button>
            {event && (
              <button
                aria-label="Eliminar evento"
                onClick={() => setAskDelete(true)}
                className="rounded-md border border-border px-3 py-2 text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {event && <Registrations eventId={event.id} capacity={event.capacity} />}
      </div>

      <Confirm
        open={askUnlock}
        large
        tone="primary"
        title="Habilitar edición"
        message="¿Deseas habilitar la edición de este evento?"
        confirmLabel="Sí, editar"
        cancelLabel="Cancelar"
        onCancel={() => setAskUnlock(false)}
        onConfirm={() => {
          setAskUnlock(false);
          setLocked(false);
        }}
      />

      <Confirm
        open={askDelete}
        message="Se eliminará este evento y sus inscripciones. Esta acción no se puede deshacer."
        pending={remove.isPending}
        onCancel={() => setAskDelete(false)}
        onConfirm={() => {
          setAskDelete(false);
          remove.mutate();
        }}
      />
    </Modal>
  );
}

function Registrations({ eventId, capacity }: { eventId: string; capacity: number }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [toCancel, setToCancel] = useState<EventRegistration | null>(null);

  const { data } = useQuery({
    queryKey: ["registrations", eventId],
    queryFn: () => eventsApi.registrations(eventId) as unknown as Promise<EventRegistration[]>,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["registrations", eventId] });

  const add = useMutation({
    mutationFn: () =>
      eventsApi.register(eventId, { clientName: name, clientPhone: phone }),
    onSuccess: () => {
      setName("");
      setPhone("");
      refresh();
      qc.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (e: Error) => toast.error(errorText(e)),
  });

  const cancel = useMutation({
    mutationFn: (regId: string) =>
      eventsApi.cancelRegistration(eventId, regId),
    onSuccess: () => {
      setToCancel(null);
      refresh();
      qc.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (e: Error) => toast.error(errorText(e)),
  });

  const confirmed = (data ?? []).filter((r) => r.status === "CONFIRMED");

  return (
    <div className="mt-5 rounded-[var(--radius)] border border-border bg-muted/30 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold">Personas inscritas</h3>
        <span className="rounded-full bg-status-confirmed-bg px-2.5 py-1 text-[11px] font-semibold text-status-confirmed">
          {confirmed.length}/{capacity}
        </span>
      </div>

      {confirmed.length === 0 ? (
        <p className="mb-3 text-xs text-muted-foreground">Aún no hay personas inscritas.</p>
      ) : (
        <ul className="mb-3 space-y-2">
          {confirmed.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-md bg-card px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">
                {r.clientName} · {r.clientPhone}
              </span>
              <button
                onClick={() => setToCancel(r)}
                className="shrink-0 text-xs font-semibold text-destructive"
              >
                Cancelar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
        <input placeholder="Nombre" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Teléfono" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button
          aria-label="Agregar inscrito"
          onClick={() => add.mutate()}
          className="btn-primary shrink-0 px-3"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <Confirm
        open={!!toCancel}
        large
        title="Cancelar inscripción"
        message={`¿Seguro que deseas cancelar la inscripción de esta persona${toCancel ? ` (${toCancel.clientName})` : ""}?`}
        confirmLabel="Sí, cancelar"
        cancelLabel="No, volver"
        pending={cancel.isPending}
        onCancel={() => setToCancel(null)}
        onConfirm={() => toCancel && cancel.mutate(toCancel.id)}
      />
    </div>
  );
}
