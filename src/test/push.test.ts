import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { ApiError } from "@/lib/microfix/client";
import { pushApi } from "@/lib/microfix/api";
import { disablePush, disablePushOnLogout, enablePush, getPushState, refreshPush } from "@/lib/microfix/push";

vi.mock("@/lib/microfix/api", () => ({
  pushApi: { vapidPublicKey: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() },
}));

const subscription = {
  endpoint: "https://push.example/device",
  toJSON: vi.fn(() => ({ endpoint: "https://push.example/device" })),
  unsubscribe: vi.fn(async () => true),
};
const registration = {
  pushManager: { getSubscription: vi.fn(async () => subscription), subscribe: vi.fn(async () => subscription) },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", { permission: "granted", requestPermission: vi.fn(async () => "granted") });
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: {
    register: vi.fn(async () => registration), ready: Promise.resolve(registration),
  } });
  vi.mocked(pushApi.vapidPublicKey).mockResolvedValue({ publicKey: "AQID" });
  vi.mocked(pushApi.subscribe).mockResolvedValue({ id: "sub-1" });
  vi.mocked(pushApi.unsubscribe).mockResolvedValue(undefined);
});

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("Device push contract", () => {
  it("registers the device subscription for its organization", async () => {
    await enablePush("org-1");
    expect(pushApi.subscribe).toHaveBeenCalledWith("org-1", { endpoint: "https://push.example/device" });
  });

  it("rolls back the browser subscription on a plan 403 and preserves the provider message", async () => {
    const failure = new ApiError("PLAN_FEATURE_NOT_INCLUDED", 403);
    vi.mocked(pushApi.subscribe).mockRejectedValueOnce(failure);
    await expect(enablePush("org-1")).rejects.toBe(failure);
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("does not subscribe when VAPID is unavailable with 503", async () => {
    vi.mocked(pushApi.vapidPublicKey).mockRejectedValueOnce(new ApiError("Unavailable", 503));
    await expect(enablePush("org-1")).rejects.toMatchObject({ status: 503 });
    expect(pushApi.subscribe).not.toHaveBeenCalled();
  });

  it("removes the device from both the backend and browser", async () => {
    await disablePush("org-1");
    expect(pushApi.unsubscribe).toHaveBeenCalledWith("org-1", "https://push.example/device");
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("renews an enabled subscription on opening the app", async () => {
    await refreshPush("org-1");
    expect(pushApi.subscribe).toHaveBeenCalledWith("org-1", subscription.toJSON());
  });

  it("limits logout cleanup to 3000 milliseconds", async () => {
    vi.useFakeTimers();
    vi.mocked(pushApi.unsubscribe).mockImplementationOnce(() => new Promise(() => {}));
    let finished = false;
    const cleanup = disablePushOnLogout("org-1").then(() => { finished = true; });
    await vi.advanceTimersByTimeAsync(2999);
    expect(finished).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await cleanup;
    expect(finished).toBe(true);
  });

  it("does not register a worker when the context is insecure", async () => {
    vi.stubGlobal("isSecureContext", false);
    expect(await getPushState()).toBe("insecure");
    expect(navigator.serviceWorker.register).not.toHaveBeenCalled();
  });
});

describe("Notification destination safety", () => {
  it.each([
    ["https://other.example/phishing", "https://miagenda-zen.lovable.app/"],
    ["/?abrir=notificaciones", "https://miagenda-zen.lovable.app/?abrir=notificaciones"],
  ])("keeps destination %s on the app origin", async (destination, expected) => {
    const handlers: Record<string, (event: unknown) => void> = {};
    const openWindow = vi.fn(async () => {});
    runInNewContext(readFileSync("public/sw.js", "utf8"), {
      URL,
      self: {
        location: { origin: "https://miagenda-zen.lovable.app" },
        addEventListener: (type: string, handler: (event: unknown) => void) => { handlers[type] = handler; },
        clients: { matchAll: async () => [], openWindow },
      },
    });
    let pending: Promise<void> | undefined;
    handlers["notificationclick"]?.({
      notification: { data: { url: destination }, close: vi.fn() },
      waitUntil: (promise: Promise<void>) => { pending = promise; },
    });
    await pending;
    expect(openWindow).toHaveBeenCalledWith(expected);
  });
});