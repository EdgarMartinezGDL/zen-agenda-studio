import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/microfix/client";
const fetchMock = vi.fn();
beforeEach(() => { localStorage.clear(); fetchMock.mockReset().mockResolvedValue(new Response('{}')); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());
it("leaves multipart boundary and FormData serialization to the browser", async () => {
  const form = new FormData(); form.append("file", new File(["text"], "consulta.txt"));
  await apiRequest("/knowledge/org-1/documents", { method: "POST", body: form });
  const options = fetchMock.mock.calls[0]?.[1];
  expect(options.body).toBe(form);
  expect(options.headers).not.toHaveProperty("Content-Type");
});
it("preserves JSON requests", async () => {
  await apiRequest("/conversation-context/org-1/pause", { method: "POST", body: { phone: "+5215512345678" } });
  const options = fetchMock.mock.calls[0]?.[1];
  expect(options.body).toBe('{"phone":"+5215512345678"}');
  expect(options.headers["Content-Type"]).toBe("application/json");
});