import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/microfix/client", () => ({ apiRequest: request }));
import { adminBillingApi } from "@/lib/microfix/api";

beforeEach(() => request.mockReset());
describe("Super-admin payments contract", () => {
  it("lists all subscriptions without a filter", () => {
    adminBillingApi.subscriptions();
    expect(request).toHaveBeenCalledWith("/admin/billing/subscriptions");
  });
  it.each(["SUSPENDED", "PAST_DUE", "ACTIVE"] as const)("filters %s", status => {
    adminBillingApi.subscriptions(status);
    expect(request).toHaveBeenCalledWith(`/admin/billing/subscriptions?status=${status}`);
  });
  it("reads clinic payment history through the admin endpoint", () => {
    adminBillingApi.payments("org-1");
    expect(request).toHaveBeenCalledWith("/admin/billing/org-1/payments");
  });
  it("reads current and previous prices", () => {
    adminBillingApi.prices();
    expect(request).toHaveBeenCalledWith("/admin/billing/prices");
  });
  it("sends plan, cycle and cents for a price change", () => {
    const body = { planCode: "PREMIUM", billingCycle: "YEARLY" as const, amountCents: 123450 };
    adminBillingApi.createPrice(body);
    expect(request).toHaveBeenCalledWith("/admin/billing/prices", { method: "POST", body });
  });
  it("retries migrating a price without a body", () => {
    adminBillingApi.migratePrice("price-1");
    expect(request).toHaveBeenCalledWith("/admin/billing/prices/price-1/migrate", { method: "POST" });
  });
  it("lists discounts", () => {
    adminBillingApi.discounts();
    expect(request).toHaveBeenCalledWith("/admin/billing/discounts");
  });
  it("preserves discount field names and optional values", () => {
    const body = { code: "ZEN20", type: "PERCENT" as const, value: 20, duration: "REPEATING" as const, durationMonths: 3, planCodes: ["PREMIUM"], expiresAt: "2027-01-01T00:00:00Z", maxRedemptions: 10 };
    adminBillingApi.createDiscount(body);
    expect(request).toHaveBeenCalledWith("/admin/billing/discounts", { method: "POST", body });
  });
  it("deactivates a discount without a body", () => {
    adminBillingApi.deactivateDiscount("discount-1");
    expect(request).toHaveBeenCalledWith("/admin/billing/discounts/discount-1/deactivate", { method: "POST" });
  });
});