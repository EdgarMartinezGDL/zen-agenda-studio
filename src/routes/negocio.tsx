import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, MapPin, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { PushNotificationsCard } from "@/components/PushNotificationsCard";
import { DocumentsTab } from "@/components/DocumentsTab";
import { PlanCard } from "@/components/PlanCard";
import { Banner } from "@/components/Banner";
import { Modal } from "@/components/Modal";
import { Confirm } from "@/components/Confirm";
import { Field, inputCls } from "@/routes/index";
import {
  aiSettingsApi,
  appointmentSlotsApi,
  authApi,
  businessHoursApi,
  locationsApi,
  organizationApi,
  serviceLocationsApi,
  servicesApi,
  type CreateLocationInput,
  type CreateServiceInput,
  type UpdateBrandingInput,
  type UpdateAISettingsInput,
} from "@/lib/microfix/api";
import { useAuth } from "@/lib/microfix/auth";
import { compact, errorText } from "@/lib/microfix-ui";
import { applyBranding } from "@/lib/branding";
import type {
  AISettings,
  AppointmentSlot,
  BusinessHour,
  Location,
  Organization,
  Service,
} from "@/types";

export const Route = createFileRoute("/negocio")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Negocio — Mi Agenda Zen" },
      {
        name: "description",
        content: "Ubicaciones, servicios, horarios, cupo y configuración de tu consultorio.",
      },
      { property: "og:title", content: "Negocio — Mi Agenda Zen" },
      {
        property: "og:description",
        content: "Ubicaciones, servicios, horarios, cupo y configuración de tu consultorio.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <NegocioPage />
    </AppShell>
  ),
});

const TABS = ["Ubicaciones", "Servicios", "Horarios", "Cupo", "Documentos", "Configuración"] as const;
type Tab = (typeof TABS)[number];


function NegocioPage() {
  const [tab, setTab] = useState<Tab>("Ubicaciones");
  const orgId = useAuth().user?.organizationId ?? "";

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Negocio</h1>

      <div className="mb-5 -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Ubicaciones" && <LocationsTab orgId={orgId} />}
      {tab === "Servicios" && <ServicesTab orgId={orgId} />}
      {tab === "Horarios" && <HoursTab orgId={orgId} />}
      {tab === "Cupo" && <SlotsTab orgId={orgId} />}
      {tab === "Documentos" && <DocumentsTab orgId={orgId} />}
      {tab === "Configuración" && <SettingsTab orgId={orgId} />}
    </div>
  );
}

function CardList({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-3">{children}</ul>;
}

function DashedButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-4 w-full rounded-lg border-2 border-dashed border-border px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
    >
      + {label}
    </button>
  );
}

/* ---------------- Ubicaciones ---------------- */

function LocationsTab({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Location | null>(null);
  const [creating, setCreating] = useState(false);
  const [readOnly, setReadOnly] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["locations", orgId],
    queryFn: () => locationsApi.list(orgId) as unknown as Promise<Location[]>,
  });

  const [form, setForm] = useState({
    name: "",
    address: "",
    mapsUrl: "",
    phone: "",
    email: "",
    isActive: true,
  });

  const open = (loc: Location | null) => {
    setError(null);
    setForm({
      name: loc?.name ?? "",
      address: loc?.address ?? "",
      mapsUrl: loc?.mapsUrl ?? "",
      phone: loc?.phone ?? "",
      email: loc?.email ?? "",
      isActive: loc?.isActive ?? true,
    });
    setEditing(loc);
    setCreating(!loc);
    setReadOnly(!!loc);
  };

  const close = () => {
    setEditing(null);
    setCreating(false);
    setReadOnly(true);
  };

  const save = useMutation({
    mutationFn: () => {
      const body = compact({
        name: form.name,
        address: form.address || undefined,
        mapsUrl: form.mapsUrl.trim() || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        isActive: form.isActive,
      }) as Omit<CreateLocationInput, "organizationId">;
      return editing
        ? locationsApi.update(editing.id, { ...body, mapsUrl: form.mapsUrl.trim() || null })
        : locationsApi.create({ organizationId: orgId, ...body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations"] });
      toast.success(editing ? "Ubicación actualizada" : "Ubicación agregada");
      close();
    },
    onError: (e: Error) => setError(errorText(e)),
  });

  const remove = useMutation({
    // El backend no borra sedes: se desactivan.
    mutationFn: () => locationsApi.update(editing!.id, { isActive: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Ubicación desactivada");
      setConfirming(false);
      close();
    },
    onError: (e: Error) => {
      setConfirming(false);
      setError(errorText(e));
    },
  });

  const mapsUrlInvalid = form.mapsUrl.trim() !== "" && !/^https?:\/\/\S+$/i.test(form.mapsUrl.trim());
  const bigInput = `${inputCls} h-12 text-base`;

  return (
    <>
      <CardList>
        {(data ?? []).map((l) => (
          <li key={l.id}>
            <button onClick={() => open(l)} className="card-zen w-full p-6 text-left hover:bg-accent/40">
              <p className="text-xl font-bold">{l.name}</p>
              <p className="mt-1 text-base text-muted-foreground">{l.address ?? "Sin dirección"}</p>
              {l.mapsUrl && (
                <span
                  role="link"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(l.mapsUrl!, "_blank", "noopener");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      window.open(l.mapsUrl!, "_blank", "noopener");
                    }
                  }}
                  className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-base font-semibold text-primary"
                >
                  <MapPin className="h-5 w-5" /> Abrir en Maps
                </span>
              )}
              {!l.isActive && (
                <span className="mt-2 block text-base text-status-completed">Inactiva</span>
              )}
            </button>
          </li>
        ))}
      </CardList>
      <DashedButton label="Nueva ubicación" onClick={() => open(null)} />

      {(editing || creating) && (
        <Modal
          open
          onClose={close}
          title={creating ? "Nueva ubicación" : readOnly ? "Ubicación" : "Editar ubicación"}
        >
          {error && <Banner kind="error" message={error} />}

          {editing && readOnly ? (
            <div className="space-y-4">
              <ReadRow label="Nombre" value={editing.name} />
              <ReadRow label="Dirección" value={editing.address} />
              <ReadRow label="Teléfono" value={editing.phone} />
              <ReadRow label="Correo" value={editing.email} />
              <ReadRow label="Estado" value={editing.isActive ? "Activa" : "Inactiva"} />
              {editing.mapsUrl && (
                <a
                  href={editing.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-3 text-base font-semibold text-primary"
                >
                  <MapPin className="h-5 w-5" /> Abrir en Maps
                </a>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setReadOnly(false)}
                  className="flex-1 inline-flex items-center justify-center gap-2 btn-primary px-4 py-3 text-base font-semibold text-primary-foreground"
                >
                  <Pencil className="h-5 w-5" /> Editar
                </button>
                <button
                  aria-label="Eliminar ubicación"
                  onClick={() => setConfirming(true)}
                  className="rounded-md border border-border px-4 py-3 text-destructive"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-base">
              <Field label="Nombre">
                <input className={bigInput} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Dirección">
                <input className={bigInput} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
              <Field label="Enlace de Google Maps">
                <input
                  type="url"
                  className={bigInput}
                  placeholder="https://maps.app.goo.gl/..."
                  value={form.mapsUrl}
                  onChange={(e) => setForm({ ...form, mapsUrl: e.target.value })}
                />
              </Field>
              {mapsUrlInvalid && (
                <p className="-mt-2 text-sm text-destructive">
                  Ingresa un enlace válido que empiece con https://
                </p>
              )}
              <Field label="Teléfono">
                <input className={bigInput} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Correo">
                <input className={bigInput} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              {editing && (
                <label className="flex items-center gap-2 text-base font-medium">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                  Activa
                </label>
              )}
              <button
                onClick={() => save.mutate()}
                disabled={save.isPending || mapsUrlInvalid || !form.name.trim()}
                className="w-full btn-primary px-4 py-3 text-base font-semibold text-primary-foreground disabled:opacity-60"
              >
                Guardar
              </button>
            </div>
          )}
        </Modal>
      )}

      <Confirm
        open={confirming}
        message={`Se desactivará “${editing?.name ?? ""}” (no se borra). ¿Deseas continuar?`}
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

function ReadRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="border-b border-border pb-3">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="text-lg">{value?.trim() ? value : "—"}</p>
    </div>
  );
}

/* ---------------- Servicios ---------------- */

function ServicesTab({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    durationMinutes: "55",
    requiredAttendees: "1",
    isActive: true,
  });

  const { data } = useQuery({
    queryKey: ["services", orgId],
    queryFn: () => servicesApi.list(orgId) as unknown as Promise<Service[]>,
  });

  const editing = (data ?? []).find((s) => s.id === editingId) ?? null;

  const open = (s: Service | null) => {
    setError(null);
    setForm({
      name: s?.name ?? "",
      description: s?.description ?? "",
      durationMinutes: String(s?.durationMinutes ?? 55),
      requiredAttendees: String(s?.requiredAttendees ?? 1),
      isActive: s?.isActive ?? true,
    });
    setEditingId(s?.id ?? null);
    setCreating(!s);
  };

  const close = () => {
    setEditingId(null);
    setCreating(false);
  };

  const save = useMutation({
    mutationFn: () => {
      const body = compact({
        name: form.name,
        description: form.description || undefined,
        durationMinutes: Number(form.durationMinutes),
        requiredAttendees: Number(form.requiredAttendees),
        isActive: form.isActive,
      }) as Omit<CreateServiceInput, "organizationId">;
      return editing
        ? servicesApi.update(editing.id, body)
        : servicesApi.create({ organizationId: orgId, ...body });
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["services"] });
      if (editing) {
        toast.success("Servicio actualizado");
      } else {
        toast.success("Servicio agregado. Ahora puedes asignarle ubicaciones.");
        setCreating(false);
        setEditingId((created as unknown as Service)?.id ?? null);
      }
    },
    onError: (e: Error) => setError(errorText(e)),
  });

  const remove = useMutation({
    // El backend no borra servicios: se desactivan.
    mutationFn: () => servicesApi.update(editingId!, { isActive: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      toast.success("Servicio desactivado");
      setConfirming(false);
      close();
    },
    onError: (e: Error) => {
      setConfirming(false);
      setError(errorText(e));
    },
  });

  return (
    <>
      <CardList>
        {(data ?? []).map((s) => (
          <li key={s.id}>
            <button onClick={() => open(s)} className="card-zen w-full p-4 text-left hover:bg-accent/40">
              <p className="font-semibold">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.durationMinutes} minutos</p>
            </button>
          </li>
        ))}
      </CardList>
      <DashedButton label="Nuevo servicio" onClick={() => open(null)} />

      {(editing || creating) && (
        <Modal open onClose={close} title={editing ? "Editar servicio" : "Nuevo servicio"}>
          {error && <Banner kind="error" message={error} />}
          <div className="space-y-3">
            <Field label="Nombre">
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Descripción">
              <textarea rows={2} className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Duración de cita (minutos)">
                <input type="number" step={5} min={5} className={inputCls} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
              </Field>
              <Field label="Personas requeridas">
                <input type="number" className={inputCls} value={form.requiredAttendees} onChange={(e) => setForm({ ...form, requiredAttendees: e.target.value })} />
              </Field>
            </div>
            {editing && (
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Activo
              </label>
            )}
            <div className="flex gap-2">
              <SaveButton onClick={() => save.mutate()} pending={save.isPending} />
              {editing && (
                <button
                  aria-label="Eliminar servicio"
                  onClick={() => setConfirming(true)}
                  className="rounded-md border border-border px-3 py-2 text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            {editing && <ServicePrices service={editing} orgId={orgId} />}
            {editing && (
              <button
                onClick={close}
                className="w-full rounded-md border border-border px-3 py-2 text-sm font-semibold"
              >
                Listo
              </button>
            )}
          </div>
        </Modal>
      )}

      <Confirm
        open={confirming}
        message={`Se desactivará el servicio “${editing?.name ?? ""}” (no se borra). ¿Deseas continuar?`}
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

function ServicePrices({ service, orgId }: { service: Service; orgId: string }) {
  const qc = useQueryClient();
  const [locationId, setLocationId] = useState("");
  const [price, setPrice] = useState("");

  const { data: locations } = useQuery({
    queryKey: ["locations", orgId],
    queryFn: () => locationsApi.list(orgId) as unknown as Promise<Location[]>,
  });

  const allLinks = service.serviceLocations ?? [];
  const linked = allLinks.filter((sl) => sl.isAvailable !== false);
  const available = (locations ?? []).filter((l) => !linked.some((sl) => sl.locationId === l.id));

  const add = useMutation({
    mutationFn: () => {
      const existing = allLinks.find((sl) => sl.locationId === locationId);
      return existing
        ? serviceLocationsApi.update(existing.id, { price: Number(price || 0), isAvailable: true })
        : serviceLocationsApi.create({ serviceId: service.id, locationId, price: Number(price || 0) });
    },
    onSuccess: async () => {
      const name = (locations ?? []).find((l) => l.id === locationId)?.name ?? "Ubicación";
      setPrice("");
      setLocationId("");
      await qc.invalidateQueries({ queryKey: ["services"] });
      toast.success(`${name} agregada a este servicio`);
    },
    onError: (e: Error) => toast.error(errorText(e)),
  });

  const update = useMutation({
    mutationFn: (vars: { id: string; price: number }) =>
      serviceLocationsApi.update(vars.id, { price: vars.price }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      toast.success("Precio actualizado");
    },
    onError: (e: Error) => toast.error(errorText(e)),
  });

  const unlink = useMutation({
    // Sin borrado en el backend: se marca como no disponible.
    mutationFn: (id: string) => serviceLocationsApi.update(id, { isAvailable: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      toast.success("Ubicación quitada del servicio");
    },
    onError: (e: Error) => toast.error(errorText(e)),
  });

  return (
    <div className="mt-4 border-t border-border pt-4">
      <h3 className="mb-2 text-sm font-bold">Precio por ubicación</h3>
      <ul className="mb-3 space-y-2">
        {linked.map((sl) => (
          <li key={sl.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{sl.location?.name ?? sl.locationId}</span>
            <input
              type="number"
              defaultValue={sl.price}
              onBlur={(e) => update.mutate({ id: sl.id, price: Number(e.target.value) })}
              className="w-24 shrink-0 rounded-md border border-input bg-background px-2 py-1 text-sm"
            />
            <button
              aria-label="Quitar ubicación del servicio"
              onClick={() => unlink.mutate(sl.id)}
              className="shrink-0 rounded-md border border-border p-1.5 text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
        {!linked.length && (
          <li className="text-xs text-muted-foreground">Aún no hay ubicaciones en este servicio.</li>
        )}
      </ul>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
        <select className={inputCls} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <option value="">Ubicación…</option>
          {available.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Precio"
          className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <button
          aria-label="Agregar ubicación al servicio"
          onClick={() => locationId && add.mutate()}
          disabled={!locationId || add.isPending}
          className="btn-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          +
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Puedes agregar varias ubicaciones seguidas; la ventana permanece abierta.
      </p>
    </div>
  );
}

/* ---------------- Horarios ---------------- */

const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatDateLabel = (ymd: string) => {
  const d = new Date(`${ymd}T00:00:00`);
  const txt = d.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
};

const toMin = (t: string) => {
  const [h = "0", m = "0"] = t.split(":");
  return Number(h) * 60 + Number(m);
};

function HoursTab({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<BusinessHour | null>(null);
  const [creating, setCreating] = useState(false);
  const [dateOnly, setDateOnly] = useState(false);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [targetDates, setTargetDates] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [overlapStep, setOverlapStep] = useState<0 | 1 | 2>(0);
  const [form, setForm] = useState({
    date: todayYmd(),
    startTime: "09:00",
    endTime: "18:00",
    appointmentDuration: "55",
    breakDuration: "5",
    capacity: "1",
    locationId: "",
    serviceIds: [] as string[],
    isActive: true,
  });

  const { data } = useQuery({
    queryKey: ["business-hours", orgId],
    queryFn: async () =>
      (await businessHoursApi.list(orgId, { from: todayYmd() })).map(
        (h) => ({ ...h, capacity: h.slotCapacity ?? 1 }) as unknown as BusinessHour,
      ),
  });
  const { data: locations } = useQuery({
    queryKey: ["locations", orgId],
    queryFn: () => locationsApi.list(orgId) as unknown as Promise<Location[]>,
  });
  const { data: services } = useQuery({
    queryKey: ["services", orgId],
    queryFn: () => servicesApi.list(orgId) as unknown as Promise<Service[]>,
  });
  // Servicios activos que se ofrecen en una sede (los únicos que puede tener un bloque ahí).
  const servicesAt = (locationId: string) =>
    (services ?? []).filter(
      (s) => s.isActive && (s.serviceLocations ?? []).some((sl) => sl.locationId === locationId && sl.isAvailable),
    );
  const locationName = (id: string | null | undefined) =>
    locations?.find((l) => l.id === id)?.name ?? "Sin ubicación";

  const today = todayYmd();

  const groups = useMemo(() => {
    const map = new Map<string, BusinessHour[]>();
    (data ?? [])
      .filter((h): h is BusinessHour => Boolean(h?.date))
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.startTime ?? "").localeCompare(b.startTime ?? ""),
      )
      .forEach((h) => {
        const list = map.get(h.date) ?? [];
        list.push(h);
        map.set(h.date, list);
      });
    const all = [...map.entries()];
    return {
      past: all.filter(([d]) => d < today),
      upcoming: all.filter(([d]) => d >= today),
    };
  }, [data, today]);

  const open = (h: BusinessHour | null, duplicate = false) => {
    setForm({
      date: duplicate ? today : (h?.date ?? today),
      startTime: h?.startTime ?? "09:00",
      endTime: h?.endTime ?? "18:00",
      appointmentDuration: String(h?.appointmentDuration ?? 55),
      breakDuration: String(h?.breakDuration ?? 5),
      capacity: String(h?.capacity ?? 1),
      locationId: h?.locationId ?? "",
      serviceIds: h?.serviceIds ?? [],
      isActive: h?.isActive ?? true,
    });
    setError(null);
    setDateOnly(duplicate);
    setSourceId(duplicate && h ? h.id : null);
    setTargetDates([]);
    setEditing(duplicate ? null : h);
    setCreating(duplicate || !h);
  };

  const close = () => {
    setEditing(null);
    setCreating(false);
    setDateOnly(false);
    setOverlapStep(0);
  };
  const refresh = () => qc.invalidateQueries({ queryKey: ["business-hours"] });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        date: form.date,
        slotCapacity: Math.max(1, Number(form.capacity) || 1),
        locationId: form.locationId,
        serviceIds: form.serviceIds,
        startTime: form.startTime,
        endTime: form.endTime,
        appointmentDuration: Number(form.appointmentDuration),
        breakDuration: Number(form.breakDuration),
        isActive: form.isActive,
      };
      return editing
        ? businessHoursApi.update(editing.id, body)
        : businessHoursApi.create({ organizationId: orgId, ...body });
    },
    onSuccess: () => {
      refresh();
      toast.success(editing ? "Horario actualizado" : "Bloque de horario agregado");
      close();
    },
    onError: (e: Error) => setError(errorText(e)),
  });

  const replicate = useMutation({
    mutationFn: () =>
      businessHoursApi.replicate({ sourceId: sourceId!, targetDates: [...targetDates].sort() }),
    onSuccess: (r) => {
      refresh();
      qc.invalidateQueries({ queryKey: ["slots"] });
      toast.success(`Bloque clonado a ${r?.length ?? targetDates.length} fecha(s)`);
      close();
    },
    onError: (e: Error) => setError(errorText(e)),
  });

  const attemptReplicate = () => {
    setError(null);
    if (!targetDates.length) {
      setError("Agrega al menos una fecha de destino.");
      return;
    }
    replicate.mutate();
  };

  const hasOverlap = () => {
    const s = toMin(form.startTime);
    const e = toMin(form.endTime);
    return (data ?? []).some(
      (h) =>
        h.id !== editing?.id &&
        h.date === form.date &&
        s < toMin(h.endTime) &&
        e > toMin(h.startTime),
    );
  };

  const attemptSave = () => {
    setError(null);
    if (toMin(form.endTime) <= toMin(form.startTime)) {
      setError("La hora final debe ser posterior a la inicial.");
      return;
    }
    if (!form.locationId) {
      setError("Selecciona una ubicación para el bloque.");
      return;
    }
    if (!form.serviceIds.length) {
      setError("Selecciona al menos un servicio para el bloque.");
      return;
    }
    if (form.date < today) {
      setError("No puedes elegir una fecha pasada.");
      return;
    }
    if (hasOverlap()) {
      setOverlapStep(1);
      return;
    }
    save.mutate();
  };

  const remove = useMutation({
    mutationFn: () => businessHoursApi.remove(editing!.id),
    onSuccess: () => {
      refresh();
      toast.success("Bloque de horario eliminado");
      setConfirming(false);
      close();
    },
    onError: (e: Error) => toast.error(errorText(e)),
  });

  const renderGroup = ([date, list]: [string, BusinessHour[]]) => (
    <div key={date}>
      <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-muted-foreground">
        {formatDateLabel(date)}
        {date === today && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
            Hoy
          </span>
        )}
      </h2>
      <CardList>
        {list.map((h) => (
          <li key={h.id} className="card-zen flex items-center gap-2 p-4">
            <button onClick={() => open(h)} className="flex-1 text-left">
              <p className="text-lg font-semibold">
                {h.startTime} – {h.endTime}
                {!h.isActive && (
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    Inactivo
                  </span>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                Citas de {h.appointmentDuration} min · Descanso {h.breakDuration} min · Cupo{" "}
                {h.capacity ?? 1}
              </p>
              <p className="text-sm text-muted-foreground">
                {locationName(h.locationId)}
              </p>
              {!!h.services?.length && (
                <p className="text-sm text-muted-foreground">{h.services.map((s) => s.name).join(" · ")}</p>
              )}
            </button>
            <button
              aria-label="Reutilizar este bloque en otra fecha"
              onClick={() => open(h, true)}
              className="shrink-0 rounded-md border border-border p-2 text-gold"
            >
              <Copy className="h-4 w-4" />
            </button>
          </li>
        ))}
      </CardList>
    </div>
  );

  return (
    <>
      <div className="space-y-5">
        {groups.past.length > 0 && (
          <button
            onClick={() => setShowPast((v) => !v)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm font-semibold text-muted-foreground"
          >
            {showPast ? "Ocultar fechas anteriores" : `Ver fechas anteriores (${groups.past.length})`}
          </button>
        )}
        {showPast && groups.past.map(renderGroup)}
        {groups.upcoming.map(renderGroup)}
        {!groups.upcoming.length && (
          <p className="text-sm text-muted-foreground">
            No tienes horarios cargados a partir de hoy.
          </p>
        )}
      </div>
      <DashedButton label="Nuevo bloque de horario" onClick={() => open(null)} />

      {(editing || creating) && (
        <Modal
          open
          onClose={close}
          title={
            dateOnly
              ? "Clonar a otras fechas"
              : editing
                ? "Editar horario"
                : "Nuevo bloque de horario"
          }
          size="lg"
        >
          {error && <Banner kind="error" message={error} />}
          <div className="space-y-3">
            {dateOnly ? (
              <Field label="Fechas de destino *">
                <input
                  type="date"
                  className={inputCls}
                  min={today}
                  value=""
                  onChange={(e) => {
                    const d = e.target.value;
                    if (d && d >= today && !targetDates.includes(d)) setTargetDates([...targetDates, d].sort());
                  }}
                />
                {targetDates.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {targetDates.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setTargetDates(targetDates.filter((x) => x !== d))}
                        className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary"
                        aria-label={`Quitar ${d}`}
                      >
                        {formatDateLabel(d)} ✕
                      </button>
                    ))}
                  </div>
                )}
              </Field>
            ) : (
              <Field label="Fecha *">
                <input
                  type="date"
                  className={inputCls}
                  min={today}
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </Field>
            )}
            {dateOnly ? (
              <div className="rounded-md bg-muted/60 p-3 text-sm">
                <p className="font-semibold">
                  {form.startTime} – {form.endTime}
                </p>
                <p className="text-xs text-muted-foreground">
                  Citas de {form.appointmentDuration} min · Descanso {form.breakDuration} min · Cupo{" "}
                  {form.capacity} ·{" "}
                  {locationName(form.locationId)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(services ?? [])
                    .filter((s) => form.serviceIds.includes(s.id))
                    .map((s) => s.name)
                    .join(" · ")}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Elige una o varias fechas; se clonan con sus cupos (si alguna choca, no se crea ninguna).
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Desde *">
                    <input type="time" className={inputCls} value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                  </Field>
                  <Field label="Hasta *">
                    <input type="time" className={inputCls} value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Duración de cita (minutos) *">
                    <input type="number" step={5} min={5} className={inputCls} value={form.appointmentDuration} onChange={(e) => setForm({ ...form, appointmentDuration: e.target.value })} />
                  </Field>
                  <Field label="Descanso (minutos) *">
                    <input type="number" step={5} min={0} className={inputCls} value={form.breakDuration} onChange={(e) => setForm({ ...form, breakDuration: e.target.value })} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Cupo base">
                    <input type="number" min={1} className={inputCls} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                  </Field>
                </div>
                <Field label="Ubicación *">
                  <select
                    className={inputCls}
                    value={form.locationId}
                    required
                    onChange={(e) => {
                      const locationId = e.target.value;
                      const allowed = servicesAt(locationId).map((s) => s.id);
                      // Al cambiar de sede se quitan los servicios que no se ofrecen ahí.
                      setForm({ ...form, locationId, serviceIds: form.serviceIds.filter((id) => allowed.includes(id)) });
                    }}
                  >
                    <option value="" disabled>
                      Selecciona una ubicación…
                    </option>
                    {(locations ?? []).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Servicios que se ofrecen en este bloque *">
                  {!form.locationId ? (
                    <p className="rounded-md border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
                      Primero elige la ubicación para ver sus servicios.
                    </p>
                  ) : servicesAt(form.locationId).length === 0 ? (
                    <p className="rounded-md border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
                      Ningún servicio activo se ofrece en esta ubicación. Agrégala a un servicio en la pestaña Servicios.
                    </p>
                  ) : (
                    <div role="group" aria-label="Servicios del bloque" className="grid gap-2 sm:grid-cols-2">
                      {servicesAt(form.locationId).map((s) => {
                        const checked = form.serviceIds.includes(s.id);
                        return (
                          <label
                            key={s.id}
                            className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                              checked
                                ? "border-primary bg-primary/10 font-semibold text-foreground"
                                : "border-border text-muted-foreground hover:bg-accent"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 shrink-0 accent-primary"
                              checked={checked}
                              onChange={() =>
                                setForm({
                                  ...form,
                                  serviceIds: checked
                                    ? form.serviceIds.filter((id) => id !== s.id)
                                    : [...form.serviceIds, s.id],
                                })
                              }
                            />
                            {s.name}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </Field>
                {editing && (
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                    Activo
                  </label>
                )}
              </>
            )}
            <div className="flex gap-2">
              <SaveButton
                onClick={dateOnly ? attemptReplicate : attemptSave}
                pending={dateOnly ? replicate.isPending : save.isPending}
                disabled={!dateOnly && (!form.locationId || !form.serviceIds.length)}
              />
              {editing && (
                <button
                  aria-label="Eliminar horario"
                  onClick={() => setConfirming(true)}
                  className="rounded-md border border-border px-3 py-2 text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      <Confirm
        open={overlapStep === 1}
        title="Horario existente detectado"
        message="Ya existe un horario configurado para esta fecha. Verifica tus horarios cargados. ¿Deseas continuar de todos modos?"
        confirmLabel="Continuar"
        onConfirm={() => setOverlapStep(2)}
        onCancel={() => setOverlapStep(0)}
      />

      <Confirm
        open={overlapStep === 2}
        title="Confirmación de seguridad"
        message="Atención: Guardar este bloque puede provocar citas encimadas o doble cita en la misma franja horaria. ¿Confirmas esta acción?"
        confirmLabel="Confirmar y guardar"
        cancelLabel="Volver a revisar"
        pending={save.isPending}
        onConfirm={() => {
          setOverlapStep(0);
          save.mutate();
        }}
        onCancel={() => setOverlapStep(0)}
      />

      <Confirm
        open={confirming}
        message="Se eliminará este bloque de horario. ¿Deseas continuar?"
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}


/* ---------------- Cupo ---------------- */

type GridSlot = {
  key: string;
  date: string;
  startAt: Date;
  endAt: Date;
  capacity: number;
  bookedCount: number;
  isActive: boolean;
  locationId: string | null;
  slot: AppointmentSlot | null;
};

const fmtTime = (d: Date) =>
  d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true });

const ymdOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function SlotsTab({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const [locationId, setLocationId] = useState("");
  const [editing, setEditing] = useState<GridSlot | null>(null);
  const [creating, setCreating] = useState(false);
  const [capacity, setCapacity] = useState("1");
  const [isActive, setIsActive] = useState(true);
  const [newSlot, setNewSlot] = useState({ date: "", time: "", duration: "55" });

  const { from, to } = useMemo(() => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 14);
    return { from: start.toISOString(), to: end.toISOString() };
  }, []);

  const { data: locations } = useQuery({
    queryKey: ["locations", orgId],
    queryFn: () => locationsApi.list(orgId) as unknown as Promise<Location[]>,
  });

  const { data } = useQuery({
    queryKey: ["slots", orgId, locationId, from],
    queryFn: () =>
      appointmentSlotsApi.list(
        compact({ organizationId: orgId, locationId: locationId || undefined, from, to }) as { organizationId: string },
      ) as unknown as Promise<AppointmentSlot[]>,
  });

  const { data: hours } = useQuery({
    queryKey: ["business-hours", orgId],
    queryFn: async () =>
      (await businessHoursApi.list(orgId)).map(
        (h) => ({ ...h, capacity: h.slotCapacity ?? 1 }) as unknown as BusinessHour,
      ),
  });

  /** Partición matemática: intervalo = duración de cita + descanso. */
  const groups = useMemo(() => {
    const today = todayYmd();
    const limit = ymdOf(new Date(Date.now() + 14 * 86400000));
    const existing = new Map<number, AppointmentSlot>();
    for (const s of data ?? []) existing.set(new Date(s.startAt).getTime(), s);

    const map = new Map<string, GridSlot[]>();
    for (const h of hours ?? []) {
      if (!h?.date || h.date < today || h.date > limit) continue;
      if (locationId && h.locationId && h.locationId !== locationId) continue;
      const step = Number(h.appointmentDuration || 0) + Number(h.breakDuration || 0);
      if (step <= 0) continue;
      const startMin = toMin(h.startTime);
      const endMin = toMin(h.endTime);
      for (let m = startMin; m + Number(h.appointmentDuration) <= endMin; m += step) {
        const startAt = new Date(`${h.date}T00:00:00`);
        startAt.setMinutes(m);
        const endAt = new Date(startAt.getTime() + Number(h.appointmentDuration) * 60000);
        const found = existing.get(startAt.getTime());
        const item: GridSlot = {
          key: `${h.id}-${m}`,
          date: h.date,
          startAt,
          endAt,
          capacity: found?.capacity ?? h.capacity ?? 1,
          bookedCount: found?.bookedCount ?? 0,
          isActive: found ? found.isActive : h.isActive,
          locationId: h.locationId,
          slot: found ?? null,
        };
        const list = map.get(h.date) ?? [];
        list.push(item);
        map.set(h.date, list);
      }
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(
        ([date, list]) =>
          [date, list.sort((a, b) => a.startAt.getTime() - b.startAt.getTime())] as const,
      );
  }, [data, hours, locationId]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["slots"] });
  const close = () => {
    setEditing(null);
    setCreating(false);
  };

  const save = useMutation({
    mutationFn: () => {
      if (editing?.slot) {
        return appointmentSlotsApi.update(editing.slot.id, { capacity: Number(capacity), isActive });
      }
      const start = editing ? editing.startAt : new Date(`${newSlot.date}T${newSlot.time}`);
      const end = editing
        ? editing.endAt
        : new Date(start.getTime() + Number(newSlot.duration) * 60000);
      return appointmentSlotsApi.create({
        organizationId: orgId,
        locationId: (editing?.locationId ?? locationId) as string,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        capacity: Number(capacity),
        isActive,
      });
    },
    onSuccess: () => {
      refresh();
      close();
    },
    onError: (e: Error) => toast.error(errorText(e)),
  });

  const remove = useMutation({
    mutationFn: () => appointmentSlotsApi.remove(editing!.slot!.id),
    onSuccess: () => {
      refresh();
      close();
    },
    onError: (e: Error) => toast.error(errorText(e)),
  });

  return (
    <>
      {(locations ?? []).length > 1 && (
        <select className={`${inputCls} mb-4`} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <option value="">Todas las ubicaciones</option>
          {locations!.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      )}

      <div className="space-y-4">
        {groups.map(([date, list]) => (
          <section key={date} className="rounded-xl border border-border bg-card/60 p-3">
            <h2 className="mb-3 border-b border-border pb-2 text-base font-bold">
              {formatDateLabel(date)}
              {date === todayYmd() && (
                <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                  Hoy
                </span>
              )}
            </h2>
            <ul className="space-y-2">
              {list.map((s) => {
                const full = s.bookedCount >= s.capacity;
                return (
                  <li key={s.key}>
                    <button
                      onClick={() => {
                        setEditing(s);
                        setCapacity(String(s.capacity));
                        setIsActive(s.isActive);
                      }}
                      className="card-zen flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-accent/40"
                    >
                      <span className="min-w-0">
                        <span className="block text-base font-semibold">
                          {fmtTime(s.startAt)} – {fmtTime(s.endAt)}
                        </span>
                        {!s.isActive && (
                          <span className="text-sm font-semibold text-status-cancelled">
                            Bloqueado
                          </span>
                        )}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                          full
                            ? "bg-status-pending-bg text-status-pending"
                            : "bg-status-confirmed-bg text-status-confirmed"
                        }`}
                      >
                        {s.bookedCount}/{s.capacity}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {!groups.length && (
          <p className="text-sm text-muted-foreground">
            No hay cupos: primero carga bloques en la pestaña Horarios.
          </p>
        )}
      </div>

      <DashedButton
        label="Nuevo horario manual"
        onClick={() => {
          setCreating(true);
          setCapacity("1");
          setIsActive(true);
        }}
      />

      {(editing || creating) && (
        <Modal open onClose={close} title={editing ? "Editar cupo" : "Nuevo horario manual"} size="lg">
          <div className="space-y-3">
            {editing && (
              <p className="rounded-md bg-muted/60 p-3 text-sm font-semibold">
                {formatDateLabel(editing.date)} · {fmtTime(editing.startAt)} –{" "}
                {fmtTime(editing.endAt)}
              </p>
            )}
            {creating && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Fecha">
                    <input type="date" className={inputCls} value={newSlot.date} onChange={(e) => setNewSlot({ ...newSlot, date: e.target.value })} />
                  </Field>
                  <Field label="Hora">
                    <input type="time" className={inputCls} value={newSlot.time} onChange={(e) => setNewSlot({ ...newSlot, time: e.target.value })} />
                  </Field>
                </div>
                <Field label="Duración (minutos)">
                  <input type="number" step={5} min={5} className={inputCls} value={newSlot.duration} onChange={(e) => setNewSlot({ ...newSlot, duration: e.target.value })} />
                </Field>
              </>
            )}
            <Field label="Cupo (1 por defecto, súbelo solo para sobrecupos)">
              <input type="number" min={1} className={inputCls} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </Field>
            <label className="flex items-center gap-3 text-lg font-medium">
              <input type="checkbox" className="h-5 w-5" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Disponible para agendar
            </label>
            <SaveButton onClick={() => save.mutate()} pending={save.isPending} />
            {editing?.slot && editing.bookedCount === 0 && (
              <button
                onClick={() => remove.mutate()}
                className="w-full rounded-md border border-border px-5 py-3.5 text-lg font-semibold text-destructive"
              >
                Eliminar horario
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

/* ---------------- Configuración ---------------- */

function SettingsTab({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState<null | "ia" | "marca" | "politica" | "cuenta">(null);

  const cards = [
    { key: "ia" as const, title: "Asistente de IA", desc: "Nombre, tono y mensajes automáticos." },
    { key: "marca" as const, title: "Marca", desc: "Tema, colores, tipografía y logo." },
    { key: "politica" as const, title: "Política de cancelación", desc: "Plazos y penalizaciones." },
    { key: "cuenta" as const, title: "Mi Cuenta", desc: "Correo de acceso y contraseña." },
  ];


  return (
    <>
      <CardList>
        {cards.map((c) => (
          <li key={c.key}>
            <button onClick={() => setOpen(c.key)} className="card-zen w-full p-4 text-left hover:bg-accent/40">
              <p className="font-semibold">{c.title}</p>
              <p className="text-xs text-muted-foreground">{c.desc}</p>
            </button>
          </li>
        ))}
      </CardList>

      <PlanCard orgId={orgId} />
      <PushNotificationsCard orgId={orgId} />

      {open === "ia" && <AIModal orgId={orgId} onClose={() => setOpen(null)} />}
      {open === "marca" && <BrandingModal orgId={orgId} onClose={() => setOpen(null)} />}
      {open === "politica" && <PolicyModal orgId={orgId} onClose={() => setOpen(null)} />}
      {open === "cuenta" && <AccountModal onClose={() => setOpen(null)} />}

    </>
  );
}

function AIModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["ai-settings", orgId],
    queryFn: () => aiSettingsApi.get(orgId) as unknown as Promise<AISettings | null>,
  });
  const [form, setForm] = useState<Partial<AISettings>>({});
  const value = { ...(data ?? {}), ...form } as AISettings;

  const save = useMutation({
    mutationFn: () =>
      aiSettingsApi.update(orgId, {
          enabled: value.enabled ?? false,
          assistantName: value.assistantName ?? "",
          tone: value.tone ?? null,
          welcomeMessage: value.welcomeMessage ?? null,
          sendWelcomeOnFirstMessage: value.sendWelcomeOnFirstMessage ?? false,
          fallbackMessage: value.fallbackMessage ?? null,
          formatWhatsappText: value.formatWhatsappText ?? false,
          allowHumanTakeover: value.allowHumanTakeover ?? false,
      } as UpdateAISettingsInput),
    onSuccess: onClose,
    onError: (e: Error) => setError(errorText(e)),
  });

  const tone = value.tone ?? TONES[0]!;
  const isPreset = TONES.includes(tone);
  const [customTone, setCustomTone] = useState(!isPreset && !!tone);
  const big = `${inputCls} h-12 text-lg`;

  return (
    <Modal open onClose={onClose} title="Asistente de IA">
      {error && <Banner kind="error" message={error} />}
      <div className="space-y-5 text-lg">
        <Check label="Activo" checked={!!value.enabled} onChange={(v) => setForm({ ...form, enabled: v })} />
        <Field label="Nombre del asistente">
          <input className={big} value={value.assistantName ?? ""} onChange={(e) => setForm({ ...form, assistantName: e.target.value })} />
        </Field>
        <Field label="Tono">
          <select
            className={big}
            value={customTone ? "__custom__" : isPreset ? tone : TONES[0]}
            onChange={(e) => {
              if (e.target.value === "__custom__") {
                setCustomTone(true);
                setForm({ ...form, tone: "" });
              } else {
                setCustomTone(false);
                setForm({ ...form, tone: e.target.value });
              }
            }}
          >
            {TONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value="__custom__">Personalizado…</option>
          </select>
        </Field>
        {customTone && (
          <Field label="Tono personalizado">
            <textarea
              rows={2}
              className={`${inputCls} text-lg`}
              placeholder="Describe con tus palabras el tono que deseas…"
              value={value.tone ?? ""}
              onChange={(e) => setForm({ ...form, tone: e.target.value })}
            />
          </Field>
        )}
        <Field label="Mensaje de bienvenida">
          <textarea rows={3} className={`${inputCls} text-lg`} value={value.welcomeMessage ?? ""} onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })} />
        </Field>
        <Check
          label="Enviar en el primer mensaje"
          checked={!!value.sendWelcomeOnFirstMessage}
          onChange={(v) => setForm({ ...form, sendWelcomeOnFirstMessage: v })}
        />
        <Field label="Mensaje de respaldo">
          <textarea rows={3} className={`${inputCls} text-lg`} value={value.fallbackMessage ?? ""} onChange={(e) => setForm({ ...form, fallbackMessage: e.target.value })} />
        </Field>
        <Check label="Formato WhatsApp" checked={!!value.formatWhatsappText} onChange={(v) => setForm({ ...form, formatWhatsappText: v })} />
        <Check label="Permitir que un humano tome el control" checked={!!value.allowHumanTakeover} onChange={(v) => setForm({ ...form, allowHumanTakeover: v })} />
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="w-full btn-primary px-4 py-3 text-lg font-semibold text-primary-foreground disabled:opacity-60"
        >
          Guardar
        </button>
      </div>
    </Modal>
  );
}

const TONES = [
  "Cálido y profesional",
  "Empático y cercano",
  "Formal y clínico",
  "Directo y conciso",
];

const FONTS = ["Inter", "Plus Jakarta Sans", "Roboto", "Lato", "Merriweather"];

const DEFAULT_PRIMARY = "#0F766E";
const DEFAULT_SECONDARY = "#D97706";

function LogoPreview({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const src = url.trim();

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src) return null;

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-[70px] w-[70px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40">
        {!failed && (
          <img
            src={src}
            alt="Vista previa del logo"
            className="h-full w-full object-contain"
            onError={() => setFailed(true)}
          />
        )}
      </div>
      {failed && (
        <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
          No se pudo cargar la imagen. Verifica que sea un enlace directo (.png, .jpg o .webp).
        </p>
      )}
    </div>
  );
}

function BrandingModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["organization", orgId],
    queryFn: () => organizationApi.get(orgId) as unknown as Promise<Organization>,
  });
  const [form, setForm] = useState<Partial<Organization>>({});
  const value = { ...(data ?? {}), ...form } as Organization;

  const qc = useQueryClient();

  // Aplica colores y tipografía en vivo mientras se editan
  useEffect(() => {
    applyBranding(value);
  }, [value.primaryColor, value.secondaryColor, value.fontFamily, value.fontScale]);

  const save = useMutation({
    mutationFn: () =>
      organizationApi.updateBranding(
        orgId,
        compact({
          theme: value.theme,
          logoUrl: value.logoUrl,
          primaryColor: value.primaryColor,
          secondaryColor: value.secondaryColor,
          fontFamily: value.fontFamily,
          fontScale: value.fontScale,
        }) as UpdateBrandingInput,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["organization"] });
      toast.success("Marca actualizada");
      onClose();
    },
    onError: (e: Error) => setError(errorText(e)),
  });

  const big = `${inputCls} h-12 text-lg`;

  return (
    <Modal open onClose={onClose} title="Marca">
      {error && <Banner kind="error" message={error} />}
      <div className="space-y-5 text-lg">
        <Field label="Tema">
          <select className={big} value={value.theme ?? "auto"} onChange={(e) => setForm({ ...form, theme: e.target.value as Organization["theme"] })}>
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
            <option value="auto">Automático</option>
          </select>
        </Field>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Color primario">
            <div className="flex gap-3">
              <input aria-label="Selector de color primario" type="color" value={value.primaryColor ?? "#0F766E"} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="h-12 w-14 rounded-md border border-input" />
              <input className={big} placeholder="#0F766E" value={value.primaryColor ?? ""} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
            </div>
          </Field>
          <Field label="Color secundario">
            <div className="flex gap-3">
              <input aria-label="Selector de color secundario" type="color" value={value.secondaryColor ?? "#D97706"} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} className="h-12 w-14 rounded-md border border-input" />
              <input className={big} placeholder="#D97706" value={value.secondaryColor ?? ""} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} />
            </div>
          </Field>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm({ ...form, primaryColor: DEFAULT_PRIMARY, secondaryColor: DEFAULT_SECONDARY });
            applyBranding({ ...value, primaryColor: DEFAULT_PRIMARY, secondaryColor: DEFAULT_SECONDARY });
            toast.success("Colores restablecidos a los valores originales");
          }}
          className="inline-flex items-center gap-2 rounded-md border border-input px-4 py-2 text-base font-medium text-foreground transition-colors hover:bg-accent"
        >
          <RotateCcw className="h-4 w-4" />
          Restablecer colores originales
        </button>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
          <span className="btn-primary px-4 py-2 text-base font-semibold text-primary-foreground">
            Botón principal
          </span>
          <span className="text-base font-semibold text-gold">Detalle dorado</span>
        </div>
        <hr className="border-border" />
        <h3 className="text-lg font-bold text-foreground">Estilo de la App</h3>
        <Field label="Tipografía">
          <select className={big} value={value.fontFamily ?? "Inter"} onChange={(e) => setForm({ ...form, fontFamily: e.target.value })}>
            {FONTS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tamaño de texto">
          <select className={big} value={value.fontScale ?? "md"} onChange={(e) => setForm({ ...form, fontScale: e.target.value as Organization["fontScale"] })}>
            <option value="sm">Chico</option>
            <option value="md">Normal</option>
            <option value="lg">Grande</option>
          </select>
        </Field>
        <hr className="border-border" />
        <h3 className="text-lg font-bold text-foreground">Identidad en Cabecera</h3>
        <Field label="URL del logo">
          <input
            className={big}
            placeholder="https://.../mi-logo.png"
            value={value.logoUrl ?? ""}
            onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
          />
        </Field>
        <p className="-mt-2 text-sm leading-relaxed text-muted-foreground">
          Pega el enlace directo a tu imagen (.png, .jpg o .webp). Puedes alojarla en servicios como
          postimages.org o imgbb.com (copiando la opción «Enlace directo»).
        </p>
        <LogoPreview url={value.logoUrl ?? ""} />
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="w-full btn-primary px-4 py-3 text-lg font-semibold text-primary-foreground disabled:opacity-60"
        >
          Guardar
        </button>
      </div>
    </Modal>
  );
}

function PolicyModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["organization", orgId],
    queryFn: () => organizationApi.get(orgId) as unknown as Promise<Organization>,
  });
  const [form, setForm] = useState<Partial<Organization>>({});
  const value = { ...(data ?? {}), ...form } as Organization;

  const save = useMutation({
    mutationFn: () =>
      organizationApi.updateCancellationPolicy(orgId, {
        allowClientCancellation: value.allowClientCancellation ?? false,
        cancellationDeadlineHours: value.cancellationDeadlineHours ?? null,
        hasCancellationPenalty: value.hasCancellationPenalty ?? false,
        cancellationPenaltyText: value.cancellationPenaltyText ?? null,
      }),
    onSuccess: onClose,
    onError: (e: Error) => setError(errorText(e)),
  });

  return (
    <Modal open onClose={onClose} title="Política de cancelación">
      {error && <Banner kind="error" message={error} />}
      <div className="space-y-3">
        <Check
          label="El cliente puede cancelar"
          checked={!!value.allowClientCancellation}
          onChange={(v) => setForm({ ...form, allowClientCancellation: v })}
        />
        {value.allowClientCancellation && (
          <Field label="Plazo mínimo (horas)">
            <input
              type="number"
              className={inputCls}
              value={value.cancellationDeadlineHours ?? ""}
              onChange={(e) => setForm({ ...form, cancellationDeadlineHours: Number(e.target.value) })}
            />
          </Field>
        )}
        <Check
          label="Aplica penalización"
          checked={!!value.hasCancellationPenalty}
          onChange={(v) => setForm({ ...form, hasCancellationPenalty: v })}
        />
        {value.hasCancellationPenalty && (
          <Field label="Texto de penalización">
            <textarea
              rows={3}
              className={inputCls}
              value={value.cancellationPenaltyText ?? ""}
              onChange={(e) => setForm({ ...form, cancellationPenaltyText: e.target.value })}
            />
          </Field>
        )}
        <SaveButton onClick={() => save.mutate()} pending={save.isPending} />
      </div>
    </Modal>
  );
}

/* ---------------- Mi Cuenta ---------------- */

function AccountModal({ onClose }: { onClose: () => void }) {
  const sessionEmail = useAuth().user?.email ?? "";
  const { data: profile } = useQuery({ queryKey: ["auth-me"], queryFn: () => authApi.me() });
  const email = profile?.email ?? sessionEmail;
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const valid =
    current.length > 0 && next.length >= 8 && confirm.length > 0 && next === confirm;

  const save = useMutation({
    mutationFn: () =>
      authApi.changePassword(current, next),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
      setError(null);
      toast.success("Contraseña actualizada correctamente");
    },
    onError: (e: Error) => setError(errorText(e)),
  });

  return (
    <Modal open onClose={onClose} title="Mi Cuenta" size="lg">
      <div className="space-y-6">
        {error && <Banner kind="error" message={error} />}

        <section className="card-zen space-y-2 p-5">
          <h3 className="text-lg font-bold">Correo electrónico de acceso</h3>
          <input className={inputCls} value={email} disabled readOnly aria-label="Correo electrónico de acceso" />
          <p className="text-sm text-muted-foreground">
            Para actualizar tu correo de acceso, por favor contacta a soporte técnico.
          </p>
        </section>

        <section className="card-zen space-y-4 p-5">
          <h3 className="text-lg font-bold">Cambiar contraseña</h3>
          <Field label="Contraseña actual">
            <input
              type="password"
              autoComplete="current-password"
              className={inputCls}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field label="Nueva contraseña">
            <input
              type="password"
              autoComplete="new-password"
              className={inputCls}
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <p className="-mt-2 text-sm text-muted-foreground">Mínimo 8 caracteres.</p>
          <Field label="Confirmar nueva contraseña">
            <input
              type="password"
              autoComplete="new-password"
              className={inputCls}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          {confirm.length > 0 && next !== confirm && (
            <p className="text-sm font-medium text-destructive">Las contraseñas no coinciden.</p>
          )}
          <button
            onClick={() => save.mutate()}
            disabled={!valid || save.isPending}
            className="w-full btn-primary px-4 py-3 text-base font-bold text-primary-foreground disabled:opacity-50"
          >
            Actualizar contraseña
          </button>
        </section>
      </div>
    </Modal>
  );
}

/* ---------------- shared ---------------- */

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function SaveButton({
  onClick,
  pending,
  label = "Guardar",
  disabled = false,
}: {
  onClick: () => void;
  pending: boolean;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending || disabled}
      className="w-full flex-1 btn-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
    >
      {label}
    </button>
  );
}
