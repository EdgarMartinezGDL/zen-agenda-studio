import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, QrCode, RefreshCw } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { AdminShell } from "@/components/AdminShell";
import { Banner } from "@/components/Banner";
import { Confirm } from "@/components/Confirm";
import { Modal } from "@/components/Modal";
import { PLANS, planLabel } from "@/lib/admin-ui";
import { adminApi } from "@/lib/microfix/api";
import { ApiError } from "@/lib/microfix/client";
import type {
  AdminDemo,
  ConvertDemoInput,
  CreateDemoInput,
  DemoQrResult,
  DemoStatus,
} from "@/lib/microfix/types";
import { errorText } from "@/lib/microfix-ui";

export const Route = createFileRoute("/admin/demos")({
  head: () => ({
    meta: [
      { title: "Demos — Súper Panel" },
      {
        name: "description",
        content: "Crear demos, mostrar el QR, cancelar y convertir a cliente.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Demos — Súper Panel" },
      { property: "og:description", content: "Crear demos, mostrar el QR, cancelar y convertir a cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AdminShell>
      <DemosPage />
    </AdminShell>
  ),
});

const STATUS: Record<DemoStatus, { label: string; cls: string }> = {
  CREATING: { label: "Creando", cls: "bg-accent text-foreground" },
  QR_PENDING: { label: "Esperando QR", cls: "bg-gold/15 text-gold" },
  ACTIVE: { label: "Activa", cls: "bg-status-confirmed-bg text-status-confirmed" },
  EXPIRED: { label: "Expirada", cls: "bg-status-cancelled-bg text-status-cancelled" },
  CANCELLED: { label: "Cancelada", cls: "bg-status-cancelled-bg text-status-cancelled" },
  CONVERTED: { label: "Convertida", cls: "bg-primary/15 text-primary" },
  PURGED: { label: "Borrada", cls: "bg-accent text-muted-foreground" },
};

const BILLING = [
  { code: "MONTHLY", label: "Mensual" },
  { code: "YEARLY", label: "Anual" },
] as const;
const PAYMENT = [
  { code: "CARD", label: "Tarjeta" },
  { code: "BANK_TRANSFER", label: "Transferencia" },
  { code: "CASH", label: "Efectivo" },
  { code: "WALLET", label: "Monedero digital" },
  { code: "OTHER", label: "Otro" },
] as const;

// Mismo formato que valida el backend (E.164).
const E164 = "^\\+[1-9]\\d{7,14}$";
const QR_REFRESH_MS = 20_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const inputCls =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
const daysLeft = (iso: string) =>
  Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS));

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function DemosPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [qrDemo, setQrDemo] = useState<{ id: string; name: string; initial?: DemoQrResult } | null>(
    null,
  );
  const [cancelDemo, setCancelDemo] = useState<AdminDemo | null>(null);
  const [convertDemo, setConvertDemo] = useState<AdminDemo | null>(null);

  const {
    data: demos,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["admin", "demos"],
    queryFn: adminApi.demos,
    // Con el QR abierto se revisa seguido para notar cuando el cliente lo escanea.
    refetchInterval: qrDemo ? 5_000 : false,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "demos"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
  };

  const cancelMutation = useMutation({
    mutationFn: (id: string) => adminApi.cancelDemo(id),
    onSuccess: (r) => {
      setCancelDemo(null);
      toast.success(`Demo cancelada. Sus datos se borran el ${day(r.purgeAt)}.`);
      refresh();
    },
    onError: (e) => {
      setCancelDemo(null);
      toast.error(errorText(e));
    },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-normal">Demos</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label="Actualizar"
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
          >
            <Plus className="h-4 w-4" />
            Nueva demo
          </Button>
        </div>
      </div>

      {error && <Banner kind="error" message={errorText(error)} />}
      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {demos && demos.length === 0 && (
        <p className="card-zen p-4 text-sm text-muted-foreground">Aún no hay demos.</p>
      )}

      <div className="space-y-4">
        {demos?.map((d) => (
          <DemoCard
            key={d.id}
            demo={d}
            onQr={() => setQrDemo({ id: d.id, name: d.organizationName })}
            onCancel={() => setCancelDemo(d)}
            onConvert={() => setConvertDemo(d)}
          />
        ))}
      </div>

      <CreateDemoModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(r, name) => {
          setCreateOpen(false);
          refresh();
          setQrDemo({ id: r.demo.id, name, initial: r });
        }}
      />

      {qrDemo && (
        <QrModal
          demo={qrDemo}
          status={demos?.find((d) => d.id === qrDemo.id)?.status}
          onClose={() => {
            setQrDemo(null);
            refresh();
          }}
        />
      )}

      <Confirm
        open={!!cancelDemo}
        title="Cancelar demo"
        message={`La demo de ${cancelDemo?.organizationName ?? ""} se desconecta de WhatsApp y deja de responder. Sus datos se borran a los 60 días; mientras tanto aún puedes convertirla en cliente.`}
        confirmLabel="Sí, cancelar demo"
        cancelLabel="No"
        pending={cancelMutation.isPending}
        onConfirm={() => cancelDemo && cancelMutation.mutate(cancelDemo.id)}
        onCancel={() => setCancelDemo(null)}
      />

      <ConvertDemoModal
        demo={convertDemo}
        onClose={() => setConvertDemo(null)}
        onConverted={() => {
          setConvertDemo(null);
          refresh();
        }}
      />
    </div>
  );
}

function DemoCard({
  demo,
  onQr,
  onCancel,
  onConvert,
}: {
  demo: AdminDemo;
  onQr: () => void;
  onCancel: () => void;
  onConvert: () => void;
}) {
  const s = STATUS[demo.status];
  const waitingQr = demo.status === "QR_PENDING" || demo.status === "CREATING";
  const canCancel = demo.status === "QR_PENDING" || demo.status === "ACTIVE";
  const canConvert =
    demo.status === "ACTIVE" || demo.status === "EXPIRED" || demo.status === "CANCELLED";

  return (
    <section className="card-zen space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">{demo.organizationName}</h2>
          <p className="text-xs text-muted-foreground">Creada: {day(demo.createdAt)}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.cls}`}>{s.label}</span>
      </div>

      {waitingQr && (
        <p className="text-sm text-muted-foreground">Esperando que el cliente escanee el QR.</p>
      )}
      {demo.status === "ACTIVE" && demo.expiresAt && (
        <p className="text-sm">
          Vence el <span className="font-semibold">{day(demo.expiresAt)}</span> · quedan{" "}
          {daysLeft(demo.expiresAt)} {daysLeft(demo.expiresAt) === 1 ? "día" : "días"}
        </p>
      )}
      {demo.status === "EXPIRED" && (
        <p className="rounded-md bg-status-cancelled-bg px-3 py-2 text-sm font-medium text-status-cancelled">
          Expiró{demo.expiresAt ? ` el ${day(demo.expiresAt)}` : ""}: la IA ya no responde.
          {demo.purgeAt ? ` Sus datos se borran el ${day(demo.purgeAt)}.` : ""}
        </p>
      )}
      {demo.status === "CANCELLED" && (
        <p className="text-sm text-muted-foreground">
          Cancelada.{demo.purgeAt ? ` Sus datos se borran el ${day(demo.purgeAt)}.` : ""}
        </p>
      )}
      {demo.status === "CONVERTED" && (
        <p className="text-sm text-muted-foreground">Ya es cliente.</p>
      )}

      {(waitingQr || canCancel || canConvert) && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          {waitingQr && (
            <Button
              onClick={onQr}
              className="btn-primary flex items-center gap-2 px-3 py-2 text-sm"
            >
              <QrCode className="h-4 w-4" />
              Mostrar QR
            </Button>
          )}
          {canConvert && (
            <Button onClick={onConvert} className="btn-3d btn-3d-primary px-3 py-2 text-sm">
              Convertir a cliente
            </Button>
          )}
          {canCancel && (
            <Button variant="ghost" onClick={onCancel} className="btn-3d btn-3d-muted px-3 py-2 text-sm">
              Cancelar demo
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function QrModal({
  demo,
  status,
  onClose,
}: {
  demo: { id: string; name: string; initial?: DemoQrResult };
  status: DemoStatus | undefined;
  onClose: () => void;
}) {
  const connected = status === "ACTIVE";
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ["admin", "demo-qr", demo.id],
    queryFn: () => adminApi.demoQr(demo.id),
    // El QR de WhatsApp caduca en segundos: se pide uno nuevo cada 20 s hasta que se conecte.
    ...(demo.initial ? { initialData: demo.initial, initialDataUpdatedAt: Date.now() } : {}),
    refetchInterval: connected ? false : QR_REFRESH_MS,
    enabled: !connected,
    retry: false,
  });
  const notWaiting = error instanceof ApiError && error.status === 409;

  return (
    <Modal open onClose={onClose} title={`QR de ${demo.name}`}>
      {connected ? (
        <div className="space-y-2 text-center">
          <p className="text-lg font-bold text-status-confirmed">
            ¡Conectada! La demo está activa.
          </p>
          <p className="text-sm text-muted-foreground">Desde ahora corren sus 7 días de prueba.</p>
        </div>
      ) : notWaiting ? (
        <p className="text-sm text-muted-foreground">{errorText(error)}</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pide al cliente que abra WhatsApp → <b>Dispositivos vinculados</b> →{" "}
            <b>Vincular un dispositivo</b> y escanee este código. Se renueva solo cada 20 segundos.
          </p>
          {error && <Banner kind="error" message={errorText(error)} />}
          {data?.evolutionError && (
            <Banner kind="error" message={`No se pudo generar el QR: ${data.evolutionError}`} />
          )}
          {data?.qr?.base64 ? (
            <img
              src={data.qr.base64}
              alt="Código QR para vincular WhatsApp"
              className="mx-auto aspect-square w-full max-w-xs rounded-md bg-qr-surface p-2"
            />
          ) : (
            !error && (
              <p className="py-8 text-center text-sm text-muted-foreground">Generando QR…</p>
            )
          )}
          <Button variant="ghost" size="icon"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="btn-3d btn-3d-muted flex w-full items-center justify-center gap-2 px-3 py-2 text-sm disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Pedir otro QR
          </Button>
        </div>
      )}
      <Button onClick={onClose} className="btn-primary mt-5 w-full px-4 py-2 text-sm">
        Cerrar
      </Button>
    </Modal>
  );
}

const EMPTY_CREATE: CreateDemoInput = {
  businessName: "",
  ownerFullName: "",
  ownerEmail: "",
  ownerPassword: "",
  ownerPhone: "",
};

function CreateDemoModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (r: DemoQrResult, name: string) => void;
}) {
  const [form, setForm] = useState<CreateDemoInput>(EMPTY_CREATE);
  const set = (k: keyof CreateDemoInput) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () =>
      adminApi.createDemo({ ...form, ownerEmail: form.ownerEmail.trim().toLowerCase() }),
    onSuccess: (r) => {
      const name = form.businessName;
      setForm(EMPTY_CREATE);
      toast.success("Demo creada");
      onCreated(r, name);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title="Nueva demo">
      <form onSubmit={submit} className="space-y-3">
        {mutation.error && <Banner kind="error" message={errorText(mutation.error)} />}
        <Field label="Nombre del negocio">
          <input
            className={inputCls}
            required
            maxLength={120}
            value={form.businessName}
            onChange={set("businessName")}
          />
        </Field>
        <Field label="Nombre del dueño">
          <input
            className={inputCls}
            required
            maxLength={120}
            value={form.ownerFullName}
            onChange={set("ownerFullName")}
          />
        </Field>
        <Field label="Correo del dueño (con él entra a la app)">
          <input
            className={inputCls}
            type="email"
            required
            value={form.ownerEmail}
            onChange={set("ownerEmail")}
          />
        </Field>
        <Field label="Contraseña inicial (8 a 72 caracteres; dásela al cliente)">
          <input
            className={inputCls}
            type="text"
            autoComplete="off"
            required
            minLength={8}
            maxLength={72}
            value={form.ownerPassword}
            onChange={set("ownerPassword")}
          />
        </Field>
        <Field label="WhatsApp del dueño (con lada, p. ej. +5213312345678)">
          <input
            className={inputCls}
            type="tel"
            required
            pattern={E164}
            title="Formato +5213312345678"
            value={form.ownerPhone}
            onChange={set("ownerPhone")}
          />
        </Field>
        <Button
          type="submit"
          disabled={mutation.isPending}
          className="btn-primary w-full px-4 py-2 text-sm disabled:opacity-60"
        >
          {mutation.isPending ? "Creando…" : "Crear demo y mostrar QR"}
        </Button>
      </form>
    </Modal>
  );
}

const EMPTY_CONVERT: ConvertDemoInput = {
  planCode: "ESSENTIAL",
  billingCycle: "MONTHLY",
  paymentMethod: "CARD",
  phoneNumber: "",
  businessAccountId: "",
  ycloudApiKey: "",
  ycloudWebhookSecret: "",
};

function ConvertDemoModal({
  demo,
  onClose,
  onConverted,
}: {
  demo: AdminDemo | null;
  onClose: () => void;
  onConverted: () => void;
}) {
  const [form, setForm] = useState<ConvertDemoInput>(EMPTY_CONVERT);
  const set = (k: keyof ConvertDemoInput) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const close = () => {
    // Las llaves de YCloud no se quedan en la pantalla.
    setForm(EMPTY_CONVERT);
    mutation.reset();
    onClose();
  };

  const mutation = useMutation({
    mutationFn: () => {
      if (!demo) throw new Error("No hay demo seleccionada");
      return adminApi.convertDemo(demo.id, form);
    },
    onSuccess: (r) => {
      setForm(EMPTY_CONVERT);
      toast.success(
        `${demo?.organizationName ?? "La demo"} ya es cliente (plan ${planLabel(r.subscription.planCode)}).`,
      );
      onConverted();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Modal
      open={!!demo}
      onClose={close}
      title={`Convertir a cliente: ${demo?.organizationName ?? ""}`}
    >
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Pasa de la demo (WhatsApp por QR) a WhatsApp oficial con YCloud. Las llaves se guardan
          cifradas y nunca se vuelven a mostrar.
        </p>
        {mutation.error && <Banner kind="error" message={errorText(mutation.error)} />}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Plan">
            <select className={inputCls} value={form.planCode} onChange={set("planCode")}>
              {PLANS.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cobro">
            <select className={inputCls} value={form.billingCycle} onChange={set("billingCycle")}>
              {BILLING.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Forma de pago">
            <select className={inputCls} value={form.paymentMethod} onChange={set("paymentMethod")}>
              {PAYMENT.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Número de WhatsApp oficial (p. ej. +5213312345678)">
          <input
            className={inputCls}
            type="tel"
            required
            pattern={E164}
            title="Formato +5213312345678"
            value={form.phoneNumber}
            onChange={set("phoneNumber")}
          />
        </Field>
        <Field label="WABA ID (Business Account ID)">
          <input
            className={inputCls}
            required
            maxLength={64}
            value={form.businessAccountId}
            onChange={set("businessAccountId")}
          />
        </Field>
        <Field label="API key de YCloud">
          <input
            className={inputCls}
            type="password"
            autoComplete="off"
            required
            maxLength={512}
            value={form.ycloudApiKey}
            onChange={set("ycloudApiKey")}
          />
        </Field>
        <Field label="Secreto del webhook de YCloud">
          <input
            className={inputCls}
            type="password"
            autoComplete="off"
            required
            maxLength={512}
            value={form.ycloudWebhookSecret}
            onChange={set("ycloudWebhookSecret")}
          />
        </Field>
        <Button
          type="submit"
          disabled={mutation.isPending}
          className="btn-primary w-full px-4 py-2 text-sm disabled:opacity-60"
        >
          {mutation.isPending ? "Convirtiendo…" : "Convertir a cliente"}
        </Button>
      </form>
    </Modal>
  );
}
