import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ list: vi.fn(), pause: vi.fn(), resume: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => ({ options }), Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/lib/microfix/auth", () => ({ useAuth: () => ({ user: { organizationId: "org-1" } }) }));
vi.mock("@/lib/microfix/api", () => ({ pausedApi: api }));
import { Route } from "@/routes/pausados";
const clients: QueryClient[] = [];
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  const Page = Route.options.component;
  if (typeof Page !== "function") throw new Error("Missing paused page");
  return render(<QueryClientProvider client={client}><Page /></QueryClientProvider>);
}
beforeEach(() => { vi.resetAllMocks(); api.list.mockResolvedValue([]); });
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); });
it("trims the phone before pausing and refreshes the list", async () => {
  api.pause.mockResolvedValue({ changed: true });
  mount();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: " +5215512345678 " } });
  fireEvent.click(screen.getByRole("button", { name: "Pausar IA" }));
  await waitFor(() => expect(api.pause).toHaveBeenCalledWith("org-1", "+5215512345678"));
  await waitFor(() => expect(api.list.mock.calls.length).toBeGreaterThan(1));
  expect(screen.getByRole("textbox")).toHaveValue("");
});
it("resumes the selected phone and refreshes paused conversations", async () => {
  api.list.mockResolvedValue([{ id: "p-1", phone: "+5215512345678", name: "Ana", origin: "BOT", pausedAt: "2026-10-24T00:00:00Z" }]);
  api.resume.mockResolvedValue({ changed: true });
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Reanudar IA" }));
  await waitFor(() => expect(api.resume).toHaveBeenCalledWith("org-1", "+5215512345678"));
  await waitFor(() => expect(api.list.mock.calls.length).toBeGreaterThan(1));
});