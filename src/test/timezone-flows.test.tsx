import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ context: vi.fn(), appointments: vi.fn(), create: vi.fn(), reschedule: vi.fn(), events: vi.fn(), updateEvent: vi.fn(), report: vi.fn(), navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => ({ options, useSearch: () => ({}) }), useNavigate: () => state.navigate }));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/PausedBanner", () => ({ PausedBanner: () => null }));
vi.mock("@/lib/microfix/auth", () => ({ useAuth: () => ({ user: { organizationId: "org-1" } }) }));
vi.mock("@/lib/microfix/api", () => ({
  organizationApi: { context: state.context },
  appointmentsApi: { list: state.appointments, create: state.create, reschedule: state.reschedule },
  eventsApi: { list: state.events, update: state.updateEvent, registrations: vi.fn(async () => []) },
  reportsApi: { get: state.report },
}));
import { Route as Agenda } from "@/routes/index";
import { Route as Eventos } from "@/routes/eventos";
import { Route as Reportes } from "@/routes/reportes";

const clients: QueryClient[] = [];
function mount(route: typeof Agenda | typeof Eventos | typeof Reportes) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  const Page = route.options.component;
  if (typeof Page !== "function") throw new Error("Missing page");
  render(<QueryClientProvider client={client}><Page /></QueryClientProvider>);
}
const location = { id: "loc-1", name: "Cancún", timezone: "America/Cancun", isActive: true };
const appointment = { id: "a-1", organizationId: "org-1", clientName: "Ana", clientPhone: "+525555555555", age: 20, notes: "Consulta", locationId: "loc-1", serviceId: "svc-1", startAt: "2026-10-30T14:00:00Z", endAt: "2026-10-30T14:30:00Z", status: "CONFIRMED", location, service: { id: "svc-1", name: "Consulta" } };
beforeEach(() => {
  vi.resetAllMocks();
  state.context.mockResolvedValue({ timezone: "America/Mexico_City", locations: [location], services: [{ id: "svc-1", name: "Consulta", durationMinutes: 30, serviceLocations: [] }] });
  state.appointments.mockResolvedValue([appointment]);
  state.create.mockResolvedValue(appointment);
  state.reschedule.mockResolvedValue(appointment);
  state.events.mockResolvedValue([]);
  state.report.mockResolvedValue(null);
});
afterEach(() => { cleanup(); clients.splice(0).forEach(c => c.clear()); });

it("captures a new appointment in the selected sede timezone", async () => {
  mount(Agenda);
  await screen.findByRole("button", { name: /Ana/ });
  fireEvent.click(screen.getByRole("button", { name: "Nueva cita" }));
  fireEvent.change(screen.getByLabelText("Cliente *"), { target: { value: "Laura" } });
  fireEvent.change(screen.getByLabelText("Teléfono *"), { target: { value: "+525555555555" } });
  fireEvent.change(screen.getByLabelText("Edad (opcional)"), { target: { value: "25" } });
  await waitFor(() => expect(screen.getByRole("option", { name: "Cancún" })).toBeTruthy());
  fireEvent.change(screen.getByLabelText("Ubicación *"), { target: { value: "loc-1" } });
  fireEvent.change(screen.getByLabelText("Servicio (opcional)"), { target: { value: "svc-1" } });
  fireEvent.change(screen.getByLabelText("Fecha *"), { target: { value: "2026-10-30" } });
  fireEvent.change(screen.getByLabelText("Hora *"), { target: { value: "09:00" } });
  fireEvent.change(screen.getByLabelText("Notas (opcional)"), { target: { value: "Consulta" } });
  fireEvent.click(screen.getByRole("button", { name: "Agendar cita" }));
  await waitFor(() => expect(state.create).toHaveBeenCalledWith(expect.objectContaining({ startAt: "2026-10-30T14:00:00.000Z", endAt: "2026-10-30T14:30:00.000Z" }), false));
});

it("prefills rescheduling and checks collisions using the appointment sede day", async () => {
  mount(Agenda);
  fireEvent.click(await screen.findByRole("button", { name: /Ana/ }));
  fireEvent.click(screen.getByRole("button", { name: "Reagendar" }));
  fireEvent.click(screen.getByRole("button", { name: "Reagendar Cita" }));
  expect(screen.getByLabelText("Nueva fecha")).toHaveValue("2026-10-30");
  expect(screen.getByLabelText("Nueva hora")).toHaveValue("09:00");
  await waitFor(() => expect(state.appointments).toHaveBeenCalledWith({ organizationId: "org-1", from: "2026-10-30T05:00:00.000Z", to: "2026-10-31T04:59:59.999Z" }));
  fireEvent.change(screen.getByLabelText("Nueva hora"), { target: { value: "10:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar nueva fecha" }));
  await waitFor(() => expect(state.reschedule).toHaveBeenCalledWith("a-1", { startAt: "2026-10-30T15:00:00.000Z", endAt: "2026-10-30T15:30:00.000Z" }));
});

it("edits event fields in sede time and submits the real UTC instant", async () => {
  state.events.mockResolvedValue([{ id: "ev-1", name: "Taller", startAt: "2026-10-30T14:00:00Z", endAt: "2026-10-30T15:00:00Z", location, locationId: "loc-1", capacity: 10, bookedCount: 0, isActive: true }]);
  state.updateEvent.mockResolvedValue({ id: "ev-1" });
  mount(Eventos);
  fireEvent.click(await screen.findByRole("button", { name: /Taller/ }));
  expect(screen.getByLabelText("Inicio")).toHaveValue("2026-10-30T09:00");
  expect(screen.getByLabelText("Fin")).toHaveValue("2026-10-30T10:00");
  fireEvent.click(screen.getByRole("button", { name: "Modificar evento" }));
  fireEvent.click(screen.getByRole("button", { name: "Sí, editar" }));
  fireEvent.change(screen.getByLabelText("Inicio"), { target: { value: "2026-10-30T11:00" } });
  fireEvent.change(screen.getByLabelText("Fin"), { target: { value: "2026-10-30T12:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
  await waitFor(() => expect(state.updateEvent).toHaveBeenCalledWith("ev-1", expect.objectContaining({ startAt: "2026-10-30T16:00:00.000Z", endAt: "2026-10-30T17:00:00.000Z" })));
});

it("requests personalized reports for complete clinic days", async () => {
  mount(Reportes);
  await waitFor(() => expect(state.report).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText("Rango de tiempo"), { target: { value: "custom" } });
  fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-10-30" } });
  fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-10-31" } });
  await waitFor(() => expect(state.report).toHaveBeenCalledWith("org-1", "2026-10-30T06:00:00.000Z", "2026-11-01T05:59:59.999Z"));
});