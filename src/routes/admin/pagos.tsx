import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { AdminShell } from "@/components/AdminShell";
import { Banner } from "@/components/Banner";
import { Confirm } from "@/components/Confirm";
import { Modal } from "@/components/Modal";
import { longDate, money } from "@/components/SubscriptionCard";
import { PLANS, planLabel } from "@/lib/admin-ui";
import { adminBillingApi } from "@/lib/microfix/api";
import type {
  AdminBillingSubscription,
  AdminDiscount,
  AdminPrice,
  BillingCycle,
  DiscountDuration,
  DiscountType,
  PriceChangeResult,
  SubscriptionStatus,
} from "@/lib/microfix/types";
import { errorText } from "@/lib/microfix-ui";

export const Route = createFileRoute("/admin/pagos")({
  head: () => ({
    meta: [
      { title: "Pagos — Súper Panel" },
      { name: "description", content: "Cobros de las clínicas, precios de los planes y códigos de descuento." },
      { property: "og:title", content: "Pagos — Súper Panel" },
      {
        property: "og:description",
        content: "Cobros de las clínicas, precios de los planes y códigos de descuento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminShell>
      <PagosPage />
    </AdminShell>
  ),
});

// Fase 6, 6.6: Súper Panel de pagos — clínicas por estado de cobro (6.6.2),
// precios que aplican a todos (6.6.3) y códigos de descuento (6.6.4).

const SECTIONS = ["Clínicas", "Precios", "Códigos"] as const;
type Section = (typeof SECTIONS)[number];

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  SUSPENDED: "Suspendidas",
  PAST_DUE: "Pago pendiente",
  ACTIVE: "Activas",
};
const STATUS_CHIP: Record<SubscriptionStatus, { label: string; className: string }> = {
  ACTIVE: { label: "Activa", className: "bg-status-confirmed-bg text-status-confirmed" },
  PAST_DUE: { label: "Pago pendiente", className: "bg-gold/15 text-foreground" },
  SUSPENDED: { label: "Suspendida", className: "bg-status-cancelled-bg text-status-cancelled" },
};
const CYCLE_LABEL: Record<BillingCycle, string> = { MONTHLY: "Mensual", YEARLY: "Anual" };

const fieldCls =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const chipBtn = (on: boolean) =>
  `shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
    on ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-accent"
  }`;

function PagosPage() {
  const [section, setSection] = useState<Section>("Clínicas");

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Pagos</h1>
      <div className="mb-5 -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {SECTIONS.map((s) => (
          <Button asChild variant="ghost" className="h-auto whitespace-normal"><button key={s} type="button" onClick={() => setSection(s)} className={chipBtn(section === s)}>
            {s}
          </button></Button>
        ))}
      </div>
      {section === "Clínicas" && <ClinicsSection />}
      {section === "Precios" && <PricesSection />}
      {section === "Códigos" && <DiscountsSection />}
    </div>
  );
}

/* ---------------- Clínicas ---------------- */

function ClinicsSection() {
  const [status, setStatus] = useState<SubscriptionStatus | undefined>(undefined);
  const [history, setHistory] = useState<AdminBillingSubscription | null>(null);
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin", "billing-subscriptions", status ?? "ALL"],
    queryFn: () => adminBillingApi.subscriptions(status),
  });
  const totals = data?.totals;
  const all = totals ? totals.SUSPENDED + totals.PAST_DUE + totals.ACTIVE : null;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" className="h-auto whitespace-normal"><button type="button" onClick={() => setStatus(undefined)} className={chipBtn(!status)}>
          Todas{all !== null && ` (${all})`}
        </button></Button>
        {(["SUSPENDED", "PAST_DUE", "ACTIVE"] as const).map((s) => (
          <Button asChild variant="ghost" className="h-auto whitespace-normal"><button key={s} type="button" onClick={() => setStatus(s)} className={chipBtn(status === s)}>
            {STATUS_LABEL[s]}
            {totals && ` (${totals[s]})`}
          </button></Button>
        ))}
        <Button asChild variant="ghost" className="h-auto whitespace-normal"><button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          aria-label="Actualizar"
          className="ml-auto rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </button></Button>
      </div>

      {error && <Banner kind="error" message={errorText(error)} />}
      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {data && data.subscriptions.length === 0 && (
        <p className="card-zen p-4 text-sm text-muted-foreground">
          {status ? "No hay clínicas en este estado." : "Aún no hay clínicas con plan de pago."}
        </p>
      )}
      <div className="space-y-3">
        {data?.subscriptions.map((s) => (
          <ClinicCard key={s.organizationId} s={s} onHistory={() => setHistory(s)} />
        ))}
      </div>

      <Modal open={!!history} onClose={() => setHistory(null)} title={`Cobros · ${history?.organizationName ?? ""}`}>
        {history && <PaymentsHistory orgId={history.organizationId} />}
        <Button asChild variant="ghost" className="h-auto whitespace-normal"><button
          type="button"
          onClick={() => setHistory(null)}
          className="btn-primary mt-5 w-full px-4 py-2 text-sm"
        >
          Cerrar
        </button></Button>
      </Modal>
    </>
  );
}

function ClinicCard({ s, onHistory }: { s: AdminBillingSubscription; onHistory: () => void }) {
  const chip = STATUS_CHIP[s.status];
  return (
    <section className="card-zen space-y-2 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="break-words text-base font-bold">{s.organizationName}</h2>
          <p className="text-xs text-muted-foreground">
            {planLabel(s.planCode)}
            {s.billingCycle && ` · ${CYCLE_LABEL[s.billingCycle]}`} ·{" "}
            {s.managedByStripe ? "Cobro con tarjeta (Stripe)" : "Pago manual"}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${chip.className}`}>{chip.label}</span>
      </div>

      {s.status === "SUSPENDED" && s.suspendedAt && (
        <p className="font-medium text-status-cancelled">Suspendida desde el {longDate(s.suspendedAt)}</p>
      )}
      {s.status === "PAST_DUE" && s.suspendsAt && (
        <p className="font-medium">Se suspende el {longDate(s.suspendsAt)} si no paga</p>
      )}
      {s.status === "ACTIVE" && s.currentPeriodEnd && <p>Pagado hasta el {longDate(s.currentPeriodEnd)}</p>}

      <p className="text-muted-foreground">
        Último pago:{" "}
        {s.lastPayment
          ? `${money(s.lastPayment.amountCents, s.lastPayment.currency)}${
              s.lastPayment.paidAt ? ` · ${longDate(s.lastPayment.paidAt)}` : ""
            }`
          : "—"}
      </p>
      {s.lastFailure && (
        <p className="text-status-cancelled">
          Último rechazo: {money(s.lastFailure.amountCents, s.lastFailure.currency)} ·{" "}
          {longDate(s.lastFailure.createdAt)}
          {s.lastFailure.failureText && ` · ${s.lastFailure.failureText}`}
        </p>
      )}

      <Button asChild variant="ghost" className="h-auto whitespace-normal"><button
        type="button"
        onClick={onHistory}
        className="rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-accent"
      >
        Ver cobros
      </button></Button>
    </section>
  );
}

function PaymentsHistory({ orgId }: { orgId: string }) {
  const { data, error } = useQuery({
    queryKey: ["admin", "billing-payments", orgId],
    queryFn: () => adminBillingApi.payments(orgId),
  });
  if (error) return <Banner kind="error" message={errorText(error)} />;
  if (!data) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (data.length === 0) return <p className="text-sm text-muted-foreground">Aún no hay cobros.</p>;
  return (
    <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
      {data.map((p) => (
        <li key={p.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2 text-sm">
          <div className="min-w-0">
            <p className="font-medium">{longDate(p.paidAt ?? p.createdAt)}</p>
            <p className={`text-xs ${p.status === "PAID" ? "text-status-confirmed" : "text-status-cancelled"}`}>
              {p.status === "PAID" ? "Pagado" : `Rechazado${p.failureText ? ` · ${p.failureText}` : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-semibold">{money(p.amountCents, p.currency)}</span>
            {p.invoiceUrl && (
              <a
                href={p.invoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                Ver factura <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Precios ---------------- */

function migrationText(r: PriceChangeResult): string {
  const moved =
    r.migrated === 0
      ? "No había suscripciones por migrar."
      : r.migrated === 1
        ? "1 suscripción pasó al precio nuevo."
        : `${r.migrated} suscripciones pasaron al precio nuevo.`;
  return r.failed.length ? `${moved} ${r.failed.length} no se pudieron migrar: usa «Reintentar».` : moved;
}

function PricesSection() {
  const qc = useQueryClient();
  const { data, error, isLoading } = useQuery({
    queryKey: ["admin", "billing-prices"],
    queryFn: adminBillingApi.prices,
  });
  const [planCode, setPlanCode] = useState<string>(PLANS[0].code);
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY");
  const [amount, setAmount] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<PriceChangeResult | null>(null);

  const active = (data ?? []).filter((p) => p.isActive);
  const old = (data ?? []).filter((p) => !p.isActive);
  const current = active.find((p) => p.planCode === planCode && p.billingCycle === cycle);
  const cents = Math.round(Number(amount) * 100);
  const valid = amount.trim() !== "" && Number.isFinite(cents) && cents >= 1000 && cents <= 10_000_000;

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "billing-prices"] });

  const create = useMutation({
    mutationFn: () => adminBillingApi.createPrice({ planCode, billingCycle: cycle, amountCents: cents }),
    onSuccess: (r) => {
      setConfirmOpen(false);
      setAmount("");
      setResult(r);
      void refresh();
    },
    onError: (e) => {
      setConfirmOpen(false);
      setFormError(errorText(e));
    },
  });

  const migrate = useMutation({
    mutationFn: (id: string) => adminBillingApi.migratePrice(id),
    onSuccess: (r) => {
      toast[r.failed.length ? "warning" : "success"](migrationText(r));
      void refresh();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  return (
    <>
      {error && <Banner kind="error" message={errorText(error)} />}
      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}

      {data && (
        <section className="card-zen p-4">
          <p className="font-semibold">Precios vigentes</p>
          <p className="text-xs text-muted-foreground">IVA incluido. Son los que pagan las clínicas.</p>
          <ul className="mt-2 divide-y divide-border">
            {active.map((p) => (
              <PriceRow key={p.id} p={p} onRetry={() => migrate.mutate(p.id)} retrying={migrate.isPending} />
            ))}
          </ul>
        </section>
      )}

      <section className="card-zen mt-4 space-y-3 p-4">
        <p className="font-semibold">Cambiar un precio</p>
        <p className="text-xs text-muted-foreground">
          El precio nuevo aplica a todas las clínicas de ese plan y ciclo desde su siguiente cobro, sin prorrateo, y les
          llega un aviso.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Plan</span>
            <select
              value={planCode}
              onChange={(e) => {
                setPlanCode(e.target.value);
                setFormError(null);
              }}
              className={fieldCls}
            >
              {PLANS.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Ciclo</span>
            <select
              value={cycle}
              onChange={(e) => {
                setCycle(e.target.value as BillingCycle);
                setFormError(null);
              }}
              className={fieldCls}
            >
              <option value="MONTHLY">Mensual</option>
              <option value="YEARLY">Anual</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Precio nuevo (MXN)</span>
            <input
              type="number"
              inputMode="decimal"
              min={10}
              max={100000}
              step="0.01"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setFormError(null);
              }}
              className={fieldCls}
            />
          </label>
        </div>
        <p className="text-sm text-muted-foreground">
          Precio actual: {current ? money(current.amountCents, current.currency) : "—"}
        </p>
        {amount.trim() !== "" && !valid && (
          <p className="text-sm text-status-cancelled">El precio va de $10 a $100,000.</p>
        )}
        {formError && <Banner kind="error" message={formError} />}
        <Button asChild variant="ghost" className="h-auto whitespace-normal"><button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={!valid}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
        >
          Cambiar precio
        </button></Button>
      </section>

      {old.length > 0 && (
        <section className="card-zen mt-4 p-4">
          <p className="font-semibold">Precios anteriores</p>
          <ul className="mt-2 divide-y divide-border text-sm">
            {old.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-muted-foreground">
                <span>
                  {planLabel(p.planCode)} · {CYCLE_LABEL[p.billingCycle]}
                </span>
                <span>
                  {money(p.amountCents, p.currency)} · desde {longDate(p.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Confirm
        open={confirmOpen}
        title="Cambiar precio"
        message={`${planLabel(planCode)} ${CYCLE_LABEL[cycle].toLowerCase()} pasará de ${
          current ? money(current.amountCents, current.currency) : "—"
        } a ${valid ? money(cents) : "—"}. Aplica a todas las clínicas de ese plan desde su siguiente cobro y se les avisa.`}
        confirmLabel="Sí, cambiar precio"
        tone="primary"
        pending={create.isPending}
        onConfirm={() => create.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />

      <Modal open={!!result} onClose={() => setResult(null)} title="Precio actualizado">
        {result && (
          <div className="space-y-2 text-sm">
            <p className="font-semibold">
              {planLabel(result.price.planCode)} · {CYCLE_LABEL[result.price.billingCycle]}:{" "}
              {money(result.price.amountCents, result.price.currency)}
            </p>
            <p>{migrationText(result)}</p>
          </div>
        )}
        <Button asChild variant="ghost" className="h-auto whitespace-normal"><button
          type="button"
          onClick={() => setResult(null)}
          className="btn-primary mt-5 w-full px-4 py-2 text-sm"
        >
          Entendido
        </button></Button>
      </Modal>
    </>
  );
}

function PriceRow({ p, onRetry, retrying }: { p: AdminPrice; onRetry: () => void; retrying: boolean }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <span>
        {planLabel(p.planCode)} · {CYCLE_LABEL[p.billingCycle]}
      </span>
      <span className="font-semibold">{money(p.amountCents, p.currency)}</span>
      {!!p.pendingMigration && (
        <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-md bg-gold/15 px-3 py-2">
          <span className="font-medium">
            {p.pendingMigration === 1
              ? "1 suscripción sigue con el precio anterior"
              : `${p.pendingMigration} suscripciones siguen con el precio anterior`}
          </span>
          <Button asChild variant="ghost" className="h-auto whitespace-normal"><button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-semibold hover:bg-accent disabled:opacity-50"
          >
            {retrying ? "Reintentando…" : "Reintentar"}
          </button></Button>
        </div>
      )}
    </li>
  );
}

/* ---------------- Códigos de descuento ---------------- */

function discountValue(d: AdminDiscount): string {
  if (d.value === null) return "—";
  return d.type === "PERCENT" ? `${d.value} % de descuento` : `${money(d.value)} de descuento`;
}

function discountDuration(d: AdminDiscount): string {
  if (d.duration === "ONCE") return "en el primer cobro";
  if (d.duration === "FOREVER") return "en todos los cobros";
  if (d.duration === "REPEATING")
    return d.durationMonths === 1 ? "durante 1 mes" : `durante ${d.durationMonths ?? "?"} meses`;
  return "";
}

// "AAAA-MM-DD" → fin de ese día en la hora local.
const endOfDayIso = (ymd: string) => new Date(`${ymd}T23:59:59`).toISOString();

function DiscountsSection() {
  const qc = useQueryClient();
  const { data, error, isLoading } = useQuery({
    queryKey: ["admin", "billing-discounts"],
    queryFn: adminBillingApi.discounts,
  });
  const [code, setCode] = useState("");
  const [type, setType] = useState<DiscountType>("PERCENT");
  const [value, setValue] = useState("");
  const [duration, setDuration] = useState<DiscountDuration>("ONCE");
  const [months, setMonths] = useState("3");
  const [plans, setPlans] = useState<string[]>(PLANS.map((p) => p.code));
  const [expires, setExpires] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [toDeactivate, setToDeactivate] = useState<AdminDiscount | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "billing-discounts"] });

  const create = useMutation({
    mutationFn: () =>
      adminBillingApi.createDiscount({
        code: code.trim(),
        type,
        value: type === "PERCENT" ? Math.round(Number(value)) : Math.round(Number(value) * 100),
        duration,
        ...(duration === "REPEATING" ? { durationMonths: Math.round(Number(months)) } : {}),
        planCodes: plans,
        ...(expires ? { expiresAt: endOfDayIso(expires) } : {}),
        ...(maxUses.trim() ? { maxRedemptions: Math.round(Number(maxUses)) } : {}),
      }),
    onSuccess: (d) => {
      toast.success(`Código ${d.code} creado`);
      setCode("");
      setValue("");
      setExpires("");
      setMaxUses("");
      void refresh();
    },
    onError: (e) => setFormError(errorText(e)),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => adminBillingApi.deactivateDiscount(id),
    onSuccess: (d) => {
      setToDeactivate(null);
      toast.success(`Código ${d.code} desactivado`);
      void refresh();
    },
    onError: (e) => {
      setToDeactivate(null);
      toast.error(errorText(e));
    },
  });

  const togglePlan = (c: string) =>
    setPlans((ps) => (ps.includes(c) ? ps.filter((x) => x !== c) : [...ps, c]));
  const canCreate = code.trim() !== "" && value.trim() !== "" && plans.length > 0 && !create.isPending;
  const clearError = () => setFormError(null);

  return (
    <>
      <section className="card-zen space-y-3 p-4">
        <p className="font-semibold">Nuevo código de descuento</p>
        <p className="text-xs text-muted-foreground">
          La clínica lo escribe al contratar o reactivar su plan. Cada clínica puede usarlo una sola vez.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Código</span>
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                clearError();
              }}
              maxLength={20}
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="Ej. BIENVENIDA20"
              className={fieldCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Tipo</span>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as DiscountType);
                clearError();
              }}
              className={fieldCls}
            >
              <option value="PERCENT">Porcentaje</option>
              <option value="AMOUNT">Monto fijo (MXN)</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              {type === "PERCENT" ? "Porcentaje (1 a 100)" : "Monto (MXN)"}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              max={type === "PERCENT" ? 100 : undefined}
              step={type === "PERCENT" ? 1 : 0.01}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                clearError();
              }}
              className={fieldCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Duración</span>
            <select
              value={duration}
              onChange={(e) => {
                setDuration(e.target.value as DiscountDuration);
                clearError();
              }}
              className={fieldCls}
            >
              <option value="ONCE">Solo el primer cobro</option>
              <option value="REPEATING">Varios meses</option>
              <option value="FOREVER">Para siempre</option>
            </select>
          </label>
          {duration === "REPEATING" && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">Meses (1 a 36)</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={36}
                step={1}
                value={months}
                onChange={(e) => {
                  setMonths(e.target.value);
                  clearError();
                }}
                className={fieldCls}
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Vence (opcional)</span>
            <input
              type="date"
              value={expires}
              onChange={(e) => {
                setExpires(e.target.value);
                clearError();
              }}
              className={fieldCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Tope de usos (opcional)</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={maxUses}
              onChange={(e) => {
                setMaxUses(e.target.value);
                clearError();
              }}
              className={fieldCls}
            />
          </label>
        </div>
        <fieldset>
          <legend className="mb-1 text-xs font-semibold text-muted-foreground">Aplica a los planes</legend>
          <div className="flex flex-wrap gap-4">
            {PLANS.map((p) => (
              <label key={p.code} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={plans.includes(p.code)}
                  onChange={() => {
                    togglePlan(p.code);
                    clearError();
                  }}
                  className="h-4 w-4"
                />
                {p.label}
              </label>
            ))}
          </div>
        </fieldset>
        {formError && <Banner kind="error" message={formError} />}
        <Button asChild variant="ghost" className="h-auto whitespace-normal"><button
          type="button"
          onClick={() => create.mutate()}
          disabled={!canCreate}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
        >
          {create.isPending ? "Creando…" : "Crear código"}
        </button></Button>
      </section>

      <section className="card-zen mt-4 p-4">
        <p className="font-semibold">Códigos</p>
        {error && <Banner kind="error" message={errorText(error)} />}
        {isLoading && <p className="mt-2 text-sm text-muted-foreground">Cargando…</p>}
        {data && data.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Aún no hay códigos.</p>}
        <ul className="mt-2 divide-y divide-border">
          {data?.map((d) => (
            <li key={d.id} className="space-y-1 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="break-all font-mono text-base font-bold">{d.code}</span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    d.active ? "bg-status-confirmed-bg text-status-confirmed" : "bg-accent text-muted-foreground"
                  }`}
                >
                  {d.active ? "Activo" : "Inactivo"}
                </span>
              </div>
              <p>
                {discountValue(d)} {discountDuration(d)}
              </p>
              <p className="text-xs text-muted-foreground">
                Planes: {d.planCodes.length ? d.planCodes.map(planLabel).join(", ") : "—"} · Usos: {d.timesRedeemed}
                {d.maxRedemptions !== null && ` de ${d.maxRedemptions}`}
                {d.expiresAt && ` · Vence el ${longDate(d.expiresAt)}`}
              </p>
              {d.active && (
                <Button asChild variant="ghost" className="h-auto whitespace-normal"><button
                  type="button"
                  onClick={() => setToDeactivate(d)}
                  className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold hover:bg-accent"
                >
                  Desactivar
                </button></Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <Confirm
        open={!!toDeactivate}
        title="Desactivar código"
        message={`Nadie más podrá usar el código ${toDeactivate?.code ?? ""}. Quien ya lo usó conserva su descuento. No se puede volver a activar.`}
        confirmLabel="Sí, desactivar"
        pending={deactivate.isPending}
        onConfirm={() => toDeactivate && deactivate.mutate(toDeactivate.id)}
        onCancel={() => setToDeactivate(null)}
      />
    </>
  );
}
