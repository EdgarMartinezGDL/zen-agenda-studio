import { Bell, BellOff, Share, SquarePlus } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Banner } from "@/components/Banner";
import { ApiError } from "@/lib/microfix/client";
import { pushApi } from "@/lib/microfix/api";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/microfix/push";
import { errorText } from "@/lib/microfix-ui";

// Avisos de cita nueva, cancelada o reagendada por WhatsApp y de pacientes en
// pausa, en ESTE dispositivo (cada celular o computadora se activa aparte).
export function PushNotificationsCard({ orgId }: { orgId: string }) {
  const [state, setState] = useState<PushState | null>(null);
  // El backend sin llaves VAPID responde 503: la tarjeta no se muestra.
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planBlocked, setPlanBlocked] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getPushState().then((s) => alive && setState(s));
    pushApi.vapidPublicKey().catch((e) => {
      if (alive && e instanceof ApiError && e.status === 503) setAvailable(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!available || state === null) return null;

  const activate = async () => {
    setBusy(true);
    setError(null);
    try {
      await enablePush(orgId);
      setState("on");
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setPlanBlocked(e.message);
      else setError(errorText(e));
      setState(await getPushState());
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    setBusy(true);
    setError(null);
    try {
      await disablePush(orgId);
    } finally {
      setState(await getPushState());
      setBusy(false);
    }
  };

  return (
    <section className="card-zen mt-4 p-4">
      <div className="flex items-start gap-3">
        {state === "on" ? (
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
        ) : (
          <BellOff className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Notificaciones en este dispositivo</p>
          <p className="text-xs text-muted-foreground">
            Te avisamos al instante cuando un paciente agenda, cancela o reagenda por WhatsApp, o cuando
            necesita que le respondas tú.
          </p>
        </div>
      </div>

      <div className="mt-3">
        {error && <Banner kind="error" message={error} />}

        {planBlocked ? (
          <p className="text-sm text-muted-foreground">{planBlocked}</p>
        ) : state === "on" ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-status-confirmed">Activadas en este dispositivo</span>
            <Button
              onClick={deactivate}
              disabled={busy}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              Desactivar
            </Button>
          </div>
        ) : state === "off" ? (
          <Button
            onClick={activate}
            disabled={busy}
            className="btn-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Activando…" : "Activar notificaciones"}
          </Button>
        ) : state === "ios-install" ? (
          <div className="text-sm">
            <p className="font-medium">En iPhone primero agrega la app a tu pantalla de inicio:</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Abre esta página en <strong>Safari</strong>.</li>
              <li>
                Toca <Share className="inline h-4 w-4 align-text-bottom" /> <strong>Compartir</strong>.
              </li>
              <li>
                Elige <SquarePlus className="inline h-4 w-4 align-text-bottom" />{" "}
                <strong>Agregar a pantalla de inicio</strong> y luego <strong>Agregar</strong>.
              </li>
              <li>Abre Mi Agenda Zen desde el ícono nuevo, entra a Negocio → Configuración y toca
                “Activar notificaciones”.</li>
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">Necesitas iOS 16.4 o más reciente.</p>
          </div>
        ) : state === "denied" ? (
          <p className="text-sm text-muted-foreground">
            Las notificaciones están bloqueadas para esta app. Permítelas en la configuración del navegador
            (ícono del candado junto a la dirección, o Ajustes → Notificaciones en el celular) y vuelve a
            abrir esta pantalla.
          </p>
        ) : state === "insecure" ? (
          <p className="text-sm text-muted-foreground">
            Para recibir notificaciones abre la app desde su dirección segura (https).
          </p>
        ) : state === "preview" ? (
          <p className="text-sm text-muted-foreground">
            Disponible al abrir la app publicada (no en la vista previa).
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Este navegador no permite notificaciones. Usa Chrome, Edge, Firefox o Safari actualizados.
          </p>
        )}
      </div>
    </section>
  );
}
