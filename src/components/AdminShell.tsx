import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Building2, LogOut, Moon, QrCode, ShieldCheck, Sun } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { Brand } from "@/components/Brand";
import { Confirm } from "@/components/Confirm";
import { useAuth } from "@/lib/microfix/auth";
import { useTheme } from "@/lib/theme";

// Súper Panel (Fase 5, 5.6): marco solo para el Súper Admin. Su sesión no
// tiene organización, por eso no usa AppShell (marca del negocio, campana ni push).
const NAV = [
  { to: "/admin", label: "Organizaciones", icon: Building2 },
  { to: "/admin/demos", label: "Demos", icon: QrCode },
  { to: "/admin/calidad", label: "Calidad IA", icon: ShieldCheck },
] as const;

function ThemeToggle({ full = false }: { full?: boolean }) {
  const { theme, toggle } = useTheme();
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <Button variant="ghost"
      onClick={toggle}
      aria-label={theme === "dark" ? "Activar modo claro" : "Activar modo oscuro"}
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${
        full ? "w-full" : ""
      }`}
    >
      <Icon className="h-4 w-4 text-gold" />
      {full && <span>{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>}
    </Button>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, ready, logout: endSession } = useAuth();
  const isAdmin = user?.role === "SUPER_ADMIN";
  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) navigate({ to: "/login" });
    // Un profesional o asistente no entra al Súper Panel: vuelve a su inicio.
    else if (!isAdmin) navigate({ to: "/" });
  }, [ready, user, isAdmin, navigate]);

  const confirmLogout = () => {
    setLogoutOpen(false);
    endSession();
    navigate({ to: "/login" });
  };

  if (!ready || !user || !isAdmin) {
    return <div className="min-h-screen bg-background" />;
  }

  const isActive = (to: string) =>
    to === "/admin" ? pathname === "/admin" || pathname === "/admin/" : pathname.startsWith(to);

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar escritorio */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <div className="px-2 py-3">
          <Brand size="sm" />
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gold">
            Súper Panel
          </p>
        </div>
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive(to)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border pt-3">
          <p className="truncate px-3 pb-2 text-xs text-muted-foreground">{user.email}</p>
          <ThemeToggle full />
          <Button variant="ghost"
            onClick={() => setLogoutOpen(true)}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Salir
          </Button>
        </div>
      </aside>

      {/* Cabecera móvil */}
      <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-border bg-card px-3 md:hidden">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold leading-tight">Súper Panel</p>
          <p className="text-[10px] font-medium text-muted-foreground">
            Mi Agenda Zen · By MicroFix Cloud
          </p>
        </div>
        <ThemeToggle />
        <Button variant="ghost"
          onClick={() => setLogoutOpen(true)}
          aria-label="Salir"
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <main className="px-4 pt-4 pb-28 md:ml-64 md:px-8 md:py-8">{children}</main>

      {/* Bottom nav móvil */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
              isActive(to) ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>

      <Confirm
        open={logoutOpen}
        large
        title="Cerrar sesión"
        message="¿Estás seguro de que deseas cerrar sesión?"
        confirmLabel="Sí, salir"
        cancelLabel="Cancelar"
        onConfirm={confirmLogout}
        onCancel={() => setLogoutOpen(false)}
      />
    </div>
  );
}
