import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, MessageCircleWarning } from "lucide-react";

import { pausedApi } from "@/lib/microfix/api";

// Fase 5, 5.6.5: aviso en Hoy cuando hay pacientes esperando atención humana.
export function PausedBanner({ orgId }: { orgId: string }) {
  const { data } = useQuery({
    queryKey: ["paused", orgId],
    queryFn: () => pausedApi.list(orgId),
    enabled: !!orgId,
    refetchInterval: 60_000,
  });
  const n = data?.length ?? 0;
  if (!n) return null;

  return (
    <Link
      to="/pausados"
      className="mb-4 flex items-center gap-3 rounded-md bg-gold/15 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-gold/25"
    >
      <MessageCircleWarning className="h-5 w-5 shrink-0 text-gold" />
      <span className="flex-1">
        {n === 1 ? "1 paciente espera tu respuesta" : `${n} pacientes esperan tu respuesta`}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
