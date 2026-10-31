import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppNotification, AuthUser } from "@/lib/microfix/types";

const state = vi.hoisted(() => ({
  user: null as AuthUser | null, navigate: vi.fn(),
  list: vi.fn(), unreadCount: vi.fn(), markRead: vi.fn(),
  billingNotices: vi.fn(), markBillingNoticeRead: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => state.navigate, useRouterState: () => "/admin/avisos",
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("@/lib/microfix/api", () => ({
  organizationApi: { context: vi.fn().mockResolvedValue({ timezone: "America/Mexico_City", locations: [] }) },
  notificationsApi: { list: state.list, unreadCount: state.unreadCount, markRead: state.markRead },
  adminApi: { billingNotices: state.billingNotices, markBillingNoticeRead: state.markBillingNoticeRead },
}));
vi.mock("@/lib/microfix/auth", () => ({ useAuth: () => ({ ready: true, user: state.user, logout: vi.fn() }) }));
vi.mock("@/lib/theme", () => ({ useTheme: () => ({ theme: "light", toggle: vi.fn() }) }));
vi.mock("@/components/Confirm", () => ({ Confirm: () => null }));
import { NotificationBell } from "@/components/NotificationBell";
import { Route } from "@/routes/admin/avisos";

const clients: QueryClient[] = [];
function mount(content: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}>{content}</QueryClientProvider>);
  return client;
}
function mountAdmin() {
  const Page = Route.options.component;
  if (typeof Page !== "function") throw new Error("Missing Avisos component");
  return mount(<Page />);
}
const notice: AppNotification = {
  id: "notice-1", type: "billing", billingKind: "PAYMENT_FAILED", appointmentId: null,
  createdAt: "2026-10-27T00:00:00Z", read: false, readAt: null,
  title: "Pago fallido", message: "No se pudo procesar el pago.", clientName: null,
  startAt: "2026-10-27T12:00:00Z", previousStartAt: null, locationName: null,
  by: null, channel: null, reason: null,
};
beforeEach(() => {
  vi.resetAllMocks(); state.user = null;
  state.list.mockResolvedValue({ items: [notice], nextCursor: null });
  state.unreadCount.mockResolvedValue({ count: 1 });
  state.markRead.mockResolvedValue({ id: "notice-1", read: true });
  state.billingNotices.mockResolvedValue({ items: [], nextCursor: null, unreadCount: 0 });
});
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); });

describe("Professional billing notices", () => {
  it.each(["PAYMENT_FAILED", "SUSPENSION_TOMORROW", "ACCOUNT_SUSPENDED", "PAYMENT_RECEIVED"] as const)("marks %s read without navigation or closing the bell", async billingKind => {
    state.list.mockResolvedValue({ items: [{ ...notice, billingKind }], nextCursor: null });
    mount(<NotificationBell orgId="org-1" autoOpen />);
    fireEvent.click(await screen.findByRole("button", { name: /Pago fallido/ }));
    await waitFor(() => expect(state.markRead).toHaveBeenCalledWith("notice-1"));
    expect(state.navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Notificaciones" })).toBeTruthy();
  });
  it("does not mark an already read billing notice again", async () => {
    state.list.mockResolvedValue({ items: [{ ...notice, read: true }], nextCursor: null });
    mount(<NotificationBell orgId="org-1" autoOpen />);
    fireEvent.click(await screen.findByRole("button", { name: /Pago fallido/ }));
    expect(state.markRead).not.toHaveBeenCalled();
  });
  it("still navigates appointment notices to their agenda day", async () => {
    state.list.mockResolvedValue({ items: [{ ...notice, type: "created", appointmentId: "appointment-1" }], nextCursor: null });
    mount(<NotificationBell orgId="org-1" autoOpen />);
    fireEvent.click(await screen.findByRole("button", { name: /Pago fallido/ }));
    expect(state.navigate).toHaveBeenCalledWith({ to: "/", search: { dia: "2026-10-27" } });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Admin notice permissions and read state", () => {
  it.each(["PROFESSIONAL", "ASSISTANT"] as const)("blocks %s without requesting notices", async role => {
    state.user = { id: "user-1", fullName: "Test", email: "test@example.test", role, organizationId: "org-1" };
    mountAdmin();
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith({ to: "/" }));
    expect(state.billingNotices).not.toHaveBeenCalled();
  });
  it("blocks signed-out visitors without requesting notices", async () => {
    mountAdmin();
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith({ to: "/login" }));
    expect(state.billingNotices).not.toHaveBeenCalled();
  });
  it("marks a super-admin notice read and refreshes both notice queries", async () => {
    state.user = { id: "admin-1", fullName: "Admin", email: "admin@example.test", role: "SUPER_ADMIN", organizationId: null };
    let read = false;
    state.billingNotices.mockImplementation(async () => ({ items: [{ id: "admin-notice-1", kind: "ACCOUNT_SUSPENDED", organizationId: "org-1", organizationName: "Clínica X", title: "Cuenta suspendida", message: "Clínica X quedó suspendida.", createdAt: "2026-10-27T00:00:00Z", read, readAt: read ? "2026-10-27T01:00:00Z" : null }], nextCursor: null, unreadCount: read ? 0 : 1 }));
    state.markBillingNoticeRead.mockImplementation(async () => { read = true; return { id: "admin-notice-1", read: true }; });
    const client = mountAdmin();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    fireEvent.click(await screen.findByRole("button", { name: "Marcar como leído" }));
    await waitFor(() => expect(state.markBillingNoticeRead).toHaveBeenCalledWith("admin-notice-1"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Marcar como leído" })).toBeNull());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "billing-notices"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "billing-notices-unread"] });
    expect(state.billingNotices).toHaveBeenCalledWith({ limit: 1 });
    expect(state.billingNotices).toHaveBeenCalledWith({ limit: 20, cursor: undefined });
  });
});