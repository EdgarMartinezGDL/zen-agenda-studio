import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { PausedBanner } from "@/components/PausedBanner";
import { Banner } from "@/components/Banner";
import { Confirm } from "@/components/Confirm";
import { Modal } from "@/components/Modal";
import { appointmentsApi, organizationApi } from "@/lib/microfix/api";
import { useAuth } from "@/lib/microfix/auth";
import { ApiError } from "@/lib/microfix/client";
import type { SlotFullError } from "@/lib/microfix/types";
import { errorText } from "@/lib/microfix-ui";
import type { Appointment, AppointmentStatus, OrganizationContext } from "@/types";

export const Route = createFileRoute("/")({
  // ?dia=AAAA-MM-DD abre la agenda en ese día (lo usa el Centro de Notificaciones).
  validateSearch: (
    search: Record<string, unknown>,
  ): { dia?: string; abrir?: "notificaciones" | "pausados" } => {
    const dia = search["dia"];
    const abrir = search["abrir"];
    return {
      ...(typeof dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? { dia } : {}),
      ...(abrir === "notificaciones" || abrir === "pausados" ? { abrir } : {}),
    };
  },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Agenda del día — Mi Agenda Zen" },
      {
        name: "description",
        content: "Consulta y gestiona las citas de tu consultorio día por día.",
      },
      { property: "og:title", content: "Agenda del día — Mi Agenda Zen" },
      {
        property: "og:description",
        content: "Consulta y gestiona las citas de tu consultorio día por día.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <HoyPage />
    </AppShell>
  ),
});

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
  ASISTIO: "Asistió",
  NO_ASISTIO: "No asistió",
  REAGENDADA: "Reagendada",
};

const STATUS_CLASS: Record<AppointmentStatus, string> = {
  PENDING: "bg-status-pending-bg text-status-pending",
  CONFIRMED: "bg-status-confirmed-bg text-status-confirmed",
  CANCELLED: "bg-status-cancelled-bg text-status-cancelled",
  COMPLETED: "bg-status-completed-bg text-status-completed",
  ASISTIO: "bg-status-confirmed-bg text-status-confirmed",
  NO_ASISTIO: "bg-status-cancelled-bg text-status-cancelled",
  REAGENDADA: "bg-status-pending-bg text-status-pending",
};

const fmtDate = (d: Date) =>
  d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function HoyPage() {
  const orgId = useAuth().user?.organizationId ?? "";
  const qc = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [detail, setDetail] = useState<Appointment | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const { dia } = Route.useSearch();
  const navigate = useNavigate();

  // Llegó ?dia=: se salta a ese día y se limpia la URL.
  useEffect(() => {
    if (!dia) return;
    const [y = 0, m = 1, d = 1] = dia.split("-").map(Number);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setOffset(Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86_400_000));
    navigate({ to: "/", search: {}, replace: true });
  }, [dia, navigate]);

  const { day, from, to } = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return { day: d, from: d.toISOString(), to: end.toISOString() };
  }, [offset]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["appointments", orgId, isoDay(day)],
    queryFn: () =>
      appointmentsApi.list({ organizationId: orgId, from, to }) as unknown as Promise<Appointment[]>,
    enabled: !!orgId,
    refetchInterval: 20_000,
  });

  const appointments = data ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <PausedBanner orgId={orgId} />
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">{offset === 0 ? "Hoy" : "Agenda"}</h1>
        <div className="mt-3 flex items-center gap-2">
          <button
            aria-label="Día anterior"
            onClick={() => setOffset((o) => o - 1)}
            className="rounded-md border border-border p-2 transition-colors hover:bg-accent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="flex-1 text-center text-xl font-bold capitalize tracking-tight md:text-2xl">
            {fmtDate(day)}
          </p>
          {offset !== 0 && (
            <button
              onClick={() => setOffset(0)}
              className="btn-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              Hoy
            </button>
          )}
          <button
            aria-label="Día siguiente"
            onClick={() => setOffset((o) => o + 1)}
            className="rounded-md border border-border p-2 transition-colors hover:bg-accent"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      {error && <Banner kind="error" message={errorText(error)} />}
      {isLoading && <p className="text-sm text-muted-foreground">Cargando citas…</p>}
      {!isLoading && !error && appointments.length === 0 && (
        <div className="card-zen p-8 text-center text-sm text-muted-foreground">
          No hay citas para este día.
        </div>
      )}

      <ul className="space-y-3">
        {appointments.map((a) => (
          <li key={a.id}>
            <button
              onClick={() => setDetail(a)}
              className="card-zen grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4 text-left transition-colors hover:bg-accent/40"
            >
              <span className="shrink-0 text-sm font-bold text-primary">{fmtTime(a.startAt)}</span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{a.clientName}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {a.service?.name ?? "Sin servicio"} · {a.location?.name ?? "Sin ubicación"}
                </span>
              </span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_CLASS[a.status]}`}
              >
                {STATUS_LABEL[a.status]}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <button
        aria-label="Nueva cita"
        onClick={() => setNewOpen(true)}
        className="fixed right-5 bottom-24 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 md:bottom-8"
      >
        <Plus className="h-6 w-6" />
      </button>

      <DetailModal
        appointment={detail}
        onClose={() => setDetail(null)}
        onDone={() => {
          setDetail(null);
          qc.invalidateQueries({ queryKey: ["appointments"] });
        }}
      />
      <NewAppointmentModal
        open={newOpen}
        orgId={orgId}
        onClose={() => setNewOpen(false)}
        onDone={() => {
          setNewOpen(false);
          qc.invalidateQueries({ queryKey: ["appointments"] });
        }}
      />
    </div>
  );
}

function DetailModal({
  appointment,
  onClose,
  onDone,
}: {
  appointment: Appointment | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [view, setView] = useState<"detail" | "reschedule" | "cancel">("detail");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"attended" | "noshow" | "reschedule" | null>(null);

  const close = () => {
    setView("detail");
    setConfirm(null);
    setError(null);
    onClose();
  };

  const statusM = useMutation({
    mutationFn: (status: AppointmentStatus) =>
      appointmentsApi.setStatus(appointment!.id, status as "ASISTIO" | "NO_ASISTIO"),
    onSuccess: onDone,
    onError: (e: Error) => setError(errorText(e)),
  });

  const cancelM = useMutation({
    mutationFn: () =>
      appointmentsApi.cancel(appointment!.id, reason || undefined),
    onSuccess: onDone,
    onError: (e: Error) => setError(errorText(e)),
  });

  const rescheduleM = useMutation({
    mutationFn: () => {
      const start = new Date(`${date}T${time}`);
      const duration =
        new Date(appointment!.endAt).getTime() - new Date(appointment!.startAt).getTime();
      return appointmentsApi.reschedule(appointment!.id, {
        startAt: start.toISOString(),
        endAt: new Date(start.getTime() + duration).toISOString(),
      });
    },
    onSuccess: onDone,
    onError: (e: Error) => setError(errorText(e)),
  });

  const dayAppts = useQuery({
    queryKey: ["appointments-day", appointment?.organizationId ?? "", date],
    enabled: view === "reschedule" && !!date && !!appointment,
    refetchInterval: 20_000,
    queryFn: () => {
      const from = new Date(`${date}T00:00:00`);
      const to = new Date(`${date}T23:59:59`);
      return appointmentsApi.list({
        organizationId: appointment!.organizationId,
        from: from.toISOString(),
        to: to.toISOString(),
      }) as unknown as Promise<Appointment[]>;
    },
  });

  const duration = appointment
    ? new Date(appointment.endAt).getTime() - new Date(appointment.startAt).getTime()
    : 0;

  const hasCollision = useMemo(() => {
    if (!date || !time || !appointment || !dayAppts.data) return false;
    const start = new Date(`${date}T${time}`).getTime();
    const end = start + duration;
    return dayAppts.data.some((a) => {
      if (a.id === appointment.id) return false;
      if (a.status === "CANCELLED") return false;
      const s = new Date(a.startAt).getTime();
      const e = new Date(a.endAt).getTime();
      return start < e && s < end;
    });
  }, [date, time, appointment, dayAppts.data, duration]);

  const ctx = useQuery({
    queryKey: ["org-context", appointment?.organizationId ?? ""],
    queryFn: () =>
      organizationApi.context(appointment!.organizationId) as unknown as Promise<OrganizationContext>,
    enabled: !!appointment,
  });

  const price = ctx.data?.services
    .find((s) => s.id === appointment?.serviceId)
    ?.serviceLocations?.find((sl) => sl.locationId === appointment?.locationId)?.price;


  if (!appointment) return null;


  return (
    <>
    <Modal open onClose={close} title="Detalle de la cita" size="lg">
      {error && <Banner kind="error" message={error} />}

      {view === "detail" && (
        <div className="space-y-1">
          <Row label="Cliente" value={appointment.clientName} />
          <Row label="Teléfono" value={appointment.clientPhone} />
          <Row label="Edad" value={appointment.age ? String(appointment.age) : "—"} />
          <Row label="Servicio" value={appointment.service?.name ?? "—"} />
          <Row label="Ubicación" value={appointment.location?.name ?? "—"} />
          <Row
            label="Fecha"
            value={`${fmtDate(new Date(appointment.startAt))} · ${fmtTime(appointment.startAt)}`}
          />
          <Row label="Notas" value={appointment.notes ?? "—"} />
          <div className="grid grid-cols-1 gap-3 pt-5 sm:grid-cols-2">
            <button
              onClick={() => setConfirm("attended")}
              className="btn-3d btn-3d-primary px-4 py-3.5 text-base"
            >
              Paciente Asistió
            </button>
            <button
              onClick={() => setConfirm("noshow")}
              className="btn-3d btn-3d-warning px-4 py-3.5 text-base"
            >
              No Asistió
            </button>
            <button
              onClick={() => setConfirm("reschedule")}
              className="btn-3d btn-3d-info px-4 py-3.5 text-base"
            >
              Reagendar
            </button>
            <button
              onClick={() => setView("cancel")}
              className="btn-3d btn-3d-danger px-4 py-3.5 text-base"
            >
              Cancelar Cita
            </button>
          </div>
        </div>
      )}

      {view === "reschedule" && (
        <div className="space-y-4">
          <div className="card-zen space-y-1 p-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Datos que se conservan
            </p>
            <p className="text-lg font-bold leading-snug">{appointment.clientName}</p>
            <p className="text-base text-muted-foreground">{appointment.clientPhone}</p>
            <p className="text-base">
              {appointment.service?.name ?? "Sin servicio"}
              {typeof price === "number" && (
                <span className="font-semibold text-gold"> · ${price}</span>
              )}
            </p>
            <p className="text-base text-muted-foreground">
              {appointment.location?.name ?? "Sin ubicación"}
            </p>
          </div>

          <Field label="Nueva fecha">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Nueva hora">
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
          </Field>
          {hasCollision && (
            <p className="rounded-xl border border-status-pending/40 bg-status-pending-bg px-3 py-2 text-base font-semibold text-status-pending">
              Aviso: Ya tienes una cita programada en este horario.
            </p>
          )}
          <button
            disabled={!date || !time || rescheduleM.isPending}
            onClick={() => rescheduleM.mutate()}
            className="w-full btn-primary px-5 py-3.5 text-lg font-bold text-primary-foreground disabled:opacity-60"
          >
            Confirmar nueva fecha
          </button>
        </div>
      )}


      {view === "cancel" && (
        <div className="space-y-3">
          <Field label="Motivo (opcional)">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className={`${inputCls} text-lg`}
            />
          </Field>
          <button
            disabled={cancelM.isPending}
            onClick={() => cancelM.mutate()}
            className="btn-3d btn-3d-danger w-full px-5 py-3.5 text-lg"
          >
            Confirmar cancelación
          </button>
        </div>
      )}
    </Modal>

    <Confirm
      open={confirm === "attended"}
      large
      tone="primary"
      title="Confirmar asistencia"
      message="¿Confirmar asistencia? El valor de esta cita se registrará en tus ingresos."
      confirmLabel="Confirmar Asistencia"
      pending={statusM.isPending}
      onCancel={() => setConfirm(null)}
      onConfirm={() => {
        setConfirm(null);
        statusM.mutate("ASISTIO");
      }}
    />
    <Confirm
      open={confirm === "noshow"}
      large
      title="Marcar inasistencia"
      message="¿Marcar como inasistencia? Esta cita no generará ingresos."
      confirmLabel="Confirmar Inasistencia"
      pending={statusM.isPending}
      onCancel={() => setConfirm(null)}
      onConfirm={() => {
        setConfirm(null);
        statusM.mutate("NO_ASISTIO");
      }}
    />
    <Confirm
      open={confirm === "reschedule"}
      large
      tone="primary"
      title="Reagendar cita"
      message="¿Deseas reagendar esta cita? Se marcará en tu historial de reportes y podrás seleccionar una nueva fecha."
      confirmLabel="Reagendar Cita"
      onCancel={() => setConfirm(null)}
      onConfirm={() => {
        setConfirm(null);
        const d = new Date(appointment.startAt);
        const pad = (n: number) => String(n).padStart(2, "0");
        setDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
        setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
        setView("reschedule");

      }}
    />
    </>
  );
}

function NewAppointmentModal({
  open,
  orgId,
  onClose,
  onDone,
}: {
  open: boolean;
  orgId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    clientName: "",
    clientPhone: "",
    age: "",
    locationId: "",
    serviceId: "",
    date: "",
    time: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [askOptional, setAskOptional] = useState(false);

  const isValid =
    !!form.clientName.trim() &&
    !!form.clientPhone.trim() &&
    !!form.date &&
    !!form.time &&
    !!form.locationId;

  const missingOptional = !form.age.trim() || !form.serviceId || !form.notes.trim();

  const submit = () => {
    if (!isValid) return;
    if (missingOptional) {
      setAskOptional(true);
      return;
    }
    create.mutate(false);
  };

  const { data: context } = useQuery({
    queryKey: ["org-context", orgId],
    queryFn: () => organizationApi.context(orgId) as unknown as Promise<OrganizationContext>,
    enabled: open && !!orgId,
  });

  const create = useMutation({
    mutationFn: (force: boolean) => {
      const service = context?.services.find((s) => s.id === form.serviceId);
      const start = new Date(`${form.date}T${form.time}`);
      const end = new Date(start.getTime() + (service?.durationMinutes ?? 30) * 60000);
      return appointmentsApi.create(
        {
          organizationId: orgId,
          clientName: form.clientName,
          clientPhone: form.clientPhone,
          ...(form.age ? { age: Number(form.age) } : {}),
          locationId: form.locationId,
          serviceId: form.serviceId,
          ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
          startAt: start.toISOString(),
          endAt: end.toISOString(),
        },
        force,
      );
    },
    onSuccess: onDone,
    onError: (e: Error) => {
      const full = e instanceof ApiError ? (e.body as SlotFullError | undefined)?.slotFull : undefined;
      setError(
        full
          ? `Horario lleno (${full.bookedCount}/${full.capacity}). ¿Agendar de todos modos subiendo el cupo a ${full.suggestedCapacity}?`
          : errorText(e),
      );
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Nueva cita" size="lg">
      {error && <Banner kind="error" message={error} />}
      <div className="space-y-3">
        <Field label="Cliente *">
          <input
            className={inputCls}
            value={form.clientName}
            onChange={(e) => setForm({ ...form, clientName: e.target.value })}
          />
        </Field>
        <Field label="Teléfono *">
          <input
            className={inputCls}
            value={form.clientPhone}
            onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
          />
        </Field>
        <Field label="Edad (opcional)">
          <input
            type="number"
            className={inputCls}
            value={form.age}
            onChange={(e) => setForm({ ...form, age: e.target.value })}
          />
        </Field>
        <Field label="Ubicación *">
          <select
            className={inputCls}
            value={form.locationId}
            onChange={(e) => setForm({ ...form, locationId: e.target.value })}
          >
            <option value="">Selecciona…</option>
            {context?.locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Servicio (opcional)">
          <select
            className={inputCls}
            value={form.serviceId}
            onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
          >
            <option value="">Selecciona…</option>
            {context?.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha *">
            <input
              type="date"
              className={inputCls}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <Field label="Hora *">
            <input
              type="time"
              className={inputCls}
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Notas (opcional)">
          <textarea
            rows={2}
            className={inputCls}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        {!isValid && (
          <p className="text-xs text-muted-foreground">
            Completa los campos obligatorios (*) para poder agendar.
          </p>
        )}
        <button
          disabled={create.isPending || !isValid}
          onClick={submit}
          className={
            isValid
              ? "w-full btn-primary px-5 py-4 text-xl font-extrabold tracking-tight text-primary-foreground shadow-lg ring-2 ring-primary/30"
              : "w-full cursor-not-allowed rounded-md bg-muted px-4 py-3 text-base font-semibold text-muted-foreground"
          }
        >
          Agendar cita
        </button>
        {create.error && (create.error as { status?: number }).status === 409 && (
          <button
            onClick={() => create.mutate(true)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm font-semibold text-gold"
          >
            Agendar de todos modos
          </button>
        )}
      </div>

      <Modal
        open={askOptional}
        onClose={() => setAskOptional(false)}
        title="Campos opcionales sin rellenar"
        size="lg"
      >
        <p className="text-lg leading-relaxed text-muted-foreground">
          Hay campos opcionales sin rellenar. ¿Deseas agendar la cita de todos modos?
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <button
            onClick={() => setAskOptional(false)}
            className="flex-1 rounded-md border border-border px-5 py-3.5 text-lg font-semibold"
          >
            No, revisar
          </button>
          <button
            onClick={() => {
              setAskOptional(false);
              create.mutate(false);
            }}
            className="flex-1 btn-primary px-5 py-3.5 text-lg font-bold text-primary-foreground"
          >
            Sí, agendar
          </button>
        </div>
      </Modal>
    </Modal>
  );
}

export const inputCls =
  "w-full rounded-md border border-input bg-background px-3.5 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border py-3 last:border-0">
      <span className="block text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="mt-0.5 block text-lg font-semibold leading-snug md:text-xl">{value}</span>
    </div>
  );
}
