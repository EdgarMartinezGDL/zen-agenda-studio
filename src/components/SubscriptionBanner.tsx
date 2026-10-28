import { Link } from "@tanstack/react-router";
import { ChevronRight, CreditCard } from "lucide-react";

import { longDate, useBillingSummary } from "@/components/SubscriptionCard";

// Fase 6, 6.6: con la cuenta SUSPENDED (o con un cobro rechazado) el
// profesional ve este aviso en todas las pantallas y llega a "Mi plan".
export function SubscriptionBanner({ orgId }: { orgId: string }) {
  const { data: s } = useBillingSummary(orgId);
  if (s?.status !== "SUSPENDED" && s?.status !== "PAST_DUE") return null;

  const suspended = s.status === "SUSPENDED";
  return (
    <Link
      to="/negocio"
      search={{ seccion: "plan" }}
      className={`mb-4 flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold transition-colors ${
        suspended
          ? "bg-status-cancelled-bg text-status-cancelled hover:opacity-90"
          : "bg-gold/15 text-foreground hover:bg-gold/25"
      }`}
    >
      <CreditCard className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1">
        {suspended
          ? "Tu cuenta está suspendida por falta de pago. Regulariza tu pago en «Mi plan»."
          : s.suspendsAt
            ? `No pudimos cobrar tu plan. Tu cuenta se suspende el ${longDate(s.suspendsAt)} si no actualizas tu método de pago.`
            : "No pudimos cobrar tu plan. Actualiza tu método de pago en «Mi plan»."}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0" />
    </Link>
  );
}
