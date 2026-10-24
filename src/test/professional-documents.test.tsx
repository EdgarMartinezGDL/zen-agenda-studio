import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanFeatures } from "@/lib/microfix/types";
const api = vi.hoisted(() => ({ plan: vi.fn(), list: vi.fn(), upload: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/microfix/api", () => ({ organizationApi: { planFeatures: api.plan }, knowledgeApi: { list: api.list, upload: api.upload, remove: api.remove } }));
import { DocumentsTab } from "@/components/DocumentsTab";
const clients: QueryClient[] = [];
const plan: PlanFeatures = { profile: "PAID", planCode: "PREMIUM", maxLocations: 3, maxServices: null, eventsEnabled: true, smartCancellationEnabled: true, ragEnabled: true, pushEnabled: true };
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  const rendered = render(<QueryClientProvider client={client}><DocumentsTab orgId="org-1" /></QueryClientProvider>);
  return { client, ...rendered };
}
beforeEach(() => {
  vi.resetAllMocks();
  api.plan.mockResolvedValue(plan);
  api.list.mockResolvedValue({ documents: [], usage: { documents: 0, maxDocuments: 10, bytes: 0, maxBytes: 104857600 } });
  api.upload.mockResolvedValue({ id: "doc-1", status: "PROCESSING" });
});
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); });
describe("Document rules", () => {
  it.each([
    ["PAID", "ESSENTIAL"], ["DEMO", null], ["NONE", null],
  ] as const)("does not read or upload documents for %s %s without ragEnabled", async (profile, planCode) => {
    api.plan.mockResolvedValue({ ...plan, profile, planCode, ragEnabled: false });
    mount();
    await waitFor(() => expect(api.plan).toHaveBeenCalledWith("org-1"));
    await waitFor(() => expect(screen.queryByText("Cargando…")).toBeNull());
    expect(api.list).not.toHaveBeenCalled();
    expect(api.upload).not.toHaveBeenCalled();
  });
  it("rejects files above 20 MB", async () => {
    const { container } = mount();
    await screen.findByRole("button", { name: "Subir documento" });
    const input = container.querySelector('input[type="file"]');
    if (!input) throw new Error("Missing file input");
    const file = new File(["text"], "large.pdf");
    Object.defineProperty(file, "size", { value: 20 * 1024 * 1024 + 1 });
    fireEvent.change(input, { target: { files: [file] } });
    expect(api.upload).not.toHaveBeenCalled();
  });
  it("accepts a file exactly 20 MB and refreshes the document list", async () => {
    const { container } = mount();
    await screen.findByRole("button", { name: "Subir documento" });
    const input = container.querySelector('input[type="file"]');
    if (!input) throw new Error("Missing file input");
    const file = new File(["text"], "limit.pdf");
    Object.defineProperty(file, "size", { value: 20 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(api.upload).toHaveBeenCalledWith("org-1", file));
    await waitFor(() => expect(api.list.mock.calls.length).toBeGreaterThan(1));
  });
  it("polls every 3000 ms only while documents are PROCESSING", async () => {
    api.list.mockResolvedValue({ documents: [{ id: "doc-1", fileName: "consulta.md", status: "PROCESSING", sizeBytes: 100, createdAt: "2026-10-24T00:00:00Z" }] });
    const { client } = mount();
    await screen.findByRole("button", { name: "Eliminar consulta.md" });
    const query = client.getQueryCache().find({ queryKey: ["knowledge", "org-1"] });
    const interval = query?.observers[0]?.options.refetchInterval;
    if (typeof interval !== "function" || !query) throw new Error("Missing polling rule");
    expect(interval(query)).toBe(3000);
    client.setQueryData(["knowledge", "org-1"], { documents: [{ status: "READY" }] });
    expect(interval(query)).toBe(false);
  });
});