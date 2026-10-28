import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/lib/microfix/types";

const state = vi.hoisted(() => ({
  user: null as AuthUser | null, navigate: vi.fn(),
  subscriptions: vi.fn(), payments: vi.fn(), prices: vi.fn(), createPrice: vi.fn(), migratePrice: vi.fn(),
  discounts: vi.fn(), createDiscount: vi.fn(), deactivateDiscount: vi.fn(), billingNotices: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => state.navigate, useRouterState: () => "/admin/pagos",
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("@/lib/microfix/api", () => ({
  adminBillingApi: state, adminApi: { billingNotices: state.billingNotices },
}));
vi.mock("@/lib/microfix/auth", () => ({ useAuth: () => ({ ready: true, user: state.user, logout: vi.fn() }) }));
vi.mock("@/lib/theme", () => ({ useTheme: () => ({ theme: "light", toggle: vi.fn() }) }));
import { Route } from "@/routes/admin/pagos";

const clients: QueryClient[] = [];
function mount() {
  const Page = Route.options.component;
  if (typeof Page !== "function") throw new Error("Missing Pagos component");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><Page /></QueryClientProvider>);
  return client;
}
const clinic = { organizationId: "org-1", organizationName: "Clínica Zen", planCode: "PREMIUM", billingCycle: "MONTHLY", status: "ACTIVE", managedByStripe: true, currentPeriodEnd: null, lastPayment: null, lastFailure: null };
const price = { id: "price-1", planCode: "ESSENTIAL", billingCycle: "MONTHLY", currency: "MXN", amountCents: 10000, isActive: true, createdAt: "2026-10-28T00:00:00Z", pendingMigration: 1 };
const discount = { id: "discount-1", code: "ZEN20", type: "PERCENT", value: 20, duration: "ONCE", durationMonths: null, planCodes: ["ESSENTIAL"], expiresAt: null, maxRedemptions: null, timesRedeemed: 0, active: true, createdAt: "2026-10-28T00:00:00Z" };
beforeEach(() => {
  vi.resetAllMocks();
  state.user = { id: "admin-1", fullName: "Admin", email: "admin@example.test", role: "SUPER_ADMIN", organizationId: null };
  state.billingNotices.mockResolvedValue({ items: [], unreadCount: 0 });
  state.subscriptions.mockResolvedValue({ totals: { ACTIVE: 1, PAST_DUE: 0, SUSPENDED: 0 }, subscriptions: [clinic] });
  state.payments.mockResolvedValue([]);
  state.prices.mockResolvedValue([price]);
  state.discounts.mockResolvedValue([]);
  state.createPrice.mockResolvedValue({ price, migrated: 1, failed: [] });
  state.migratePrice.mockResolvedValue({ price, migrated: 1, failed: [] });
  state.createDiscount.mockResolvedValue(discount);
  state.deactivateDiscount.mockResolvedValue({ ...discount, active: false });
});
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); });

describe("Pagos access and clinic history", () => {
  it.each(["PROFESSIONAL", "ASSISTANT"] as const)("blocks %s before requesting payments", async role => {
    state.user = { ...state.user, id: "user-1", fullName: "Test", email: "test@example.test", role, organizationId: "org-1" };
    mount();
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith({ to: "/" }));
    expect(state.subscriptions).not.toHaveBeenCalled();
  });
  it("blocks signed-out visitors", async () => {
    state.user = null; mount();
    await waitFor(() => expect(state.navigate).toHaveBeenCalledWith({ to: "/login" }));
    expect(state.subscriptions).not.toHaveBeenCalled();
  });
  it("filters suspended clinics", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /Suspendidas/ }));
    await waitFor(() => expect(state.subscriptions).toHaveBeenCalledWith("SUSPENDED"));
  });
  it("requests history only when opened for the chosen clinic", async () => {
    mount(); expect(state.payments).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Ver cobros" }));
    await waitFor(() => expect(state.payments).toHaveBeenCalledWith("org-1"));
  });
});

describe("Price changes", () => {
  it.each([["9.99", false], ["10", true], ["100000", true], ["100000.01", false]] as const)("enforces price limit for %s MXN", async (amount, valid) => {
    mount(); fireEvent.click(screen.getByRole("button", { name: "Precios" }));
    await screen.findByLabelText("Precio nuevo (MXN)");
    fireEvent.change(screen.getByLabelText("Precio nuevo (MXN)"), { target: { value: amount } });
    expect((screen.getByRole("button", { name: "Cambiar precio" }) as HTMLButtonElement).disabled).toBe(!valid);
  });
  it("requires confirmation then sends rounded cents and refreshes prices", async () => {
    const client = mount(); const invalidate = vi.spyOn(client, "invalidateQueries");
    fireEvent.click(screen.getByRole("button", { name: "Precios" }));
    fireEvent.change(await screen.findByLabelText("Precio nuevo (MXN)"), { target: { value: "123.45" } });
    fireEvent.change(screen.getByLabelText("Ciclo"), { target: { value: "YEARLY" } });
    fireEvent.click(screen.getByRole("button", { name: "Cambiar precio" }));
    expect(state.createPrice).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sí, cambiar precio" }));
    await waitFor(() => expect(state.createPrice).toHaveBeenCalledWith({ planCode: "ESSENTIAL", billingCycle: "YEARLY", amountCents: 12345 }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "billing-prices"] }));
  });
  it("retries only the selected pending price", async () => {
    mount(); fireEvent.click(screen.getByRole("button", { name: "Precios" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(state.migratePrice).toHaveBeenCalledWith("price-1"));
  });
});

describe("Discount actions", () => {
  it("creates an uppercase percentage code for the selected plans without unused optional fields", async () => {
    mount(); fireEvent.click(screen.getByRole("button", { name: "Códigos" }));
    fireEvent.change(screen.getByLabelText("Código"), { target: { value: " zen20 " } });
    fireEvent.change(screen.getByLabelText("Porcentaje (1 a 100)"), { target: { value: "20" } });
    fireEvent.click(screen.getByLabelText("Premium"));
    fireEvent.click(screen.getByRole("button", { name: "Crear código" }));
    await waitFor(() => expect(state.createDiscount).toHaveBeenCalledWith({ code: "ZEN20", type: "PERCENT", value: 20, duration: "ONCE", planCodes: ["ESSENTIAL"] }));
  });
  it("converts fixed MXN to cents and repeating duration to months", async () => {
    mount(); fireEvent.click(screen.getByRole("button", { name: "Códigos" }));
    fireEvent.change(screen.getByLabelText("Código"), { target: { value: "zen50" } });
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "AMOUNT" } });
    fireEvent.change(screen.getByLabelText("Monto (MXN)"), { target: { value: "50.25" } });
    fireEvent.change(screen.getByLabelText("Duración"), { target: { value: "REPEATING" } });
    fireEvent.change(screen.getByLabelText("Meses (1 a 36)"), { target: { value: "36" } });
    fireEvent.change(screen.getByLabelText("Tope de usos (opcional)"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear código" }));
    await waitFor(() => expect(state.createDiscount).toHaveBeenCalledWith({ code: "ZEN50", type: "AMOUNT", value: 5025, duration: "REPEATING", durationMonths: 36, planCodes: ["ESSENTIAL", "PREMIUM"], maxRedemptions: 10 }));
  });
  it("does not create a code with no selected plans", () => {
    mount(); fireEvent.click(screen.getByRole("button", { name: "Códigos" }));
    fireEvent.change(screen.getByLabelText("Código"), { target: { value: "ZEN20" } });
    fireEvent.change(screen.getByLabelText("Porcentaje (1 a 100)"), { target: { value: "20" } });
    fireEvent.click(screen.getByLabelText("Esencial")); fireEvent.click(screen.getByLabelText("Premium"));
    fireEvent.click(screen.getByRole("button", { name: "Crear código" }));
    expect(state.createDiscount).not.toHaveBeenCalled();
  });
  it("deactivates only after confirmation and refreshes the list", async () => {
    state.discounts.mockResolvedValue([discount]);
    state.deactivateDiscount.mockImplementation(async () => { state.discounts.mockResolvedValue([{ ...discount, active: false }]); return { ...discount, active: false }; });
    mount(); fireEvent.click(screen.getByRole("button", { name: "Códigos" }));
    fireEvent.click(await screen.findByRole("button", { name: "Desactivar" }));
    expect(state.deactivateDiscount).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sí, desactivar" }));
    await waitFor(() => expect(state.deactivateDiscount).toHaveBeenCalledWith("discount-1"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Desactivar" })).toBeNull());
  });
});