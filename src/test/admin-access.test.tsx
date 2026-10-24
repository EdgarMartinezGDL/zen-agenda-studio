import { render, cleanup, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/lib/microfix/types";

const state = vi.hoisted(() => ({
  user: null as AuthUser | null,
  navigate: vi.fn(),
  organizationGet: vi.fn(),
  registerWorker: vi.fn(async () => undefined),
  refreshPush: vi.fn(),
  content: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => state.navigate,
  useRouterState: () => "/admin",
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: undefined }) }));
vi.mock("@/lib/microfix/auth", () => ({ useAuth: () => ({ user: state.user, ready: true, logout: vi.fn() }) }));
vi.mock("@/lib/microfix/api", () => ({ organizationApi: { get: state.organizationGet } }));
vi.mock("@/lib/microfix/push", () => ({ registerServiceWorker: state.registerWorker, refreshPush: state.refreshPush, disablePushOnLogout: vi.fn() }));
vi.mock("@/lib/theme", () => ({ useTheme: () => ({ theme: "light", toggle: vi.fn() }) }));
vi.mock("@/components/NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/Confirm", () => ({ Confirm: () => null }));

import { AdminShell } from "@/components/AdminShell";
import { AppShell } from "@/components/AppShell";
import { Route as LoginRoute } from "@/routes/login";

function Content() { state.content(); return null; }
const account = (role: AuthUser["role"], organizationId: string | null): AuthUser => ({
  id: "test-user", fullName: "Test", email: "test@example.test", role, organizationId,
});

beforeEach(() => { vi.clearAllMocks(); state.user = null; });
afterEach(cleanup);

describe("Paused push destination", () => {
  it("clears abrir and navigates a professional to /pausados", () => {
    window.history.replaceState({}, "", "/?abrir=pausados");
    state.user = account("PROFESSIONAL", "org-1");
    render(<AppShell><Content /></AppShell>);
    expect(state.navigate).toHaveBeenCalledWith({ to: "/pausados" });
    expect(new URL(window.location.href).searchParams.has("abrir")).toBe(false);
    window.history.replaceState({}, "", "/");
  });
});

describe("Super-admin access", () => {
  it("allows SUPER_ADMIN with organizationId null into the admin shell", () => {
    state.user = account("SUPER_ADMIN", null);
    render(<AdminShell><Content /></AdminShell>);
    expect(state.content).toHaveBeenCalledOnce();
    expect(state.navigate).not.toHaveBeenCalled();
    expect(state.registerWorker).not.toHaveBeenCalled();
  });
  it.each(["PROFESSIONAL", "ASSISTANT"] as const)("returns %s to / without mounting admin content", async (role) => {
    state.user = account(role, "org-1");
    render(<AdminShell><Content /></AdminShell>);
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith({ to: "/" }));
    expect(state.content).not.toHaveBeenCalled();
  });
  it("returns signed-out visitors to /login", async () => {
    render(<AdminShell><Content /></AdminShell>);
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith({ to: "/login" }));
    expect(state.content).not.toHaveBeenCalled();
  });
  it("redirects the organization-free super admin from the agenda to /admin without push", async () => {
    state.user = account("SUPER_ADMIN", null);
    render(<AppShell><Content /></AppShell>);
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith({ to: "/admin" }));
    expect(state.content).not.toHaveBeenCalled();
    expect(state.registerWorker).not.toHaveBeenCalled();
    expect(state.organizationGet).not.toHaveBeenCalled();
  });
  it.each([
    ["SUPER_ADMIN", null, "/admin"],
    ["PROFESSIONAL", "org-1", "/"],
    ["ASSISTANT", "org-1", "/"],
  ] as const)("sends %s from login to %s", async (role, org, destination) => {
    state.user = account(role, org);
    const Login = LoginRoute.options.component;
    if (!Login || typeof Login !== "function") throw new Error("Missing login component");
    render(<Login />);
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith({ to: destination }));
  });
});