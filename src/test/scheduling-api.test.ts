import { beforeEach, expect, it, vi } from "vitest";
const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/microfix/client", () => ({ apiRequest: request }));
import { appointmentsApi } from "@/lib/microfix/api";

beforeEach(() => request.mockReset());
const data = { organizationId: "org-1", clientName: "Ana", clientPhone: "+525555555555", locationId: "loc-1", serviceId: "svc-1", startAt: "2026-10-30T14:00:00Z", endAt: "2026-10-30T14:30:00Z" };
it.each([
  [false, false, "/appointments"],
  [true, false, "/appointments?raiseCapacityIfFull=true"],
  [false, true, "/appointments?force=true"],
  [true, true, "/appointments?raiseCapacityIfFull=true&force=true"],
] as const)("creates with raise=%s force=%s", (raise, force, url) => {
  appointmentsApi.create(data, raise, force);
  expect(request).toHaveBeenCalledWith(url, { method: "POST", body: data });
});
it("preserves the default create URL", () => {
  appointmentsApi.create(data);
  expect(request).toHaveBeenCalledWith("/appointments", { method: "POST", body: data });
});
it.each([false, true])("reschedules with force=%s", force => {
  const body = { startAt: data.startAt, endAt: data.endAt };
  appointmentsApi.reschedule("a-1", body, force);
  expect(request).toHaveBeenCalledWith(`/appointments/a-1/reschedule?by=PROFESSIONAL${force ? "&force=true" : ""}`, { method: "PATCH", body });
});
it("preserves the default reschedule URL", () => {
  const body = { startAt: data.startAt, endAt: data.endAt };
  appointmentsApi.reschedule("a-1", body);
  expect(request).toHaveBeenCalledWith("/appointments/a-1/reschedule?by=PROFESSIONAL", { method: "PATCH", body });
});