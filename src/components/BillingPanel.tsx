import {
  CalendarClock,
  Check,
  Copy,
  CreditCard,
  MessageSquare,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/Modal";

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const num = (n: number) => n.toLocaleString("es-MX");

const PLAN_CREDITS = 420;
const EXTRA_CREDITS = 500;
const MONTHLY_ALLOWANCE = 600;
const CONSUMED = 180;

const PACKS = [
  { id: "basic", name: "Paquete Básico", credits: 500, price: 299, badge: null },
  { id: "standard", name: "Paquete Estándar", credits: 1000, price: 499, badge: "Más popular" },
  { id: "pro", name: "Paquete Pro", credits: 2500, price: 999, badge: "Mejor ahorro" },
] as const;

type Pack = (typeof PACKS)[number];

const FEATURES = [
  "1 Agenda profesional",
  "1 Sucursal / Ubicación",
  "Recepcionista IA 24/7 en WhatsApp",
  "600 créditos mensuales",
];

/* Datos bancarios para pago manual (OXXO / SPEI) */
const BANK = {
  banco: "BBVA México",
  clabe: "012 180 01234567890 3",
  beneficiario: "MicroFix Cloud S. de R.L. de C.V.",
};
const WHATSAPP_URL =
  "https://wa.me/523317831078?text=Hola,%20acabo%20de%20realizar%20mi%20pago%20del%20paquete%20de%20créditos";

type Usage = {
  id: string;
  at: string;
  type: string;
  cost: 1 | 3;
  channel: "WhatsApp";
};

function buildUsage(): Usage[] {
  const types = [
    "Mensaje de conversación",
    "Recordatorio automático",
    "Mensaje de conversación",
    "Confirmación de cita",
    "Recordatorio automático",
  ];
  const rows: Usage[] = [];
  const now = new Date();
  for (let i = 0; i < 43; i++) {
    const d = new Date(now.getTime() - i * 5.5 * 3600 * 1000);
    const type = types[i % types.length]!;
    rows.push({
      id: `u-${i}`,
      at: d.toISOString(),
      type,
      cost: type === "Recordatorio automático" ? 3 : 1,
      channel: "WhatsApp",
    });
  }
  return rows;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

const cardCls = "rounded-2xl border border-border/70 bg-card/70 p-4 shadow-xl backdrop-blur-md sm:p-5";
const inputCls =
  "w-full rounded-xl border border-input bg-card/60 px-3 py-2 text-sm outline-none backdrop-blur focus:ring-2 focus:ring-ring";

export function BillingPanel() {
  const usage = useMemo(buildUsage, []);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [payPack, setPayPack] = useState<Pack | null>(null);
  const pageSize = 8;

  const filtered = useMemo(() => {
    return usage.filter((u) => {
      const d = ymd(new Date(u.at));
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [usage, from, to]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * pageSize, current * pageSize);

  const total = PLAN_CREDITS + EXTRA_CREDITS;
  const pct = Math.min(100, Math.round((CONSUMED / MONTHLY_ALLOWANCE) * 100));

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <div className="w-full max-w-full space-y-6">
      {/* Saldo actual */}
      <section className={cardCls} aria-labelledby="saldo-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p id="saldo-title" className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Wallet className="h-4 w-4 shrink-0 text-gold" />
              Saldo disponible
            </p>
            <p className="mt-1 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {num(total)}{" "}
              <span className="text-sm font-semibold text-muted-foreground sm:text-base">
                créditos disponibles
              </span>
            </p>
          </div>
          <span className="rounded-full bg-status-confirmed-bg px-3 py-1 text-xs font-bold text-status-confirmed">
            Cuenta al corriente
          </span>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-1 text-sm font-medium text-muted-foreground">
            <span>Consumo del plan mensual</span>
            <span className="font-bold text-foreground">
              {num(CONSUMED)} / {num(MONTHLY_ALLOWANCE)} créditos
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={CONSUMED}
            aria-valuemin={0}
            aria-valuemax={MONTHLY_ALLOWANCE}
            aria-label="Consumo del plan mensual"
            className="h-3 w-full overflow-hidden rounded-full bg-muted shadow-inner"
          >
            <div
              className="h-full rounded-full bg-gradient-to-b from-primary/80 via-primary to-primary/90 shadow-lg"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-background/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Créditos del plan
            </p>
            <p className="mt-1 text-2xl font-bold text-foreground">{num(PLAN_CREDITS)}</p>
            <p className="text-xs text-muted-foreground">Renueva el día 1 de cada mes</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Bolsa extra comprada
            </p>
            <p className="mt-1 text-2xl font-bold text-foreground">{num(EXTRA_CREDITS)}</p>
            <p className="text-xs text-muted-foreground">Sin caducidad</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-semibold text-foreground">
          <Sparkles className="h-4 w-4 shrink-0 text-gold" />
          <span className="break-words">
            1 mensaje de conversación = 1 crédito | 1 recordatorio automático = 3 créditos
          </span>
        </div>
      </section>

      {/* Plan activo */}
      <section className={cardCls} aria-labelledby="plan-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="plan-title" className="text-lg font-bold text-foreground sm:text-xl">
            Plan Starter — {money(499)} MXN / mes
          </h3>
          <span className="rounded-full bg-status-confirmed-bg px-3 py-1 text-xs font-bold text-status-confirmed">
            Activo
          </span>
        </div>
        <ul className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Check className="h-4 w-4 shrink-0 text-primary" />
              {f}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => toast.info("Abriendo el portal de suscripción…")}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background/60 px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent sm:w-auto sm:py-2.5"
        >
          <CreditCard className="h-4 w-4" />
          Gestionar suscripción
        </button>
      </section>

      {/* Recargas */}
      <section aria-labelledby="recargas-title">
        <h3 id="recargas-title" className="text-lg font-bold text-foreground sm:text-xl">
          ¿Necesitas más créditos este mes?
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">Las recargas nunca vencen.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {PACKS.map((p) => (
            <div
              key={p.id}
              className={`${cardCls} flex flex-col ${
                p.badge === "Más popular" ? "ring-2 ring-primary/60" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-base font-bold text-foreground">{p.name}</h4>
                {p.badge && (
                  <span className="rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-bold text-gold">
                    {p.badge}
                  </span>
                )}
              </div>
              <p className="mt-3 text-3xl font-extrabold text-foreground">{num(p.credits)}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                créditos
              </p>
              <p className="mt-3 text-lg font-bold text-primary">{money(p.price)} MXN</p>
              <button
                type="button"
                onClick={() => setPayPack(p)}
                className="btn-3d btn-3d-primary mt-4 w-full rounded-xl px-4 py-3 text-sm font-bold"
              >
                Comprar bolsa
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Historial */}
      <section className={cardCls} aria-labelledby="historial-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 id="historial-title" className="text-lg font-bold text-foreground sm:text-xl">
            Historial de consumo reciente
          </h3>
          <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
            <label className="min-w-0 flex-1 text-xs font-semibold text-muted-foreground sm:flex-none">
              Desde
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className="min-w-0 flex-1 text-xs font-semibold text-muted-foreground sm:flex-none">
              Hasta
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
                className={`${inputCls} mt-1`}
              />
            </label>
            {(from || to) && (
              <button
                type="button"
                onClick={() => {
                  setFrom("");
                  setTo("");
                  setPage(1);
                }}
                className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Móvil: lista de tarjetas compactas */}
        <ul className="mt-4 space-y-2 md:hidden">
          {rows.map((u) => (
            <li key={u.id} className="rounded-xl border border-border/60 bg-background/40 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 break-words text-sm font-semibold text-foreground">{u.type}</p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                    u.cost === 3
                      ? "bg-status-pending-bg text-status-pending"
                      : "bg-status-completed-bg text-status-completed"
                  }`}
                >
                  -{u.cost}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{fmt(u.at)}</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-status-confirmed">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {u.channel}
                </span>
              </div>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="py-8 text-center text-sm text-muted-foreground">
              Sin consumo en el rango seleccionado.
            </li>
          )}
        </ul>

        {/* Escritorio: tabla */}
        <div className="mt-4 hidden w-full max-w-full overflow-x-auto md:block">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">Fecha / Hora</th>
                <th className="py-2 pr-3 font-semibold">Tipo de interacción</th>
                <th className="py-2 pr-3 font-semibold">Créditos</th>
                <th className="py-2 font-semibold">Canal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-b border-border/50">
                  <td className="whitespace-nowrap py-2.5 pr-3 text-muted-foreground">{fmt(u.at)}</td>
                  <td className="break-words py-2.5 pr-3 font-medium text-foreground">{u.type}</td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        u.cost === 3
                          ? "bg-status-pending-bg text-status-pending"
                          : "bg-status-completed-bg text-status-completed"
                      }`}
                    >
                      -{u.cost}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-status-confirmed">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {u.channel}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    Sin consumo en el rango seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            {filtered.length} registros · página {current} de {pages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
              className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={current >= pages}
              onClick={() => setPage(current + 1)}
              className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>

      {payPack && <ManualPaymentModal pack={payPack} onClose={() => setPayPack(null)} />}
    </div>
  );
}

function ManualPaymentModal({ pack, onClose }: { pack: Pack; onClose: () => void }) {
  // TODO (pasarela automática): conectar aquí Stripe / Mercado Pago.
  // const checkout = async () => {
  //   const { url } = await api<{ url: string }>("/payments/checkout", {
  //     method: "POST",
  //     body: { packId: pack.id },
  //   });
  //   window.location.href = url;
  // };
  const reference = `CRD-${pack.id.toUpperCase()}-${pack.credits}`;

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiada`);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const rows: { label: string; value: string }[] = [
    { label: "Banco", value: BANK.banco },
    { label: "CLABE", value: BANK.clabe },
    { label: "Beneficiario", value: BANK.beneficiario },
    { label: "Referencia", value: reference },
  ];

  return (
    <Modal open onClose={onClose} title="Datos para Transferencia / Depósito OXXO" size="lg">
      <div className="space-y-4">
        <div className="rounded-xl border border-gold/30 bg-gold/10 p-3 text-sm font-semibold text-foreground">
          {pack.name} · {num(pack.credits)} créditos · {money(pack.price)} MXN
        </div>

        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.label}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 p-3"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {r.label}
                </p>
                <p className="break-words text-sm font-bold text-foreground">{r.value}</p>
              </div>
              <button
                type="button"
                onClick={() => copy(r.label, r.value)}
                aria-label={`Copiar ${r.label}`}
                className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Copy className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">
          Realiza tu pago por transferencia SPEI o en efectivo en OXXO usando la referencia. Tus
          créditos se acreditan al confirmar el pago.
        </p>

        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#3fd07a] via-[#25D366] to-[#1da851] px-4 py-3 text-sm font-bold text-white shadow-lg transition-transform active:translate-y-px"
        >
          <MessageSquare className="h-4 w-4" />
          Notificar pago por WhatsApp
        </a>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground hover:bg-accent"
        >
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
