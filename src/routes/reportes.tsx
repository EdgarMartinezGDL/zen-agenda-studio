import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileSpreadsheet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Banner } from "@/components/Banner";
import { appointmentsApi, organizationApi, reportsApi } from "@/lib/microfix/api";
import { useAuth } from "@/lib/microfix/auth";
import { errorText } from "@/lib/microfix-ui";
import type { Appointment, AppointmentStatus, OrganizationContext } from "@/types";

export const Route = createFileRoute("/reportes")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Reportes — Mi Agenda Zen" },
      { name: "description", content: "Ocupación, cancelaciones, ingresos y servicios más agendados." },
      { property: "og:title", content: "Reportes — Mi Agenda Zen" },
      {
        property: "og:description",
        content: "Ocupación, cancelaciones, ingresos y servicios más agendados.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <ReportesPage />
    </AppShell>
  ),
});

const STATUS_ES: Record<AppointmentStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
  ASISTIO: "Asistió",
  NO_ASISTIO: "No asistió",
  REAGENDADA: "Reagendada",
};

const RANGES = [
  { key: "7", label: "Últimos 7 días" },
  { key: "30", label: "Últimos 30 días" },
  { key: "90", label: "Últimos 90 días" },
  { key: "month", label: "Este mes" },
  { key: "custom", label: "Personalizado" },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const inputCls =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function ReportesPage() {
  const orgId = useAuth().user?.organizationId ?? "";
  const [range, setRange] = useState<RangeKey>("30");
  const [customFrom, setCustomFrom] = useState(ymd(new Date()));
  const [customTo, setCustomTo] = useState(ymd(new Date()));
  const [locationId, setLocationId] = useState("all");
  const [serviceId, setServiceId] = useState("all");

  const { from, to } = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    if (range === "month") {
      start.setDate(1);
    } else if (range === "custom") {
      const s = new Date(`${customFrom}T00:00:00`);
      const e = new Date(`${customTo}T23:59:59`);
      return { from: s.toISOString(), to: e.toISOString() };
    } else {
      start.setDate(start.getDate() - Number(range));
    }
    return { from: start.toISOString(), to: end.toISOString() };
  }, [range, customFrom, customTo]);

  const { data: context } = useQuery({
    queryKey: ["context", orgId],
    queryFn: () => organizationApi.context(orgId) as unknown as Promise<OrganizationContext>,
    enabled: !!orgId,
  });

  const { data: report } = useQuery({
    queryKey: ["report", orgId, from, to],
    queryFn: () => reportsApi.get(orgId, from, to),
    enabled: !!orgId,
  });

  const { data: appointments, isLoading, error } = useQuery({
    queryKey: ["report-appointments", orgId, from, to],
    queryFn: () =>
      appointmentsApi.list({ organizationId: orgId, from, to }) as unknown as Promise<Appointment[]>,
    enabled: !!orgId,
  });

  const locations = context?.locations ?? [];
  const services = context?.services ?? [];

  const priceOf = useMemo(
    () => (a: Appointment) => {
      const svc = services.find((s) => s.id === a.serviceId);
      if (!svc) return 0;
      const sl =
        svc.serviceLocations.find((x) => x.locationId === a.locationId) ?? svc.serviceLocations[0];
      return sl?.price ?? 0;
    },
    [services],
  );

  const rows = useMemo(() => {
    return (appointments ?? []).filter(
      (a) =>
        (locationId === "all" || a.locationId === locationId) &&
        (serviceId === "all" || a.serviceId === serviceId),
    );
  }, [appointments, locationId, serviceId]);

  const metrics = useMemo(() => {
    const byStatus: Record<AppointmentStatus, number> = {
      PENDING: 0,
      CONFIRMED: 0,
      CANCELLED: 0,
      COMPLETED: 0,
      ASISTIO: 0,
      NO_ASISTIO: 0,
      REAGENDADA: 0,
    };
    let revenue = 0;
    const byService = new Map<string, number>();

    for (const a of rows) {
      byStatus[a.status] += 1;
      if (a.status === "ASISTIO") revenue += priceOf(a);
      const name = a.service?.name ?? "Sin servicio";
      byService.set(name, (byService.get(name) ?? 0) + 1);
    }

    // Sin filtros de ubicación/servicio, los totales salen del reporte del backend.
    const unfiltered = locationId === "all" && serviceId === "all" && !!report;
    if (unfiltered) revenue = report.revenue.total;
    const done = byStatus.COMPLETED + byStatus.ASISTIO;
    return {
      byStatus,
      revenue,
      done,
      total: rows.length,
      topServices: [...byService.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [rows, priceOf, report, locationId, serviceId]);

  const locationLabel =
    locationId === "all"
      ? "Todas las ubicaciones"
      : (locations.find((l) => l.id === locationId)?.name ?? "—");
  const serviceLabel =
    serviceId === "all" ? "Todos los servicios" : (services.find((s) => s.id === serviceId)?.name ?? "—");
  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? "";

  const exportRows = () =>
    rows.map((a) => ({
      Fecha: dateTime(a.startAt),
      Paciente: a.clientName,
      Teléfono: a.clientPhone,
      Servicio: a.service?.name ?? "Sin servicio",
      Ubicación: a.location?.name ?? "Sin ubicación",
      Estado: STATUS_ES[a.status],
      Monto: a.status === "CANCELLED" ? 0 : priceOf(a),
    }));

  const downloadExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const meta = [
        ["Reporte", "Mi Agenda Zen"],
        ["Periodo", rangeLabel],
        ["Desde", from.slice(0, 10)],
        ["Hasta", to.slice(0, 10)],
        ["Ubicación", locationLabel],
        ["Servicio", serviceLabel],
        ["Citas totales", metrics.total],
        ["Citas realizadas", metrics.done],
        ["Total de ingresos (MXN)", metrics.revenue],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), "Resumen");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportRows()), "Citas");
      XLSX.writeFile(wb, `reporte-mi-agenda-zen-${from.slice(0, 10)}_${to.slice(0, 10)}.xlsx`);
    } catch {
      toast.error("No se pudo generar el archivo de Excel");
    }
  };

  const downloadPdf = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("Reporte — Mi Agenda Zen", 14, 18);
      doc.setFontSize(10);
      doc.text(
        [
          `Periodo: ${rangeLabel} (${from.slice(0, 10)} a ${to.slice(0, 10)})`,
          `Ubicación: ${locationLabel} · Servicio: ${serviceLabel}`,
          `Citas totales: ${metrics.total} · Realizadas: ${metrics.done} · Ingresos: ${money(metrics.revenue)}`,
        ],
        14,
        26,
      );
      const data = exportRows();
      autoTable(doc, {
        startY: 44,
        head: [["Fecha", "Paciente", "Teléfono", "Servicio", "Ubicación", "Estado", "Monto"]],
        body: data.map((r) => [
          r.Fecha,
          r.Paciente,
          r.Teléfono,
          r.Servicio,
          r.Ubicación,
          r.Estado,
          money(r.Monto),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [15, 118, 110] },
      });
      doc.save(`reporte-mi-agenda-zen-${from.slice(0, 10)}_${to.slice(0, 10)}.pdf`);
    } catch {
      toast.error("No se pudo generar el PDF");
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Reportes</h1>

      <section className="card-zen mb-5 space-y-3 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Rango de tiempo
            </span>
            <select className={inputCls} value={range} onChange={(e) => setRange(e.target.value as RangeKey)}>
              {RANGES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Consultorio / Ubicación
            </span>
            <select className={inputCls} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="all">Todas las ubicaciones</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">
              Tipo de servicio
            </span>
            <select className={inputCls} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="all">Todos los servicios</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {range === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">Desde</span>
              <input type="date" className={inputCls} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">Hasta</span>
              <input type="date" className={inputCls} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </label>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={downloadExcel}
            className="inline-flex flex-1 items-center justify-center gap-2 btn-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <FileSpreadsheet className="h-4 w-4" /> Descargar Excel (.xlsx)
          </button>
          <button
            onClick={downloadPdf}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-semibold text-foreground"
          >
            <Download className="h-4 w-4 text-gold" /> Descargar PDF
          </button>
        </div>
      </section>

      {error && <Banner kind="error" message={errorText(error)} />}
      {isLoading && <p className="text-sm text-muted-foreground">Cargando reporte…</p>}

      {appointments && (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {rangeLabel} · {locationLabel} · {serviceLabel}
          </p>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Citas totales" value={metrics.total} />
            <Tile label="Citas realizadas" value={metrics.done} />
            <Tile label="Canceladas" value={metrics.byStatus.CANCELLED} />
            <Tile label="Total de ingresos" value={money(metrics.revenue)} />
          </div>

          <Section title="Citas por estado">
            {(Object.keys(STATUS_ES) as AppointmentStatus[]).map((k) => (
              <Bar key={k} label={STATUS_ES[k]} value={metrics.byStatus[k]} max={metrics.total} />
            ))}
          </Section>

          <Section title="Servicios más agendados">
            {metrics.topServices.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin datos en este periodo.</p>
            )}
            {metrics.topServices.map(([name, count]) => (
              <Bar key={name} label={name} value={count} max={metrics.topServices[0]?.[1] || 1} />
            ))}
          </Section>

          <Section title="Detalle de citas">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay citas con estos filtros.</p>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{a.clientName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {dateTime(a.startAt)} · {a.service?.name ?? "Sin servicio"} ·{" "}
                        {a.location?.name ?? "Sin ubicación"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold text-muted-foreground">
                        {STATUS_ES[a.status]}
                      </p>
                      <p className="font-semibold">
                        {a.status === "CANCELLED" ? "—" : money(priceOf(a))}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card-zen p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-primary">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-zen p-4">
      <h2 className="mb-3 text-sm font-bold">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="truncate text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
