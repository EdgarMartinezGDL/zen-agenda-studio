import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ organizations: vi.fn(), planFeatures: vi.fn(), aiUsage: vi.fn(), changePlan: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => ({ options }) }));
vi.mock("@/components/AdminShell", () => ({ AdminShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/lib/microfix/api", () => ({ adminApi: state }));
import { Route } from "@/routes/admin/index";

const clients: QueryClient[] = [];
beforeEach(() => {
  vi.resetAllMocks();
  state.organizations.mockResolvedValue([{ id: "org-1", name: "Clínica Zen", createdAt: "2026-10-28T00:00:00Z", aiPausedAt: null }]);
  state.planFeatures.mockResolvedValue({ profile: "PAID", planCode: "ESSENTIAL" });
  state.aiUsage.mockResolvedValue({ aiPausedAt: null, period: null });
});
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); });
describe("Stripe plan change financial results", () => {
  it.each([
    [12345, /se cobró la diferencia:.*123\.45/],
    [-12345, /saldo a favor de.*123\.45.*siguientes cobros/],
    [0, /no hubo diferencia por cobrar/],
    [null, /no hubo diferencia por cobrar/],
  ])("interprets %s cents returned by Stripe", async (cents, expected) => {
    state.changePlan.mockResolvedValue({ organizationId: "org-1", changed: true, fromPlan: "ESSENTIAL", toPlan: "PREMIUM", excess: { locations: { active: 1, max: 3, exceeded: false }, services: { active: 1, max: null, exceeded: false } }, stripe: { proratedAmountCents: cents, stripeInvoiceId: null } });
    const Page = Route.options.component;
    if (typeof Page !== "function") throw new Error("Missing Organizations component");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); clients.push(client);
    render(<QueryClientProvider client={client}><Page /></QueryClientProvider>);
    fireEvent.change(await screen.findByLabelText("Cambiar plan"), { target: { value: "PREMIUM" } });
    fireEvent.click(screen.getByRole("button", { name: "Cambiar", exact: true }));
    expect(state.changePlan).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sí, cambiar", exact: true }));
    expect(await screen.findByText(expected)).toBeTruthy();
    expect(state.changePlan).toHaveBeenCalledWith("org-1", "PREMIUM");
  });
});