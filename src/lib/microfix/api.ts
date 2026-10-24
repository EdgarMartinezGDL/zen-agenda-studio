
// Todas las rutas del backend que usa la app del profesional.
// REGLA: cualquier ruta que filtre o cree datos debe llevar el
// organizationId del usuario en sesión (user.organizationId). El backend
// rechaza con 403 un organizationId distinto al del token.
// Referencia completa (parámetros, validaciones, errores): API-RUTAS.md.

import { apiRequest } from './client';
import type {
  AdminDemo, ConvertDemoInput, CreateDemoInput, DemoCancelResult, DemoConvertResult, DemoQrResult,
  AdminOrganization, AiPauseResult, AiUsageReport, PlanChangeResult, PlanFeatures, VerifierRejection,
  AISettings,
  AppointmentStatus,
  AppointmentWithRelations,
  AppointmentSlot,
  AuthProfile,
  AvailableSlots,
  BusinessHour,
  BusinessHourWithLocation,
  BusinessHourWithOrganization,
  Event,
  EventRegistration,
  EventWithLocation,
  FontFamily,
  FontScale,
  LocationWithOrganization,
  Location,
  LoginResponse,
  Organization,
  OrganizationContext,
  Report,
  Service,
  ServiceLocation,
  ServiceLocationLookup,
  ServiceLocationWithLocation,
  ServiceLocationWithService,
  ServiceWithRelations,
  Theme,
  Appointment,
  NotificationPage,
  ConversationModeChange, KnowledgeDocument, KnowledgeDocumentList, PausedConversation,
} from './types';

const qs = (params: Record<string, string | number | boolean | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
};

// --- Auth --------------------------------------------------------------------

export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email: email.toLowerCase().trim(), password },
      auth: false,
    }),
  me: () => apiRequest<AuthProfile>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiRequest<{ message: string }>('/auth/change-password', {
      method: 'PATCH',
      body: { currentPassword, newPassword }, // newPassword: mínimo 8 caracteres
    }),
};

// --- Organización ------------------------------------------------------------

export interface UpdateBrandingInput {
  theme?: Theme;
  logoUrl?: string | null; // solo la URL (png, jpg, jpeg, svg, webp; máx. 512 KB)
  primaryColor?: string | null; // "#RRGGBB"
  secondaryColor?: string | null;
  fontFamily?: FontFamily | null;
  fontScale?: FontScale;
}

export interface UpdateCancellationPolicyInput {
  allowClientCancellation?: boolean;
  cancellationDeadlineHours?: number | null;
  hasCancellationPenalty?: boolean;
  cancellationPenaltyText?: string | null;
}

export const organizationApi = {
  get: (orgId: string) => apiRequest<Organization>(`/organizations/${orgId}`),
  /** Sedes, servicios con precios, horarios, IA, branding y políticas en una sola llamada. */
  context: (orgId: string) => apiRequest<OrganizationContext>(`/organizations/${orgId}/context`),
  /** Lo que permite el plan (5.6.5: tarjeta "Mi plan" y pestaña Documentos). */
  planFeatures: (orgId: string) => apiRequest<PlanFeatures>(`/organizations/${orgId}/plan-features`),
  updateBranding: (orgId: string, data: UpdateBrandingInput) =>
    apiRequest<Organization>(`/organizations/${orgId}/branding`, { method: 'PATCH', body: data }),
  updateCancellationPolicy: (orgId: string, data: UpdateCancellationPolicyInput) =>
    apiRequest<Organization>(`/organizations/${orgId}`, { method: 'PATCH', body: data }),
};

// --- Reportes ------------------------------------------------------------------

export const reportsApi = {
  /** from/to en ISO; sin fechas el backend usa los últimos 30 días. */
  get: (orgId: string, from?: string, to?: string) =>
    apiRequest<Report>(`/organizations/${orgId}/reports${qs({ from, to })}`),
};

// --- Citas ---------------------------------------------------------------------

export interface ListAppointmentsParams {
  organizationId: string;
  from?: string; // ISO
  to?: string; // ISO
  status?: AppointmentStatus[]; // sin status: todas
  clientPhone?: string;
}

export interface CreateAppointmentInput {
  organizationId: string;
  clientName: string;
  clientPhone: string;
  age?: number; // 0–150
  notes?: string;
  locationId: string;
  serviceId: string;
  startAt: string; // ISO; debe coincidir con un cupo (AppointmentSlot) activo
  endAt: string;
}

export const appointmentsApi = {
  /** Ordenadas por startAt ascendente. */
  list: ({ status, ...p }: ListAppointmentsParams) =>
    apiRequest<AppointmentWithRelations[]>(
      `/appointments${qs({ ...p, status: status?.join(',') })}`,
    ),
  get: (id: string) => apiRequest<AppointmentWithRelations>(`/appointments/${id}`),
  /**
   * 409 con cuerpo SlotFullError si el horario está lleno: ofrecer
   * "agendar de todos modos" y reintentar con raiseCapacityIfFull = true.
   */
  create: (data: CreateAppointmentInput, raiseCapacityIfFull = false) =>
    apiRequest<Appointment>(`/appointments${raiseCapacityIfFull ? '?raiseCapacityIfFull=true' : ''}`, {
      method: 'POST',
      body: data,
    }),
  cancel: (id: string, reason?: string) =>
    apiRequest<Appointment>(`/appointments/${id}/cancel?by=PROFESSIONAL`, {
      method: 'PATCH',
      body: { reason },
    }),
  /** Solo citas PENDING o CONFIRMED. */
  reschedule: (id: string, data: { startAt: string; endAt: string; locationId?: string | null }) =>
    apiRequest<Appointment>(`/appointments/${id}/reschedule?by=PROFESSIONAL`, {
      method: 'PATCH',
      body: data,
    }),
  /**
   * ASISTIO / NO_ASISTIO / REAGENDADA solo sobre citas PENDING o CONFIRMED.
   * CANCELLED no se permite aquí (usar cancel).
   */
  setStatus: (id: string, status: Exclude<AppointmentStatus, 'CANCELLED'>) =>
    apiRequest<Appointment>(`/appointments/${id}/status`, { method: 'PATCH', body: { status } }),
};

// --- Sedes ---------------------------------------------------------------------

export interface CreateLocationInput {
  organizationId: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  mapsUrl?: string; // URL válida
  timezone?: string;
  isActive?: boolean;
}

export type UpdateLocationInput = {
  name?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  mapsUrl?: string | null;
  timezone?: string;
  isActive?: boolean;
};

export const locationsApi = {
  list: (orgId: string) => apiRequest<LocationWithOrganization[]>(`/locations${qs({ organizationId: orgId })}`),
  get: (id: string) => apiRequest<LocationWithOrganization>(`/locations/${id}`),
  create: (data: CreateLocationInput) => apiRequest<Location>('/locations', { method: 'POST', body: data }),
  update: (id: string, data: UpdateLocationInput) =>
    apiRequest<Location>(`/locations/${id}`, { method: 'PATCH', body: data }),
};

// --- Servicios y precios por sede ------------------------------------------------

export interface CreateServiceInput {
  organizationId: string;
  name: string;
  description?: string;
  durationMinutes: number;
  requiredAttendees?: number; // ≥ 1
  basePrice?: number;
  isActive?: boolean;
}

export interface UpdateServiceInput {
  name?: string;
  description?: string | null;
  durationMinutes?: number;
  requiredAttendees?: number;
  basePrice?: number | null;
  isActive?: boolean;
  overrideCancellationPolicy?: boolean;
  allowClientCancellation?: boolean;
  cancellationDeadlineHours?: number | null;
  hasCancellationPenalty?: boolean;
  cancellationPenaltyText?: string | null;
}

export interface ServiceLocationInput {
  price?: number;
  isAvailable?: boolean;
  description?: string;
  durationMinutes?: number;
}

export const servicesApi = {
  list: (orgId: string) => apiRequest<ServiceWithRelations[]>(`/services${qs({ organizationId: orgId })}`),
  get: (id: string) => apiRequest<ServiceWithRelations>(`/services/${id}`),
  create: (data: CreateServiceInput) => apiRequest<Service>('/services', { method: 'POST', body: data }),
  update: (id: string, data: UpdateServiceInput) =>
    apiRequest<Service>(`/services/${id}`, { method: 'PATCH', body: data }),
};

export const serviceLocationsApi = {
  byService: (serviceId: string) =>
    apiRequest<ServiceLocationWithLocation[]>(`/service-locations/by-service/${serviceId}`),
  byLocation: (locationId: string) =>
    apiRequest<ServiceLocationWithService[]>(`/service-locations/by-location/${locationId}`),
  lookup: (serviceId: string, locationId: string) =>
    apiRequest<ServiceLocationLookup>(`/service-locations/lookup${qs({ serviceId, locationId })}`),
  create: (data: { serviceId: string; locationId: string; price: number } & ServiceLocationInput) =>
    apiRequest<ServiceLocation>('/service-locations', { method: 'POST', body: data }),
  update: (id: string, data: ServiceLocationInput) =>
    apiRequest<ServiceLocation>(`/service-locations/${id}`, { method: 'PATCH', body: data }),
};

// --- Horarios de atención (bloques por fecha) -----------------------------------

export interface CreateBusinessHourInput {
  organizationId: string;
  locationId: string; // sede (obligatoria)
  date: string; // "YYYY-MM-DD"; no puede ser una fecha pasada
  startTime: string; // "HH:MM"
  endTime: string;
  appointmentDuration: number; // ≥ 1
  breakDuration: number; // ≥ 0
  slotCapacity?: number; // "Cupo base", ≥ 1 (por defecto 1)
  isActive?: boolean;
  /**
   * Servicios que se ofrecen en el bloque: al menos uno, sin repetir, activos
   * y ofrecidos en la sede (ServiceLocation disponible). Sus cupos solo se
   * ofrecen para estos servicios. Al editar, si viene, reemplaza la lista;
   * cambiar SOLO los servicios no rehace los cupos (se permite con citas).
   */
  serviceIds: string[];
}

export type UpdateBusinessHourInput = Partial<Omit<CreateBusinessHourInput, 'organizationId'>>;

export const businessHoursApi = {
  /** Ordenados por fecha y hora; from/to = rango "YYYY-MM-DD" (inclusive). */
  list: (orgId: string, params: { locationId?: string; from?: string; to?: string } = {}) =>
    apiRequest<BusinessHourWithLocation[]>(`/business-hours${qs({ organizationId: orgId, ...params })}`),
  get: (id: string) => apiRequest<BusinessHourWithOrganization>(`/business-hours/${id}`),
  /**
   * Crea el bloque y GENERA sus cupos. 409 si se solapa con otro bloque del
   * mismo día (en cualquier sede) o si ya hay un cupo a esa hora en la sede;
   * 400 si la fecha ya pasó o no cabe ninguna cita.
   */
  create: (data: CreateBusinessHourInput) =>
    apiRequest<BusinessHour>('/business-hours', { method: 'POST', body: data }),
  /** Rehace los cupos del bloque. 409 si el bloque ya tiene citas agendadas. */
  update: (id: string, data: UpdateBusinessHourInput) =>
    apiRequest<BusinessHour>(`/business-hours/${id}`, { method: 'PATCH', body: data }),
  /** Borra el bloque y sus cupos. 409 si el bloque ya tiene citas agendadas. */
  remove: (id: string) => apiRequest<BusinessHour>(`/business-hours/${id}`, { method: 'DELETE' }),
  /**
   * Clona el bloque origen (misma sede, horas, duración, descanso y cupo base)
   * a cada fecha de targetDates, con sus cupos. Todo o nada: si una fecha choca,
   * no se crea ninguna. replace = true sustituye los bloques de esa sede en esas
   * fechas (solo si no tienen citas).
   */
  replicate: (data: { sourceId: string; targetDates: string[]; replace?: boolean }) =>
    apiRequest<BusinessHour[]>('/business-hours/replicate', { method: 'POST', body: data }),
};

// --- Cupos ---------------------------------------------------------------------

export const appointmentSlotsApi = {
  list: (p: { organizationId: string; locationId?: string; from?: string; to?: string }) =>
    apiRequest<AppointmentSlot[]>(`/appointment-slots${qs(p)}`),
  /** Horarios libres agrupados por día (from = "YYYY-MM-DD", days = cuántos días). */
  available: (p: { organizationId: string; locationId: string; serviceId?: string; from?: string; days?: number; date?: string }) =>
    apiRequest<AvailableSlots>(`/appointment-slots/available${qs(p)}`),
  create: (data: {
    organizationId: string;
    locationId: string;
    startAt: string;
    endAt: string;
    capacity?: number; // ≥ 1
    isActive?: boolean;
  }) => apiRequest<AppointmentSlot>('/appointment-slots', { method: 'POST', body: data }),
  update: (id: string, data: { capacity?: number; isActive?: boolean }) =>
    apiRequest<AppointmentSlot>(`/appointment-slots/${id}`, { method: 'PATCH', body: data }),
  remove: (id: string) => apiRequest<AppointmentSlot>(`/appointment-slots/${id}`, { method: 'DELETE' }),
};

// --- Eventos / talleres ------------------------------------------------------------

export interface CreateEventInput {
  organizationId: string;
  name: string;
  startAt: string;
  endAt: string;
  capacity: number; // ≥ 1
  description?: string;
  locationId?: string;
  venueName?: string;
  venueAddress?: string;
  mapsLink?: string; // URL válida
  requirements?: string;
  notes?: string;
  isActive?: boolean;
}

export type UpdateEventInput = Partial<Omit<CreateEventInput, 'organizationId'>>;

export const eventsApi = {
  list: (p: { organizationId: string; from?: string; to?: string; activeOnly?: boolean }) =>
    apiRequest<Event[]>(`/events${qs(p)}`),
  get: (id: string) => apiRequest<EventWithLocation>(`/events/${id}`),
  create: (data: CreateEventInput) => apiRequest<Event>('/events', { method: 'POST', body: data }),
  update: (id: string, data: UpdateEventInput) =>
    apiRequest<Event>(`/events/${id}`, { method: 'PATCH', body: data }),
  remove: (id: string) => apiRequest<Event>(`/events/${id}`, { method: 'DELETE' }),
  registrations: (eventId: string) =>
    apiRequest<EventRegistration[]>(`/events/${eventId}/registrations`),
  register: (eventId: string, data: { clientName: string; clientPhone: string; notes?: string }) =>
    apiRequest<EventRegistration>(`/events/${eventId}/registrations`, { method: 'POST', body: data }),
  cancelRegistration: (eventId: string, regId: string) =>
    apiRequest<EventRegistration>(`/events/${eventId}/registrations/${regId}/cancel`, { method: 'PATCH' }),
};

// --- Asistente IA de WhatsApp --------------------------------------------------------

export type UpdateAISettingsInput = Partial<
  Pick<
    AISettings,
    | 'enabled'
    | 'assistantName'
    | 'systemPrompt'
    | 'tone'
    | 'welcomeMessage'
    | 'sendWelcomeOnFirstMessage'
    | 'fallbackMessage'
    | 'formatWhatsappText'
    | 'whatsappFormattingHints'
    | 'temperature'
    | 'maxTokens'
    | 'allowHumanTakeover'
  >
>;

export const aiSettingsApi = {
  /** null si la organización aún no tiene configuración guardada. */
  get: (orgId: string) => apiRequest<AISettings | null>(`/ai-settings/organization/${orgId}`),
  /** Crea o actualiza (upsert). Mandar solo los campos que cambian; assistantName no puede ser null. */
  update: (orgId: string, data: UpdateAISettingsInput) =>
    apiRequest<AISettings>(`/ai-settings/organization/${orgId}`, { method: 'PATCH', body: data }),
};


// --- Centro de Notificaciones --------------------------------------------------------
// Siempre de la organización de la sesión (no lleva organizationId).

export const notificationsApi = {
  /** Más recientes primero. limit 1–50 (default 20); cursor = nextCursor de la página anterior. */
  list: (params: { limit?: number | undefined; cursor?: string | undefined } = {}) =>
    apiRequest<NotificationPage>(`/notifications${qs(params)}`),
  unreadCount: () => apiRequest<{ count: number }>('/notifications/unread-count'),
  /** Idempotente. 404 si no existe o es de otra organización. */
  markRead: (id: string) =>
    apiRequest<{ id: string; read: true; readAt: string }>(`/notifications/${id}/read`, { method: 'PATCH' }),
};

// --- Notificaciones push (Fase 5, 5.5) --------------------------------------
// Solo la persona con sesión y en su propia organización.

export const pushApi = {
  /** 503 si el backend no tiene llaves VAPID (no ofrecer el botón). */
  vapidPublicKey: () => apiRequest<{ publicKey: string }>('/push/vapid-public-key'),
  /** 201 { id }. 403 PLAN_FEATURE_NOT_INCLUDED si el plan no incluye push (mensaje listo para mostrar). */
  subscribe: (orgId: string, subscription: PushSubscriptionJSON) =>
    apiRequest<{ id: string }>(`/push/subscriptions/${orgId}`, { method: 'POST', body: subscription }),
  /** 204. Idempotente. */
  unsubscribe: (orgId: string, endpoint: string) =>
    apiRequest<void>(`/push/subscriptions/${orgId}`, { method: 'DELETE', body: { endpoint } }),
};

// --- Súper Panel (Fase 5, 5.6) ----------------------------------------------
// Solo el Súper Admin: el backend responde 403 a cualquier otro rol.

export const adminApi = {
  /** Todas las organizaciones, más nuevas primero. */
  organizations: () => apiRequest<AdminOrganization[]>('/organizations'),
  /** Plan de la organización (profile PAID/DEMO/NONE y planCode). */
  planFeatures: (orgId: string) => apiRequest<PlanFeatures>(`/organizations/${orgId}/plan-features`),
  /** Consumo de IA del periodo actual. Sin plan → period null y reason NO_ENTITLEMENT. */
  aiUsage: (orgId: string) => apiRequest<AiUsageReport>(`/ai-usage/${orgId}`),
  /** La IA deja de responder hasta reanudarla. Idempotente. */
  pauseAi: (orgId: string) => apiRequest<AiPauseResult>(`/ai-usage/${orgId}/pause`, { method: 'POST' }),
  /** Idempotente. */
  resumeAi: (orgId: string) => apiRequest<AiPauseResult>(`/ai-usage/${orgId}/resume`, { method: 'POST' }),
  /** Solo con suscripción (409 si es demo o no tiene plan). 400 si el código no existe. */
  changePlan: (orgId: string, planCode: string) =>
    apiRequest<PlanChangeResult>(`/subscriptions/${orgId}/plan`, { method: 'PATCH', body: { planCode } }),
  /** Últimos 50 rechazos del verificador; organizationId opcional para filtrar. */
  rejections: (organizationId?: string) =>
    apiRequest<VerifierRejection[]>(`/response-verifier/rejections${qs({ organizationId })}`),
  /** Demos (5.6.4): más nuevas primero, sin las PURGED. */
  demos: () => apiRequest<AdminDemo[]>('/demos'),
  /** 201. 409 si el correo ya existe. Si Evolution falla: qr null + evolutionError (reintentar con demoQr). */
  createDemo: (input: CreateDemoInput) => apiRequest<DemoQrResult>('/demos', { method: 'POST', body: input }),
  /** QR nuevo (caduca en segundos). 409 si la demo ya no espera QR o ya está conectada. */
  demoQr: (demoId: string) => apiRequest<DemoQrResult>(`/demos/${demoId}/qr`),
  /** Solo QR_PENDING o ACTIVE (409 en otro estado). Sus datos se borran a los 60 días. */
  cancelDemo: (demoId: string) => apiRequest<DemoCancelResult>(`/demos/${demoId}/cancel`, { method: 'POST' }),
  /** Solo ACTIVE, EXPIRED o CANCELLED. 409 si el WABA ya es de otra organización. */
  convertDemo: (demoId: string, input: ConvertDemoInput) =>
    apiRequest<DemoConvertResult>(`/demos/${demoId}/convert`, { method: 'POST', body: input }),
};

// --- Conversaciones en pausa (Fase 5, 5.6.5) ---------------------------------
// Pacientes que esperan atención humana: la IA no les responde hasta reanudar.

export const pausedApi = {
  list: (orgId: string) => apiRequest<PausedConversation[]>(`/conversation-context/${orgId}/paused`),
  /** 400 si el teléfono no es internacional (+52…). Idempotente. */
  pause: (orgId: string, phone: string) =>
    apiRequest<ConversationModeChange>(`/conversation-context/${orgId}/pause`, { method: 'POST', body: { phone } }),
  /** Idempotente. */
  resume: (orgId: string, phone: string) =>
    apiRequest<ConversationModeChange>(`/conversation-context/${orgId}/resume`, { method: 'POST', body: { phone } }),
};

// --- Documentos para la IA (Fase 5, 5.4b / 5.6.5) -----------------------------
// Solo planes con ragEnabled (Premium). Subir: 403 si el plan no lo incluye o se llegó al límite (message listo).

export const knowledgeApi = {
  list: (orgId: string) => apiRequest<KnowledgeDocumentList>(`/knowledge/${orgId}/documents`),
  /** 202: queda PROCESSING; el estado final se ve en list. 409 si ya existe, 413 si pasa de 20 MB. */
  upload: (orgId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiRequest<KnowledgeDocument>(`/knowledge/${orgId}/documents`, { method: 'POST', body: form });
  },
  remove: (orgId: string, id: string) =>
    apiRequest<{ deleted: true }>(`/knowledge/${orgId}/documents/${id}`, { method: 'DELETE' }),
};
