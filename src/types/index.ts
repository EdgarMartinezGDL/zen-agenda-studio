export type UserRole = "SUPER_ADMIN" | "PROFESSIONAL" | "ASSISTANT";

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  organizationId: string;
}

export type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED"
  | "ASISTIO"
  | "NO_ASISTIO"
  | "REAGENDADA";

export interface Appointment {
  id: string;
  clientName: string;
  clientPhone: string;
  age: number | null;
  notes: string | null;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  organizationId: string;
  locationId: string | null;
  serviceId: string | null;
  location?: { id: string; name: string } | null;
  service?: { id: string; name: string } | null;
}

export interface SlotFull {
  capacity: number;
  bookedCount: number;
  suggestedCapacity: number;
}

export interface Location {
  id: string;
  name: string;
  address: string | null;
  mapsUrl?: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  isActive: boolean;
  organizationId: string;
}

export interface ServiceLocation {
  id: string;
  serviceId: string;
  locationId: string;
  price: number;
  isAvailable: boolean;
  description: string | null;
  durationMinutes: number | null;
  location?: { id: string; name: string };
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  requiredAttendees: number;
  isActive: boolean;
  organizationId: string;
  serviceLocations: ServiceLocation[];
}

export interface OrganizationContext {
  locations: Location[];
  services: Service[];
}

export interface BusinessHour {
  id: string;
  /** Fecha real del bloque en formato YYYY-MM-DD */
  date: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  appointmentDuration: number;
  breakDuration: number;
  /** Cupo base por franja */
  capacity: number;
  isActive: boolean;
  organizationId: string;
  locationId: string | null;
  /** Servicios que se ofrecen en el bloque (al menos uno). */
  serviceIds?: string[];
  services?: { id: string; name: string }[];
}

export interface Event {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  startAt: string;
  endAt: string;
  locationId: string | null;
  location?: { id: string; name: string } | null;
  venueName: string | null;
  venueAddress: string | null;
  mapsLink: string | null;
  requirements: string | null;
  notes: string | null;
  capacity: number;
  bookedCount: number;
  isActive: boolean;
  isFull?: boolean;
}

export type EventRegistrationStatus = "CONFIRMED" | "CANCELLED";

export interface EventRegistration {
  id: string;
  eventId: string;
  clientName: string;
  clientPhone: string;
  notes: string | null;
  status: EventRegistrationStatus;
}

export interface AISettings {
  id: string;
  organizationId: string;
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

export interface Organization {
  id: string;
  name: string;
  slug: string;
  allowClientCancellation: boolean;
  cancellationDeadlineHours: number | null;
  hasCancellationPenalty: boolean;
  cancellationPenaltyText: string | null;
  theme: "light" | "dark" | "auto";
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  fontFamily: string | null;
  fontScale: "sm" | "md" | "lg";
  /** Nombre mostrado en la cabecera (si se deja vacío se usa `name`). */
  headerName?: string | null;
  /** Tamaño forzado del nombre en la cabecera. */
  headerNameSize?: "sm" | "md" | "lg" | null;
}

export interface Report {
  range: { from: string; to: string };
  appointments: {
    total: number;
    byStatus: { PENDING: number; CONFIRMED: number; CANCELLED: number; COMPLETED: number };
    cancelled: { total: number; byWho: { CLIENT: number; PROFESSIONAL: number; UNKNOWN: number } };
    rescheduled: { appointments: number; totalReschedules: number };
  };
  topServices: { serviceId: string | null; name: string | null; count: number }[];
  slotOccupancy: { totalCapacity: number; totalBooked: number; rate: number };
  events: { total: number; registrations: { total: number; cancelled: number } };
}

export interface AppointmentSlot {
  id: string;
  organizationId: string;
  locationId: string | null;
  startAt: string;
  endAt: string;
  capacity: number;
  bookedCount: number;
  isActive: boolean;
  isFull?: boolean;
}
