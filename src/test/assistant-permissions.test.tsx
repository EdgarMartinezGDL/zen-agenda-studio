import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "ASSISTANT", suspended: false, pushEnabled: true,
  context: vi.fn(), appointments: vi.fn(), report: vi.fn(), features: vi.fn(),
  billing: vi.fn(), subscription: vi.fn(), plan: vi.fn(), banner: vi.fn(),
  enablePush: vi.fn(), profile: vi.fn(), locations: vi.fn(),
  excelSummary: vi.fn(), excelRows: vi.fn(), writeExcel: vi.fn(),
  pdfText: vi.fn(), pdfTable: vi.fn(), savePdf: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options, useSearch: () => ({}) }),
  useNavigate: () => vi.fn(), useRouterState: () => "/negocio",
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/lib/microfix/auth", () => ({ useAuth: () => ({
  ready: true, user: { organizationId: "org-1", role: state.role }, logout: vi.fn(),
}) }));
vi.mock("@/lib/microfix/api", () => ({
  organizationApi: { get: async () => ({ name: "Clínica", accessSuspended: state.suspended }), context: state.context, planFeatures: state.features },
  appointmentsApi: { list: state.appointments }, reportsApi: { get: state.report },
  locationsApi: { list: state.locations }, authApi: { me: state.profile },
  pushApi: { vapidPublicKey: async () => ({ publicKey: "test" }) },
}));
vi.mock("@/components/SubscriptionCard", () => ({
  SubscriptionCard: () => { state.subscription(); return null; },
  useBillingSummary: (id: string) => { state.billing(id); return { data: undefined }; },
}));
vi.mock("@/components/SubscriptionBanner", () => ({ SubscriptionBanner: () => { state.banner(); return null; } }));
vi.mock("@/components/PlanCard", () => ({ PlanCard: () => { state.plan(); return null; } }));
vi.mock("@/components/NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/PausedBanner", () => ({ PausedBanner: () => null }));
vi.mock("@/lib/branding", () => ({ applyBranding: vi.fn() }));
vi.mock("@/lib/theme", () => ({ useTheme: () => ({ theme: "light", toggle: vi.fn() }) }));
vi.mock("@/lib/microfix/push", () => ({
  registerServiceWorker: async () => undefined, refreshPush: vi.fn(), disablePushOnLogout: vi.fn(),
  getPushState: async () => "off", enablePush: state.enablePush, disablePush: vi.fn(),
}));
vi.mock("xlsx", () => ({ utils: {
  book_new: () => ({}), aoa_to_sheet: state.excelSummary, json_to_sheet: state.excelRows, book_append_sheet: vi.fn(),
}, writeFile: state.writeExcel }));
vi.mock("jspdf", () => ({ jsPDF: class {
  setFontSize() {} text = state.pdfText; save = state.savePdf;
} }));
vi.mock("jspdf-autotable", () => ({ default: state.pdfTable }));

import { Route as Negocio } from "@/routes/negocio";
import { Route as Reportes } from "@/routes/reportes";
import { AppShell } from "@/components/AppShell";
import { PushNotificationsCard } from "@/components/PushNotificationsCard";

const clients: QueryClient[] = [];
function mount(element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}
function page(route: typeof Negocio | typeof Reportes) {
  const Page = route.options.component;
  if (typeof Page !== "function") throw new Error("Missing page");
  return <Page />;
}
beforeEach(() => {
  vi.clearAllMocks();
  state.role = "ASSISTANT"; state.suspended = false; state.pushEnabled = true;
  state.features.mockImplementation(async () => ({ pushEnabled: state.pushEnabled }));
  state.context.mockResolvedValue({ timezone: "America/Mexico_City", locations: [], services: [
    { id: "svc-1", serviceLocations: [{ locationId: "loc-1", price: 750 }] },
  ] });
  state.appointments.mockResolvedValue([{
    id: "a-1", clientName: "Ana", clientPhone: "5555555555", status: "ASISTIO",
    startAt: "2026-11-05T15:00:00Z", serviceId: "svc-1", locationId: "loc-1",
  }]);
  state.report.mockResolvedValue({});
  state.profile.mockResolvedValue({ email: "test@example.test", shortSession: false });
  state.locations.mockResolvedValue([]);
});
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); });

it("limits ASSISTANT account access without mounting subscription or plan and keeps push activation", async () => {
  mount(page(Negocio));
  fireEvent.click(screen.getByRole("button", { name: /Mi Cuenta/ }));
  await waitFor(() => expect(state.profile).toHaveBeenCalledOnce());
  expect(state.locations).not.toHaveBeenCalled();
  expect(state.subscription).not.toHaveBeenCalled();
  expect(state.plan).not.toHaveBeenCalled();
  expect(state.banner).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole("button", { name: "Activar notificaciones" }));
  await waitFor(() => expect(state.enablePush).toHaveBeenCalledWith("org-1"));
  expect(state.billing).toHaveBeenCalledWith("");
  expect(state.billing).not.toHaveBeenCalledWith("org-1");
});

it("retains PROFESSIONAL configuration and plan access", async () => {
  state.role = "PROFESSIONAL";
  mount(page(Negocio));
  fireEvent.click(screen.getByRole("button", { name: "Configuración" }));
  expect(state.subscription).toHaveBeenCalled();
  expect(state.plan).toHaveBeenCalled();
  expect(state.banner).toHaveBeenCalled();
  expect(state.billing).toHaveBeenCalledWith("org-1");
});

it.each([false, true])("shows assistant suspension alert only when accessSuspended=%s", async suspended => {
  state.suspended = suspended;
  mount(<AppShell><div>Content</div></AppShell>);
  await waitFor(() => expect(clients[0]?.getQueryData(["organization", "org-1"])).toBeDefined());
  expect(screen.queryAllByRole("alert")).toHaveLength(suspended ? 1 : 0);
  expect(state.banner).not.toHaveBeenCalled();
});

it("removes assistant push controls when pushEnabled is false", async () => {
  state.pushEnabled = false;
  mount(<PushNotificationsCard orgId="org-1" />);
  await waitFor(() => expect(clients[0]?.getQueryData(["plan-features", "org-1"])).toEqual({ pushEnabled: false }));
  expect(screen.queryByRole("button", { name: "Activar notificaciones" })).toBeNull();
  expect(state.enablePush).not.toHaveBeenCalled();
  expect(state.billing).not.toHaveBeenCalledWith("org-1");
});

it.each(["ASSISTANT", "PROFESSIONAL"])("exports permitted financial fields for %s", async role => {
  state.role = role;
  if (role === "PROFESSIONAL") state.report.mockResolvedValue({ revenue: { total: 1500 } });
  mount(page(Reportes));
  await screen.findByText("Ana");
  await waitFor(() => expect(clients[0]?.getQueryCache().findAll({ queryKey: ["report"] })[0]?.state.status).toBe("success"));
  fireEvent.click(screen.getByRole("button", { name: /Descargar Excel/ }));
  await waitFor(() => expect(state.writeExcel).toHaveBeenCalledOnce());
  const expected = role === "ASSISTANT" ? {} : { Monto: 750 };
  const exported = state.excelRows.mock.calls[0]?.[0]?.[0];
  if (role === "ASSISTANT") expect(exported).not.toHaveProperty("Monto");
  else expect(exported).toMatchObject(expected);
  const income = state.excelSummary.mock.calls[0]?.[0].filter((row: unknown[]) => row[0] === "Total de ingresos (MXN)");
  expect(income).toEqual(role === "ASSISTANT" ? [] : [["Total de ingresos (MXN)", 1500]]);
  fireEvent.click(screen.getByRole("button", { name: "Descargar PDF" }));
  await waitFor(() => expect(state.savePdf).toHaveBeenCalledOnce());
  const table = state.pdfTable.mock.calls[0]?.[1];
  expect(table.head[0]).toHaveLength(role === "ASSISTANT" ? 6 : 7);
  expect(table.body[0]).toHaveLength(role === "ASSISTANT" ? 6 : 7);
  const summary = state.pdfText.mock.calls[1]?.[0]?.[2];
  expect(summary.includes("Ingresos:")).toBe(role === "PROFESSIONAL");
});