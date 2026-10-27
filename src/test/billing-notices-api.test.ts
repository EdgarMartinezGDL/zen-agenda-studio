import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/microfix/client", () => ({ apiRequest: request }));
import { adminApi } from "@/lib/microfix/api";

beforeEach(() => request.mockReset());
describe("Billing notice API contract", () => {
  it("lists notices without optional parameters", () => {
    adminApi.billingNotices();
    expect(request).toHaveBeenCalledWith("/admin/billing-notices");
  });
  it("sends the page limit and encoded cursor", () => {
    adminApi.billingNotices({ limit: 20, cursor: "next+page" });
    expect(request).toHaveBeenCalledWith("/admin/billing-notices?limit=20&cursor=next%2Bpage");
  });
  it("requests the unread counter with limit 1", () => {
    adminApi.billingNotices({ limit: 1 });
    expect(request).toHaveBeenCalledWith("/admin/billing-notices?limit=1");
  });
  it("marks a notice read using PATCH without a body", () => {
    adminApi.markBillingNoticeRead("notice-1");
    expect(request).toHaveBeenCalledWith("/admin/billing-notices/notice-1/read", { method: "PATCH" });
  });
});