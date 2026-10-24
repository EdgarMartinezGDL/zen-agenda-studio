import { beforeEach, describe, expect, it, vi } from "vitest";
const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/microfix/client", () => ({ apiRequest: request }));
import { knowledgeApi, organizationApi, pausedApi } from "@/lib/microfix/api";
beforeEach(() => request.mockReset());
describe("Professional API contract", () => {
  it("reads the organization's plan", () => {
    organizationApi.planFeatures("org-1");
    expect(request).toHaveBeenCalledWith("/organizations/org-1/plan-features");
  });
  it("lists paused conversations", () => {
    pausedApi.list("org-1");
    expect(request).toHaveBeenCalledWith("/conversation-context/org-1/paused");
  });
  it.each(["pause", "resume"] as const)("sends %s with the exact phone field", (action) => {
    pausedApi[action]("org-1", "+5215512345678");
    expect(request).toHaveBeenCalledWith(`/conversation-context/org-1/${action}`, { method: "POST", body: { phone: "+5215512345678" } });
  });
  it("lists knowledge documents", () => {
    knowledgeApi.list("org-1");
    expect(request).toHaveBeenCalledWith("/knowledge/org-1/documents");
  });
  it("uploads a file as FormData under file", () => {
    knowledgeApi.upload("org-1", new File(["contenido"], "consulta.md"));
    const [path, options] = request.mock.calls[0] ?? [];
    expect(path).toBe("/knowledge/org-1/documents");
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get("file").name).toBe("consulta.md");
  });
  it("deletes the organization's document", () => {
    knowledgeApi.remove("org-1", "doc-1");
    expect(request).toHaveBeenCalledWith("/knowledge/org-1/documents/doc-1", { method: "DELETE" });
  });
});