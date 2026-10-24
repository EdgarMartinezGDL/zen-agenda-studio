import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { BarChart3, CalendarDays, LogOut, Moon, Store, Sun, Users } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { BusinessBrand, PlatformSeal } from "@/components/Brand";
import { Confirm } from "@/components/Confirm";
import { NotificationBell } from "@/components/NotificationBell";
import { organizationApi } from "@/lib/microfix/api";
import { useAuth } from "@/lib/microfix/auth";
import { disablePushOnLogout, refreshPush, registerServiceWorker } from "@/lib/microfix/push";
import { applyBranding } from "@/lib/branding";
import { useTheme } from "@/lib/theme";
import type { Organization } from "@/types";

const NAV = [
  { to: "/", label: "Hoy", icon: CalendarDays },
  { to: "/eventos", label: "Eventos", icon: Users },
  { to: "/reportes", label: "Reportes", icon: BarChart3 },
  { to: "/negocio", label: "Negocio", icon: Store },
] as const;

function ThemeToggle({ full = false }: { full?: boolean }) {
  const { theme, toggle } = useTheme();
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"}
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${
        full ? "w-full" : ""
      }`}
    >
      <Icon className="h-4 w-4 text-gold" />
      {full && <span>{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>}
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, ready, logout: endSession } = useAuth();
  // El Súper Admin no tiene organización: su lugar es el Súper Panel (/admin).
  const isAdmin = user?.role === "SUPER_ADMIN";
  const checked = ready && !!user && !isAdmin;
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [bellAutoOpen, setBellAutoOpen] = useState<null | "desktop" | "mobile">(null);

  const orgId = user?.organizationId;
  const { data: org } = useQuery({
    queryKey: ["organization", orgId],
    queryFn: () => {
      if (!orgId) throw new Error("No hay organización en la sesión");
      return organizationApi.get(orgId) as Promise<Organization>;
    },
    enabled: !!orgId,
  });
  const businessName = org?.headerName?.trim() || org?.name || "Mi Negocio";
  const headerNameSize = org?.headerNameSize ?? null;
  const mobileLong = businessName.trim().length > 16;
  const mobileNameCls =
    headerNameSize === "sm"
      ? "text-sm"
      : headerNameSize === "lg"
        ? "text-xl"
        : headerNameSize === "md"
          ? "text-base"
          : mobileLong
            ? "text-sm"
            : "text-base";
  const mobileInitials = businessName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

  useEffect(() => {
    if (org) applyBranding(org);
  }, [org]);

  useEffect(() => {
    if (ready && !user) navigate({ to: "/login" });
    else if (ready && isAdmin) navigate({ to: "/admin" });
  }, [ready, user, isAdmin, navigate]);

  useEffect(() => {
    if (!orgId) return;
    registerServiceWorker().then(() => refreshPush(orgId));
  }, [orgId]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const abrir = url.searchParams.get("abrir");
    if (!abrir) return;
    if (abrir === "notificaciones") {
      setBellAutoOpen(window.matchMedia("(min-width: 768px)").matches ? "desktop" : "mobile");
    }
    url.searchParams.delete("abrir");
    window.history.replaceState(window.history.state, "", url.toString());
    // Aviso push de paciente en pausa → su lista.
    if (abrir === "pausados") navigate({ to: "/pausados" });
  }, []);

  const logout = () => setLogoutOpen(true);

  const confirmLogout = async () => {
    setLogoutOpen(false);
    if (orgId) await disablePushOnLogout(orgId);
    endSession();
    navigate({ to: "/login" });
  };

  if (!checked) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar escritorio */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <div className="px-2 py-3">
          <BusinessBrand name={businessName} logoUrl={org?.logoUrl} nameSize={headerNameSize} />
        </div>
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border pt-3">
          <div className="px-3 pb-3">
            <PlatformSeal />
          </div>
          <p className="truncate px-3 pb-2 text-xs text-muted-foreground">{user?.fullName}</p>
          <NotificationBell orgId={orgId ?? ""} full autoOpen={bellAutoOpen === "desktop"} />
          <ThemeToggle full />
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Salir
          </button>
        </div>
      </aside>

      {/* Cabecera móvil */}
      <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-border bg-card px-2 py-0 md:hidden">
        {/* Bloque izquierdo: logo + nombre */}
        <div className="flex h-full min-w-0 flex-1 items-center gap-2">
          {org?.logoUrl ? (
            <img
              src={org.logoUrl}
              alt={businessName}
              className="h-14 max-h-[92%] w-auto max-w-[4.5rem] shrink-0 object-contain"
            />
          ) : (
            <div
              aria-hidden
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/15 text-base font-bold tracking-wide text-gold"
            >
              {mobileInitials}
            </div>
          )}
          <p
            className={`min-w-0 flex-1 font-bold leading-tight tracking-tight text-foreground ${mobileNameCls} ${
              mobileLong ? "line-clamp-2 break-words" : "truncate"
            }`}
          >
            {businessName}
          </p>
        </div>

        {/* Bloque derecho: acciones + sello institucional */}
        <div className="flex shrink-0 flex-col items-end justify-center">
          <div className="flex items-center">
            <NotificationBell orgId={orgId ?? ""} autoOpen={bellAutoOpen === "mobile"} />
            <ThemeToggle />
            <button
              onClick={logout}
              aria-label="Salir"
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <div className="pr-1 text-right leading-tight">
            <p className="text-[10px] font-semibold text-foreground">Mi Agenda Zen</p>
            <p className="text-[9px] font-medium text-muted-foreground">By MicroFix Cloud</p>
          </div>
        </div>
      </header>

      <main className="px-4 pt-4 pb-28 md:ml-64 md:px-8 md:py-8">{children}</main>

      {/* Bottom nav móvil */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      <Confirm
        open={logoutOpen}
        large
        title="Cerrar sesión"
        message="¿Estás seguro de que deseas cerrar sesión?"
        confirmLabel="Sí, salir"
        cancelLabel="Cancelar"
        onConfirm={() => void confirmLogout()}
        onCancel={() => setLogoutOpen(false)}
      />
    </div>
  );
}
