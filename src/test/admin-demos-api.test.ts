import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConvertDemoInput, CreateDemoInput } from "@/lib/microfix/types";
const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/microfix/client", () => ({ apiRequest: request }));
import { adminApi } from "@/lib/microfix/api";
beforeEach(() => request.mockReset());
describe("Demos API contract", () => {
  it("lists /demos", () => { adminApi.demos(); expect(request).toHaveBeenCalledWith("/demos"); });
  it("creates /demos with the owner's exact fields", () => {
    const input: CreateDemoInput = { businessName: "Prueba", ownerFullName: "Ana", ownerEmail: "ana@example.test", ownerPassword: "test-password", ownerPhone: "+5213312345678" };
    adminApi.createDemo(input);
    expect(request).toHaveBeenCalledWith("/demos", { method: "POST", body: input });
  });
  it("requests /demos/:id/qr", () => { adminApi.demoQr("d-1"); expect(request).toHaveBeenCalledWith("/demos/d-1/qr"); });
  it("cancels with POST /demos/:id/cancel", () => { adminApi.cancelDemo("d-1"); expect(request).toHaveBeenCalledWith("/demos/d-1/cancel", { method: "POST" }); });
  it("converts with the exact YCloud and subscription fields", () => {
    const input: ConvertDemoInput = { planCode: "PREMIUM", billingCycle: "YEARLY", paymentMethod: "BANK_TRANSFER", phoneNumber: "+5213312345678", businessAccountId: "waba-test", ycloudApiKey: "test-key", ycloudWebhookSecret: "test-secret" };
    adminApi.convertDemo("d-1", input);
    expect(request).toHaveBeenCalledWith("/demos/d-1/convert", { method: "POST", body: input });
  });
});