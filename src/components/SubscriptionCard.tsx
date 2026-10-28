import { useQuery } from "@tanstack/react-query";
import { CreditCard, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Banner } from "@/components/Banner";
import { planLabel } from "@/lib/admin-ui";
import { billingApi } from "@/lib/microfix/api";
import { errorText } from "@/lib/microfix-ui";
import type { BillingCycle, BillingPayment, BillingSummary } from "@/lib/microfix/types";

// Fase 6, 6.6: "Mi plan" del profesional — estado del pago, contratar o
// reactivar (Checkout de Stripe con código de descuento), Portal de Stripe e
// historial de cobros. Todo sigue abierto con la cuenta SUSPENDED.

export const money = (cents: number, currency = "MXN") =>
  (cents / 100).toLocaleString("es-MX", { style: "currency", currency });

export const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

const CYCLE_LABEL: Record<BillingCycle, string> = { MONTHLY: "Mensual", YEARLY: "Anual" };

const STATUS_CHIP: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Activo", className: "bg-status-confirmed-bg text-status-confirmed" },
  PAST_DUE: { label: "Pago pendiente", className: "bg-gold/15 text-foreground" },
  SUSPENDED: { label: "Suspendida", className: "bg-status-cancelled-bg text-status-cancelled" },
};

const fieldCls =
  "w-full rounded-md border border-input bg-background px-3.5 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring";

export function useBillingSummary(orgId: string, confirming = false) {
  return useQuery({
    queryKey: ["billing-summary", orgId],
    queryFn: () => billingApi.summary(orgId),
    enabled: !!orgId,
    // Al volver del pago, el webhook de Stripe tarda unos segundos en activar el plan.
    refetchInterval: (q) => (confirming && q.state.data?.status !== "ACTIVE" ? 3000 : false),
  });
}

export function SubscriptionCard({ orgId, confirming = false }: { orgId: string; confirming?: boolean }) {
  const { data: s, error } = useBillingSummary(orgId, confirming);

  return (
    <section id="mi-plan" className="card-zen mt-4 scroll-mt-24 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold">Mi plan</p>
        {s && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              s.status ? STATUS_CHIP[s.status]?.className : "bg-accent"
            }`}
          >
            {s.status ? STATUS_CHIP[s.status]?.label : "Sin plan de pago"}
          </span>
        )}
      </div>

      {error && (
        <div className="mt-3">
          <Banner kind="error" message={errorText(error)} />
        </div>
      )}
      {!s && !error && <p className="mt-3 text-sm text-muted-foreground">Cargando…</p>}
      {s && <SummaryBody orgId={orgId} s={s} />}
      {s && <PaymentsList orgId={orgId} />}
    </section>
  );
}

function SummaryBody({ orgId, s }: { orgId: string; s: BillingSummary }) {
  return (
    <div className="mt-3 space-y-3">
      {s.status && (
        <ul className="divide-y divide-border text-sm">
          <li className="flex items-center justify-between gap-3 py-1.5">
            <span>Plan</span>
            <span className="text-right font-semibold">
              {planLabel(s.planCode)}
              {s.billingCycle && ` · ${CYCLE_LABEL[s.billingCycle]}`}
            </span>
          </li>
          {s.currentPeriodEnd && (
            <li className="flex items-center justify-between gap-3 py-1.5">
              <span>Pagado hasta</span>
              <span className="text-right font-semibold">{longDate(s.currentPeriodEnd)}</span>
            </li>
          )}
          {s.lastPayment && (
            <li className="flex items-center justify-between gap-3 py-1.5">
              <span>Último pago</span>
              <span className="text-right font-semibold">
                {money(s.lastPayment.amountCents, s.lastPayment.currency)}
                {s.lastPayment.paidAt && ` · ${longDate(s.lastPayment.paidAt)}`}
              </span>
            </li>
          )}
        </ul>
      )}

      {s.status === "PAST_DUE" && (
        <p className="rounded-md bg-gold/15 px-3 py-2 text-sm font-medium">
          No pudimos cobrar tu plan.{" "}
          {s.suspendsAt
            ? `Tu cuenta se suspende el ${longDate(s.suspendsAt)} si no actualizas tu método de pago.`
            : "Actualiza tu método de pago para que no se suspenda tu cuenta."}
        </p>
      )}
      {s.status === "SUSPENDED" && (
        <p className="rounded-md bg-status-cancelled-bg px-3 py-2 text-sm font-medium text-status-cancelled">
          Tu cuenta está suspendida por falta de pago. Tu asistente virtual dejó de atender a tus pacientes.
        </p>
      )}
      {!s.status && <p className="text-sm text-muted-foreground">Aún no tienes un plan de pago.</p>}

      {s.action === "CHECKOUT" && <CheckoutForm orgId={orgId} reactivate={s.status === "SUSPENDED"} />}
      {(s.action === "UPDATE_PAYMENT_METHOD" || s.canOpenPortal) && (
        <PortalButton orgId={orgId} primary={s.action === "UPDATE_PAYMENT_METHOD"} />
      )}
      {s.status && !s.managedByStripe && s.action === "NONE" && (
        <p className="text-xs text-muted-foreground">Tu pago lo administra el equipo de Mi Agenda Zen.</p>
      )}
    </div>
  );
}

function CheckoutForm({ orgId, reactivate }: { orgId: string; reactivate: boolean }) {
  const { data: prices, error: pricesError } = useQuery({
    queryKey: ["billing-prices"],
    queryFn: () => billingApi.prices(),
  });
  const plans = useMemo(() => [...new Set((prices ?? []).map((p) => p.planCode))], [prices]);
  const [planCode, setPlanCode] = useState("");
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY");
  const [promo, setPromo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!planCode && plans.length) setPlanCode(plans[0]!);
  }, [plans, planCode]);

  const cycles = (prices ?? []).filter((p) => p.planCode === planCode);
  const price = cycles.find((p) => p.billingCycle === cycle) ?? cycles[0];

  const pay = async () => {
    if (!price) return;
    setBusy(true);
    setError(null);
    try {
      const code = promo.trim();
      const { url } = await billingApi.checkout(orgId, {
        planCode: price.planCode,
        billingCycle: price.billingCycle,
        ...(code ? { promoCode: code } : {}),
      });
      window.location.assign(url);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  if (pricesError) return <Banner kind="error" message={errorText(pricesError)} />;
  if (!prices) return <p className="text-sm text-muted-foreground">Cargando precios…</p>;

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <p className="text-sm font-semibold">{reactivate ? "Reactiva tu plan" : "Contrata tu plan"}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Plan</span>
          <select value={planCode} onChange={(e) => setPlanCode(e.target.value)} className={fieldCls}>
            {plans.map((c) => (
              <option key={c} value={c}>
                {planLabel(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Pago</span>
          <select
            value={price?.billingCycle ?? cycle}
            onChange={(e) => setCycle(e.target.value as BillingCycle)}
            className={fieldCls}
          >
            {cycles.map((p) => (
              <option key={p.billingCycle} value={p.billingCycle}>
                {CYCLE_LABEL[p.billingCycle]} · {money(p.amountCents, p.currency)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Código de descuento (opcional)</span>
        <input
          value={promo}
          onChange={(e) => {
            setPromo(e.target.value);
            setError(null);
          }}
          maxLength={40}
          autoCapitalize="characters"
          autoComplete="off"
          className={fieldCls}
        />
      </label>
      {error && <Banner kind="error" message={error} />}
      {price && (
        <p className="text-sm">
          Total: <strong>{money(price.amountCents, price.currency)}</strong>{" "}
          {price.billingCycle === "YEARLY" ? "al año" : "al mes"}
          {promo.trim() && " antes del descuento"}
        </p>
      )}
      <button
        type="button"
        onClick={pay}
        disabled={busy || !price}
        className="btn-primary inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto"
      >
        <CreditCard className="h-4 w-4" />
        {busy ? "Abriendo el pago…" : reactivate ? "Reactivar mi plan" : "Pagar con tarjeta"}
      </button>
      <p className="text-xs text-muted-foreground">El pago se hace en la página segura de Stripe.</p>
    </div>
  );
}

function PortalButton({ orgId, primary }: { orgId: string; primary: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await billingApi.portal(orgId);
      window.location.assign(url);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <div>
      {error && <Banner kind="error" message={error} />}
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className={
          primary
            ? "btn-primary inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto"
            : "inline-flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-semibold hover:bg-accent disabled:opacity-50 sm:w-auto"
        }
      >
        <CreditCard className="h-4 w-4" />
        {busy ? "Abriendo…" : primary ? "Actualizar mi método de pago" : "Administrar mi pago y facturas"}
      </button>
    </div>
  );
}

function PaymentsList({ orgId }: { orgId: string }) {
  const { data, error } = useQuery({
    queryKey: ["billing-payments", orgId],
    queryFn: () => billingApi.payments(orgId),
    enabled: !!orgId,
  });

  return (
    <div className="mt-4">
      <p className="text-sm font-semibold">Historial de cobros</p>
      {error && <p className="mt-2 text-sm text-status-cancelled">{errorText(error)}</p>}
      {data && data.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Aún no hay cobros.</p>}
      {data && data.length > 0 && (
        <ul className="mt-2 divide-y divide-border">
          {data.map((p) => (
            <PaymentRow key={p.id} p={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PaymentRow({ p }: { p: BillingPayment }) {
  const paid = p.status === "PAID";
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2 text-sm">
      <div className="min-w-0">
        <p className="font-medium">{longDate(p.paidAt ?? p.createdAt)}</p>
        <p className={`text-xs ${paid ? "text-status-confirmed" : "text-status-cancelled"}`}>
          {paid ? "Pagado" : `Rechazado${p.failureText ? ` · ${p.failureText}` : ""}`}
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
  );
}
