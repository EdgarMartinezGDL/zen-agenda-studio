import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminDemo, DemoStatus } from "@/lib/microfix/types";

const api = vi.hoisted(() => ({
  demos: vi.fn(), createDemo: vi.fn(), demoQr: vi.fn(), cancelDemo: vi.fn(), convertDemo: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => ({ options }) }));
vi.mock("@/components/AdminShell", () => ({ AdminShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/lib/microfix/api", () => ({ adminApi: api }));
import { Route } from "@/routes/admin/demos";

const demo = (status: DemoStatus): AdminDemo => ({
  id: "demo-1", organizationId: "org-1", organizationName: "Negocio de prueba", status,
  firstConnectionAt: null, expiresAt: null, purgeAt: null, createdAt: "2026-10-24T00:00:00Z",
});
const clients: QueryClient[] = [];
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  const Page = Route.options.component;
  if (typeof Page !== "function") throw new Error("Missing Demos component");
  render(<QueryClientProvider client={client}><Page /></QueryClientProvider>);
  return client;
}
beforeEach(() => { vi.resetAllMocks(); api.demos.mockResolvedValue([]); });
afterEach(() => { cleanup(); clients.splice(0).forEach((c) => c.clear()); });

describe("Demo action rules", () => {
  it.each([
    ["CREATING", true, false, false], ["QR_PENDING", true, true, false],
    ["ACTIVE", false, true, true], ["EXPIRED", false, false, true],
    ["CANCELLED", false, false, true], ["CONVERTED", false, false, false],
    ["PURGED", false, false, false],
  ] as const)("enforces QR/cancel/convert permissions for %s", async (status, qr, cancel, convert) => {
    api.demos.mockResolvedValue([demo(status)]);
    mount();
    await screen.findByRole("heading", { name: "Negocio de prueba" });
    expect(!!screen.queryByRole("button", { name: "Mostrar QR" })).toBe(qr);
    expect(!!screen.queryByRole("button", { name: "Cancelar demo" })).toBe(cancel);
    expect(!!screen.queryByRole("button", { name: "Convertir a cliente" })).toBe(convert);
  });

  it("requires confirmation before cancelling a demo", async () => {
    api.demos.mockResolvedValue([demo("ACTIVE")]);
    api.cancelDemo.mockResolvedValue({ purgeAt: "2026-12-23T00:00:00Z" });
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar demo" }));
    expect(api.cancelDemo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sí, cancelar demo" }));
    await waitFor(() => expect(api.cancelDemo).toHaveBeenCalledWith("demo-1"));
  });

  it("normalizes the owner's email and opens the returned demo QR", async () => {
    api.createDemo.mockResolvedValue({ demo: { id: "demo-2", organizationId: "org-2", status: "QR_PENDING" }, qr: null });
    api.demoQr.mockResolvedValue({ demo: { id: "demo-2", organizationId: "org-2", status: "QR_PENDING" }, qr: null });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Nueva demo" }));
    const values = [
      ["Nombre del negocio", "Consultorio"], ["Nombre del dueño", "Ana"],
      ["Correo del dueño (con él entra a la app)", " ANA@EXAMPLE.TEST "],
      ["Contraseña inicial (8 a 72 caracteres; dásela al cliente)", "test-password"],
      ["WhatsApp del dueño (con lada, p. ej. +5213312345678)", "+5213312345678"],
    ] as const;
    values.forEach(([label, value]) => fireEvent.change(screen.getByLabelText(label), { target: { value } }));
    fireEvent.click(screen.getByRole("button", { name: "Crear demo y mostrar QR" }));
    await waitFor(() => expect(api.createDemo).toHaveBeenCalledWith({
      businessName: "Consultorio", ownerFullName: "Ana", ownerEmail: "ana@example.test",
      ownerPassword: "test-password", ownerPhone: "+5213312345678",
    }));
    await waitFor(() => expect(api.demoQr).toHaveBeenCalledWith("demo-2"));
  });

  it("rejects invalid E.164 phone numbers", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Nueva demo" }));
    const phone = screen.getByLabelText("WhatsApp del dueño (con lada, p. ej. +5213312345678)") as HTMLInputElement;
    fireEvent.change(phone, { target: { value: "3312345678" } });
    expect(phone.checkValidity()).toBe(false);
    fireEvent.change(phone, { target: { value: "+5213312345678" } });
    expect(phone.checkValidity()).toBe(true);
  });

  it("clears YCloud credentials when the conversion dialog closes", async () => {
    api.demos.mockResolvedValue([demo("ACTIVE")]);
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Convertir a cliente" }));
    fireEvent.change(screen.getByLabelText("API key de YCloud"), { target: { value: "test-key" } });
    fireEvent.change(screen.getByLabelText("Secreto del webhook de YCloud"), { target: { value: "test-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    fireEvent.click(screen.getByRole("button", { name: "Convertir a cliente" }));
    expect(screen.getByLabelText("API key de YCloud")).toHaveValue("");
    expect(screen.getByLabelText("Secreto del webhook de YCloud")).toHaveValue("");
    expect(api.convertDemo).not.toHaveBeenCalled();
  });

  it("stops QR requests when a demo becomes ACTIVE", async () => {
    api.demos.mockResolvedValue([demo("QR_PENDING")]);
    api.demoQr.mockResolvedValue({ demo: { id: "demo-1", organizationId: "org-1", status: "QR_PENDING" }, qr: null });
    const client = mount();
    fireEvent.click(await screen.findByRole("button", { name: "Mostrar QR" }));
    await waitFor(() => expect(api.demoQr).toHaveBeenCalledOnce());
    client.setQueryData(["admin", "demos"], [demo("ACTIVE")]);
    await waitFor(() => expect(client.getQueryCache().find({ queryKey: ["admin", "demo-qr", "demo-1"] })?.isActive()).toBe(false));
  });
});