import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { BillingPayment } from "@/lib/microfix/types";

const state = vi.hoisted(() => ({ summary: vi.fn(), payments: vi.fn() }));
vi.mock("@/lib/microfix/api", () => ({ billingApi: state }));
import { SubscriptionCard } from "@/components/SubscriptionCard";

const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.resetAllMocks(); });

it.each([
  ["PAID", null], ["FAILED", null], ["REFUNDED", null], ["REFUNDED", "2026-10-29T12:00:00Z"],
] as const)("preserves amount and invoice for professional %s history with refund date %s", async (status, refundedAt) => {
  const payment: BillingPayment = {
    id: "payment-1", status, refundedAt, amountCents: 12345, currency: "MXN",
    periodStart: null, periodEnd: null, paidAt: "2026-10-28T12:00:00Z",
    failureReason: null, failureText: null, invoiceUrl: "https://example.test/invoice-1",
    createdAt: "2026-10-27T12:00:00Z",
  };
  state.summary.mockResolvedValue({ status: "ACTIVE", action: "NONE", managedByStripe: true, canOpenPortal: false });
  state.payments.mockResolvedValue([payment]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><SubscriptionCard orgId="org-1" /></QueryClientProvider>);
  const invoice = await screen.findByRole("link", { name: /Ver factura/ });
  expect(invoice.getAttribute("href")).toBe("https://example.test/invoice-1");
  expect(screen.getByText((12345 / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" }))).toBeTruthy();
  expect(state.payments).toHaveBeenCalledWith("org-1");
});