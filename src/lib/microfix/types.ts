// Tipos de la API de MicroFix Cloud (backend NestJS).
//
// Validados contra respuestas REALES del backend con
// integracion-lovable/validacion/validar.cjs: cada ejemplo de
// integracion-lovable/ejemplos/ se compila contra estos tipos como objeto
// literal, así que un campo de más, de menos o con otro tipo rompe la
// validación. Fechas: siempre ISO 8601 en UTC (string).

// --- Enums -------------------------------------------------------------------

export type UserRole = 'SUPER_ADMIN' | 'PROFESSIONAL' | 'ASSISTANT';

export type AppointmentStatus =
  | 'PENDING' // pendiente (estado con el que nace)
  | 'CONFIRMED'
  | 'CANCELLED' // solo vía PATCH /appointments/:id/cancel
  | 'COMPLETED'
  | 'ASISTIO' // el paciente asistió (suma a ingresos del reporte)
  | 'NO_ASISTIO'
  | 'REAGENDADA';

export type CancelledBy = 'CLIENT' | 'PROFESSIONAL';

export type EventRegistrationStatus = 'CONFIRMED' | 'CANCELLED';

export type Theme = 'light' | 'dark' | 'auto';
export type FontScale = 'sm' | 'md' | 'lg';
export type FontFamily = 'System' | 'Inter' | 'Roboto' | 'Open Sans' | 'Lato' | 'Poppins';

// --- Auth --------------------------------------------------------------------

/** Usuario que devuelve POST /auth/login (se guarda en localStorage). */
export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  organizationId: string | null;
}

export interface LoginResponse {
  access_token: string; // JWT, vence en 8 h
  user: AuthUser;
}

/** GET /auth/me */
export interface AuthProfile extends AuthUser {
  createdAt: string;
  updatedAt: string;
}

// --- Organización ------------------------------------------------------------

export interface Organization {
  id: string;
  name: string;
  slug: string;
  allowClientCancellation: boolean;
  cancellationDeadlineHours: number | null;
  hasCancellationPenalty: boolean;
  cancellationPenaltyText: string | null;
  theme: Theme;
  logoUrl: string | null;
  primaryColor: string | null; // "#RRGGBB"
  secondaryColor: string | null;
  fontFamily: FontFamily | null;
  fontScale: FontScale;
  createdAt: string;
  updatedAt: string;
}

export interface CancellationPolicy {
  allowClientCancellation: boolean;
  cancellationDeadlineHours: number | null;
  hasCancellationPenalty: boolean;
  cancellationPenaltyText: string | null;
}

// --- Sedes (Location) ----------------------------------------------------------

export interface Location {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  mapsUrl: string | null;
  timezone: string; // p. ej. "America/Mexico_City"
  isActive: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

/** GET /locations y GET /locations/:id */
export interface LocationWithOrganization extends Location {
  organization: Organization;
}

// --- Servicios -----------------------------------------------------------------

export interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  requiredAttendees: number;
  basePrice: number | null; // precio de respaldo si la sede no define uno
  overrideCancellationPolicy: boolean;
  allowClientCancellation: boolean;
  cancellationDeadlineHours: number | null;
  hasCancellationPenalty: boolean;
  cancellationPenaltyText: string | null;
  isActive: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

/** Precio/disponibilidad de un servicio en una sede (fuente principal del precio). */
export interface ServiceLocation {
  id: string;
  serviceId: string;
  locationId: string;
  isAvailable: boolean;
  price: number;
  description: string | null;
  durationMinutes: number | null; // null = usa la duración del servicio
  createdAt: string;
  updatedAt: string;
}

/** GET /services y GET /services/:id */
export interface ServiceWithRelations extends Service {
  organization: Organization;
  serviceLocations: ServiceLocation[];
}

/** GET /service-locations/by-service/:serviceId */
export interface ServiceLocationWithLocation extends ServiceLocation {
  location: Location;
}

/** GET /service-locations/by-location/:locationId */
export interface ServiceLocationWithService extends ServiceLocation {
  service: Service;
}

/** GET /service-locations/lookup?serviceId=&locationId= */
export interface ServiceLocationLookup {
  serviceId: string;
  locationId: string;
  serviceName: string;
  locationName: string;
  isAvailable: boolean;
  price: number;
  description: string | null;
  durationMinutes: number;
}

// --- Contexto de la organización (todo en una llamada) -------------------------

export interface ContextService extends Service {
  serviceLocations: ServiceLocation[];
  effectiveCancellationPolicy: CancellationPolicy;
}

export interface ContextAISettings {
  enabled: boolean;
  assistantName: string;
  tone: string | null;
  welcomeMessage: string | null;
  sendWelcomeOnFirstMessage: boolean;
  fallbackMessage: string | null;
  formatWhatsappText: boolean;
  whatsappFormattingHints: string | null;
  allowHumanTakeover: boolean;
}

export interface ContextBusinessHour {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  appointmentDuration: number;
  breakDuration: number;
  locationId: string | null;
}

/** Horarios llenos o desactivados de los próximos 30 días. */
export interface ContextUnavailableSlot {
  locationId: string | null;
  startAt: string;
  endAt: string;
  reason: 'full' | 'inactive';
}

/** Eventos activos con cupo de los próximos 60 días. */
export interface ContextEvent {
  id: string;
  name: string;
  description: string | null;
  startAt: string;
  endAt: string;
  location: { id: string; name: string } | null;
  venueName: string | null;
  venueAddress: string | null;
  mapsLink: string | null;
  requirements: string | null;
  notes: string | null;
  spotsLeft: number;
}

/** GET /organizations/:id/context */
export interface OrganizationContext extends Organization {
  timezone: string; // zona de la clínica
  locations: Location[];
  services: ContextService[];
  ai: ContextAISettings; // con valores por defecto si la org no tiene configuración
  branding: {
    theme: Theme;
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    fontFamily: FontFamily | null;
    fontScale: FontScale;
    logoConstraints: { maxBytes: number; allowedFormats: string[] };
  };
  cancellationPolicy: CancellationPolicy;
  businessHours: ContextBusinessHour[];
  unavailableSlots: ContextUnavailableSlot[];
  events: ContextEvent[];
}

// --- Citas ---------------------------------------------------------------------

export interface Appointment {
  id: string;
  clientName: string;
  clientPhone: string;
  age: number | null;
  notes: string | null;
  metadata: Record<string, unknown> | null; // p. ej. { motivo: "..." } desde WhatsApp
  status: AppointmentStatus;
  cancelledAt: string | null;
  cancelledBy: CancelledBy | null;
  cancellationReason: string | null;
  rescheduleCount: number;
  startAt: string;
  endAt: string;
  organizationId: string;
  locationId: string | null;
  serviceId: string | null;
  slotId: string | null;
  reminderSentAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  professionalId: string | null;
  patientId: string | null;
}

/** GET /appointments y GET /appointments/:id */
export interface AppointmentWithRelations extends Appointment {
  organization: Organization;
  location: Location | null;
  service: Service | null;
}

/** Cuerpo del 409 de POST /appointments cuando el horario está lleno. */
export interface SlotFullError {
  statusCode: 409;
  error: 'Conflict';
  message: string;
  slotFull: { capacity: number; bookedCount: number; suggestedCapacity: number };
}

// --- Horarios de atención ------------------------------------------------------

export interface BusinessHour {
  id: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string;
  appointmentDuration: number; // minutos
  breakDuration: number; // minutos
  slotCapacity: number; // cupo base
  isActive: boolean;
  organizationId: string;
  locationId: string;
  serviceIds: string[]; // servicios que se ofrecen en el bloque (al menos uno)
  services: { id: string; name: string }[]; // los mismos, con nombre (orden alfabético)
  createdAt: string;
  updatedAt: string;
}

/** GET /business-hours?organizationId= */
export interface BusinessHourWithLocation extends BusinessHour {
  location: Location | null;
}

/** GET /business-hours/:id */
export interface BusinessHourWithOrganization extends BusinessHour {
  organization: Organization;
  location: Location | null;
}

// --- Cupos (AppointmentSlot) ---------------------------------------------------

export interface AppointmentSlot {
  id: string;
  organizationId: string;
  locationId: string | null;
  startAt: string;
  endAt: string;
  capacity: number;
  bookedCount: number;
  businessHourId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  isFull: boolean;
}

/** GET /appointment-slots/available */
export interface AvailableSlots {
  locationId: string;
  from: string; // "YYYY-MM-DD"
  upcoming: {
    date: string; // "YYYY-MM-DD"
    slots: { startAt: string; endAt: string; spotsLeft: number }[];
  }[];
}

// --- Eventos -------------------------------------------------------------------

export interface Event {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  startAt: string;
  endAt: string;
  locationId: string | null;
  venueName: string | null;
  venueAddress: string | null;
  mapsLink: string | null;
  requirements: string | null;
  notes: string | null;
  capacity: number;
  bookedCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  isFull: boolean;
}

/** GET /events/:id */
export interface EventWithLocation extends Event {
  location: Location | null;
}

export interface EventRegistration {
  id: string;
  eventId: string;
  clientName: string;
  clientPhone: string;
  notes: string | null;
  status: EventRegistrationStatus;
  createdAt: string;
  updatedAt: string;
}

// --- IA (asistente de WhatsApp) -------------------------------------------------

export interface AISettings {
  id: string;
  enabled: boolean;
  assistantName: string;
  systemPrompt: string | null;
  tone: string | null;
  welcomeMessage: string | null;
  sendWelcomeOnFirstMessage: boolean;
  fallbackMessage: string | null;
  formatWhatsappText: boolean;
  whatsappFormattingHints: string | null;
  temperature: number;
  maxTokens: number;
  allowHumanTakeover: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

// --- Reportes ------------------------------------------------------------------

/** GET /organizations/:id/reports?from=&to= (sin fechas: últimos 30 días) */
export interface Report {
  range: { from: string; to: string };
  appointments: {
    total: number;
    byStatus: Record<AppointmentStatus, number>;
    cancelled: {
      total: number;
      byWho: { CLIENT: number; PROFESSIONAL: number; UNKNOWN: number };
    };
    rescheduled: { appointments: number; totalReschedules: number };
  };
  topServices: { serviceId: string | null; name: string | null; count: number }[];
  slotOccupancy: { totalCapacity: number; totalBooked: number; rate: number };
  events: { total: number; registrations: { total: number; cancelled: number } };
  revenue: { total: number }; // suma del precio de las citas ASISTIO del rango
}

// --- Errores -------------------------------------------------------------------

/** Forma estándar de error de NestJS (message es un arreglo si falla la validación). */
export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}

// --- Centro de Notificaciones ---------------------------------------------------

/** created = cita nueva; cancelled = cancelada; rescheduled = reagendada. */
export type NotificationType = 'created' | 'cancelled' | 'rescheduled' | 'billing';

/** Aviso de cobro (Fase 6, 6.5): solo en type 'billing'. */
export type BillingNoticeKind =
  | 'PAYMENT_FAILED'
  | 'SUSPENSION_TOMORROW'
  | 'ACCOUNT_SUSPENDED'
  | 'PAYMENT_RECEIVED'
  | 'PRICE_CHANGED';

/** Elemento de GET /notifications. Textos ya armados en la zona de la sede. */
export interface AppNotification {
  id: string;
  type: NotificationType;
  billingKind?: BillingNoticeKind; // solo en 'billing'
  appointmentId: string | null; // null en 'billing'
  createdAt: string; // ISO UTC: cuándo ocurrió
  read: boolean;
  readAt: string | null;
  title: string; // "Nueva cita por WhatsApp", "Cita cancelada por el cliente", …
  message: string; // "Ana López · Lunes 12 de octubre a las 2:00 pm · Consultorio Zapopan"
  clientName: string | null;
  startAt: string | null; // ISO UTC: horario de la cita (el nuevo, si se reagendó)
  previousStartAt: string | null; // solo rescheduled
  locationName: string | null;
  by: 'CLIENT' | 'PROFESSIONAL' | null; // null en created
  channel: 'WHATSAPP' | 'APP' | null; // solo created
  reason: string | null; // solo cancelled
}

/** GET /notifications?limit=&cursor= */
export interface NotificationPage {
  items: AppNotification[];
  nextCursor: string | null; // null = no hay más
}

// --- Súper Panel (Fase 5, 5.6) -------------------------------------------------
// Solo el Súper Admin. Su sesión NO tiene organización (organizationId null).

/** GET /organizations (el Súper Admin ve todas, más nuevas primero). */
export interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  aiPausedAt: string | null;
  createdAt: string;
}

/** GET /organizations/:id/plan-features. NONE = sin plan ni demo activa. */
export interface PlanFeatures {
  profile: 'PAID' | 'DEMO' | 'NONE';
  planCode: string | null; // ESSENTIAL | PREMIUM; null en DEMO y NONE
  maxLocations: number;
  maxServices: number | null; // null = ilimitado
  eventsEnabled: boolean;
  smartCancellationEnabled: boolean;
  ragEnabled: boolean;
  pushEnabled: boolean;
}

/** GET /ai-usage/:organizationId — consumo de IA del periodo actual. */
export type AiUsageReport =
  | {
      organizationId: string;
      aiPausedAt: string | null;
      profile: 'PAID' | 'DEMO';
      period: {
        start: string;
        end: string;
        tokenLimit: number;
        consumedTokens: number;
        reservedTokens: number;
        percentUsed: number; // entero hacia abajo; puede pasar de 100 en planes de pago
      };
    }
  | {
      organizationId: string;
      aiPausedAt: string | null;
      profile: null;
      period: null;
      reason: 'NO_ENTITLEMENT';
    };

/** POST /ai-usage/:organizationId/pause | resume. changed:false = ya estaba así. */
export interface AiPauseResult {
  organizationId: string;
  aiPausedAt: string | null;
  changed: boolean;
}

export interface PlanExcessItem {
  active: number;
  max: number | null; // null = ilimitado
  exceeded: boolean;
}

export type TokenAdjustment =
  | 'RAISED_CURRENT_PERIOD'
  | 'CURRENT_PERIOD_ALREADY_AT_LIMIT'
  | 'NEXT_PERIOD'
  | 'NO_PERIOD';

/** PATCH /subscriptions/:organizationId/plan. Nunca desactiva nada: solo avisa del excedente. */
export interface PlanChangeResult {
  organizationId: string;
  changed: boolean; // false = ya tenía ese plan (no trae direction ni tokenAdjustment)
  fromPlan: string;
  toPlan: string;
  direction?: 'UPGRADE' | 'DOWNGRADE' | 'LATERAL';
  tokenAdjustment?: TokenAdjustment;
  excess: { locations: PlanExcessItem; services: PlanExcessItem };
  /** 6.6.5: solo si paga con Stripe. proratedAmountCents > 0 se cobró, < 0 queda a favor, null sin factura. */
  stripe?: { proratedAmountCents: number | null; stripeInvoiceId: string | null };
}

/** GET /response-verifier/rejections — últimos 50, más nuevos primero. */
export interface VerifierRejection {
  id: string;
  createdAt: string;
  organizationId: string | null;
  organizationName: string | null;
  profile: string | null; // PAID | DEMO
  planCode: string | null;
  unknownPrices: string[]; // cifras tal como las escribió la IA
  unknownTimes: string[];
  paused: boolean; // true = el paciente quedó en atención humana (PREMIUM)
}

// --- Súper Panel: demos (Fase 5, 5.6.4) ----------------------------------------

export type DemoStatus = 'CREATING' | 'QR_PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'CONVERTED' | 'PURGED';

/** GET /demos — más nuevas primero (máx. 200), sin las PURGED. */
export interface AdminDemo {
  id: string;
  organizationId: string;
  organizationName: string;
  status: DemoStatus;
  firstConnectionAt: string | null; // al escanear el QR empiezan los 7 días
  expiresAt: string | null;
  purgeAt: string | null; // EXPIRED/CANCELLED: cuándo se borran sus datos
  createdAt: string;
}

/** POST /demos */
export interface CreateDemoInput {
  businessName: string;
  ownerFullName: string;
  ownerEmail: string;
  ownerPassword: string; // 8 a 72 caracteres; el Súper Admin se la da al cliente
  ownerPhone: string; // E.164, p. ej. +5213312345678
}

/** POST /demos y GET /demos/:id/qr. qr null + evolutionError = Evolution falló (reintentar con GET …/qr). */
export interface DemoQrResult {
  demo: { id: string; organizationId: string; status: DemoStatus };
  qr: { base64: string | null; code: string | null } | null; // base64 = data:image/png;base64,…
  evolutionError?: string;
}

/** POST /demos/:id/cancel (solo QR_PENDING o ACTIVE). */
export interface DemoCancelResult {
  demo: { id: string; organizationId: string; status: DemoStatus };
  purgeAt: string;
  cancelledOutboundMessages: number;
  evolutionDeletedAt: string | null;
  evolutionError?: string;
}

/** POST /demos/:id/convert (solo ACTIVE, EXPIRED o CANCELLED). Las llaves de YCloud nunca vuelven. */
export interface ConvertDemoInput {
  planCode: 'ESSENTIAL' | 'PREMIUM';
  billingCycle: 'MONTHLY' | 'YEARLY';
  paymentMethod: 'CARD' | 'BANK_TRANSFER' | 'CASH' | 'WALLET' | 'OTHER';
  phoneNumber: string; // E.164
  businessAccountId: string;
  ycloudApiKey: string;
  ycloudWebhookSecret: string;
}

export interface DemoConvertResult {
  demo: { id: string; organizationId: string; status: DemoStatus };
  subscription: { planCode: string; billingCycle: string; paymentMethod: string; status: string };
  integration: {
    provider: string;
    phoneNumber: string;
    businessAccountId: string;
    hasApiKey: boolean;
    hasWebhookSecret: boolean;
  };
  evolutionDeletedAt: string | null;
  evolutionError?: string;
}

// --- Pantallas del profesional (Fase 5, 5.6.5) ---------------------------------

/** GET /conversation-context/:org/paused — más antiguos primero. */
export interface PausedConversation {
  id: string;
  phone: string; // E.164, p. ej. +5215512345678
  name: string | null;
  pausedAt: string;
  origin: 'WHATSAPP' | 'PANEL' | 'BOT'; // BOT = la IA pidió ayuda o el verificador la pausó
}

/** POST /conversation-context/:org/pause | resume. changed:false = ya estaba así. */
export interface ConversationModeChange {
  phone: string;
  changed: boolean;
  previousMode: string;
  newMode: string;
}

export type KnowledgeDocumentStatus = 'PROCESSING' | 'READY' | 'FAILED';

export interface KnowledgeDocument {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: KnowledgeDocumentStatus;
  failureReason: string | null; // texto listo para mostrar
  charCount: number | null;
  chunkCount: number | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /knowledge/:org/documents. Los FAILED no cuentan en usage. */
export interface KnowledgeDocumentList {
  documents: KnowledgeDocument[];
  usage: { documents: number; maxDocuments: number; bytes: number; maxBytes: number };
}

// --- Súper Panel: avisos de cuentas suspendidas (Fase 6, 6.5) -------------------

/** Elemento de GET /admin/billing-notices: una clínica que pasó a SUSPENDED. */
export interface AdminBillingNotice {
  id: string;
  kind: BillingNoticeKind; // hoy siempre ACCOUNT_SUSPENDED
  organizationId: string;
  organizationName: string;
  title: string;
  message: string; // "Clínica X quedó suspendida. Su asistente virtual dejó de atender a sus pacientes."
  createdAt: string;
  read: boolean;
  readAt: string | null;
}

/** GET /admin/billing-notices?limit=&cursor= — más recientes primero. */
export interface AdminBillingNoticePage {
  items: AdminBillingNotice[];
  nextCursor: string | null; // null = no hay más
  unreadCount: number; // de todos los avisos, no solo de esta página
}

// --- "Mi plan" del profesional (Fase 6, 6.6) ------------------------------------

export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED';
export type BillingCycle = 'MONTHLY' | 'YEARLY';
/** CHECKOUT = contratar o reactivar; UPDATE_PAYMENT_METHOD = regularizar en el Portal; NONE = nada. */
export type BillingAction = 'NONE' | 'UPDATE_PAYMENT_METHOD' | 'CHECKOUT';

/** GET /billing/:org/summary */
export interface BillingSummary {
  status: SubscriptionStatus | null; // null = sin plan de pago (demo o nada)
  planCode: string | null;
  billingCycle: BillingCycle | null;
  paymentMethod: string | null;
  managedByStripe: boolean;
  canOpenPortal: boolean;
  currentPeriodEnd: string | null; // pagado hasta (ISO)
  pastDueSince: string | null;
  suspendsAt: string | null; // solo PAST_DUE: cuándo se suspende
  suspendedAt: string | null;
  lastPayment: { amountCents: number; currency: string; paidAt: string | null } | null;
  action: BillingAction;
}

/** Elemento de GET /billing/:org/payments (más recientes primero). */
export interface BillingPayment {
  id: string;
  status: 'PAID' | 'FAILED';
  amountCents: number;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  failureReason: string | null;
  failureText: string | null; // solo FAILED: texto listo para mostrar
  invoiceUrl: string | null;
  createdAt: string;
}

/** Elemento de GET /billing/prices (precios vigentes). */
export interface BillingPrice {
  planCode: string;
  billingCycle: BillingCycle;
  currency: string;
  amountCents: number;
}

// --- Súper Panel: pagos (Fase 6, 6.6) ----------------------------------------------

/** Elemento de GET /admin/billing/subscriptions (SUSPENDED, luego PAST_DUE, luego ACTIVE). */
export interface AdminBillingSubscription {
  organizationId: string;
  organizationName: string;
  planCode: string;
  billingCycle: BillingCycle | null;
  status: SubscriptionStatus;
  paymentMethod: string | null;
  managedByStripe: boolean;
  currentPeriodEnd: string | null;
  pastDueSince: string | null;
  suspendsAt: string | null; // solo PAST_DUE
  suspendedAt: string | null;
  lastPayment: { amountCents: number; currency: string; paidAt: string | null } | null;
  lastFailure: {
    amountCents: number;
    currency: string;
    failureReason: string | null;
    failureText: string | null;
    createdAt: string;
  } | null;
}

export interface AdminBillingOverview {
  totals: Record<SubscriptionStatus, number>; // de todas, aunque se filtre
  subscriptions: AdminBillingSubscription[];
}

/** Elemento de GET /admin/billing/prices: vigentes primero. */
export interface AdminPrice {
  id: string;
  planCode: string;
  billingCycle: BillingCycle;
  currency: string;
  amountCents: number;
  isActive: boolean;
  createdAt: string;
  /** Solo vigentes: suscripciones que siguen con un precio viejo (debe ser 0). null = no vigente o sin Stripe. */
  pendingMigration: number | null;
}

/** POST /admin/billing/prices y POST /admin/billing/prices/:id/migrate */
export interface PriceChangeResult {
  price: Omit<AdminPrice, 'pendingMigration'>;
  migrated: number;
  failed: { stripeSubscriptionId: string; organizationId: string | null; error: string }[];
}

export type DiscountType = 'PERCENT' | 'AMOUNT';
export type DiscountDuration = 'ONCE' | 'REPEATING' | 'FOREVER';

/** Elemento de GET /admin/billing/discounts (más nuevos primero). */
export interface AdminDiscount {
  id: string;
  code: string;
  type: DiscountType | null;
  value: number | null; // PERCENT: 1–100; AMOUNT: centavos
  duration: DiscountDuration | null;
  durationMonths: number | null;
  planCodes: string[];
  expiresAt: string | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  active: boolean;
  createdAt: string;
}

export interface CreateDiscountInput {
  code: string; // 3–20 letras o números (se guarda en mayúsculas)
  type: DiscountType;
  value: number;
  duration: DiscountDuration;
  durationMonths?: number; // solo REPEATING: 1–36
  planCodes: string[];
  expiresAt?: string; // ISO, fecha futura
  maxRedemptions?: number;
}
