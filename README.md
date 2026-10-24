# Mi Agenda ZEN

Actúa como un Desarrollador Experto en React, Tailwind CSS y diseño Mobile-First UI/UX.

Voy a construir "Mi Agenda Zen", una aplicación web (SPA) para que profesionales de la salud/consultorios gestionen su agenda. La aplicación consumirá una API REST propia ya existente (NestJS).

Quiero que generes la estructura base del proyecto, la navegación y el sistema de diseño según las especificaciones técnicas que te daré a continuación.

**REQUERIMIENTOS DE DISEÑO Y UI/UX (CRÍTICO):**

1. **Modo Claro / Oscuro (Dark Mode):** La aplicación DEBE soportar ambos modos, con un selector (switch) para que el usuario elija. 

2. **Paleta de Colores (Zen Emerald & Gold Accent):**

   - **Esmeralda Clínico (Primario/Acciones):** `#0F766E` en modo claro, adaptado a un tono ligeramente más brillante (`#14B8A6`) en modo oscuro para contraste. Se usa para botones principales y estados activos.

   - **Dorado Cálido (Secundario/Acento):** `#D97706` o `#C89938`. Usar exclusivamente para insignias, iconos destacados, el logo y detalles premium. No usar para fondos de botones grandes.

   - **Fondos Modo Claro:** Base en `#F8FAFC` (gris muy tenue), tarjetas en `#FFFFFF`. Texto principal `#0F172A`.

   - **Fondos Modo Oscuro:** Base en `#0F172A` (azul/gris muy oscuro), tarjetas en `#1E293B`. Texto principal `#F8FAFC`.

   - **Estados de citas:** Ámbar = Pendiente, Esmeralda = Confirmada, Rojo suave = Cancelada, Gris = Completada. Deben verse bien en ambos modos.

3. **Logo y Marca (Sin imágenes borrosas):**

   - NO quiero depender de una imagen subida para el texto del logo porque se deforma.

   - En la cabecera (móvil) y sidebar (escritorio), el logo debe estar compuesto por:

     a) Un icono visual (puedes usar un SVG circular o un icono de Lucide con acento dorado).

     b) El texto "Mi Agenda Zen" renderizado nativamente con tipografía clara (ej. Inter o Plus Jakarta Sans, peso bold), seguido del subtítulo "By MicroFix Cloud" en texto más pequeño y tenue.

4. **Layout Responsive:**

   - Escritorio (≥768px): Sidebar fija a la izquierda (256px) con logo, navegación vertical, selector de tema (claro/oscuro) y botón "Salir".

   - Móvil (<768px): Cabecera superior con logo, y Barra de Navegación Inferior (Bottom Navigation) fija con 4 iconos de acceso.

**ESPECIFICACIÓN TÉCNICA Y DE RUTAS (Implementa las vistas):**

A continuación te pego la especificación técnica de las rutas, componentes y flujos. Necesito que generes la estructura de carpetas, los layouts (`AppShell`), el Router y las pantallas principales vacías pero navegables, aplicando el sistema de diseño de colores que mencioné arriba.

Aquí está la especificación técnica consolidada, lista para copiar y pegar en Lovable (o cualquier otra herramienta):

# Mi Agenda Zen — App del Profesional — Especificación Técnica Frontend

App móvil-first (React + Vite + TypeScript + Tailwind CSS) para que el

profesional/consultorio gestione su agenda: citas, catálogo, talleres,

reportes y configuración. Consume una API REST propia (NestJS + Postgres).

Autenticación por JWT (Bearer token) guardado en `localStorage`.

## 0. Stack y convenciones generales

- **Stack**: React 19 + React Router 7 + TanStack Query v5 (fetching/cache) +

  Tailwind CSS v4 + lucide-react (iconos) + date-fns (no se usa activamente,

  solo instalado). SPA pura, sin SSR.

- **Layout responsive**: `md:` breakpoint de Tailwind separa dos layouts:

  - **Escritorio (≥768px)**: sidebar fija a la izquierda (256px) con logo +

    nombre, navegación vertical, usuario + botón "Salir" abajo.

  - **Móvil (<768px)**: cabecera superior (logo + nombre + botón salir) y

    barra de navegación inferior fija con 4 íconos.

- **Paleta**: neutro `slate` (fondos, texto, bordes) + acento `emerald`

  (botones primarios, estados activos, "Confirmada"). Estados de cita:

  ámbar=Pendiente, esmeralda=Confirmada, rojo=Cancelada, gris=Completada.

- **Componentes genéricos reutilizados en toda la app** (sin librería de UI

  externa): `Modal` (bottom-sheet en móvil / diálogo centrado en escritorio,

  con botón X), `Banner` (success/error, franja de color arriba de un

  formulario).

- **Patrón de pantalla con catálogo** (Ubicaciones/Servicios/Horarios/

  Cupos/Eventos): lista de tarjetas → tap abre modal de edición → botón

  punteado "Nuevo…" al final de la lista abre el mismo modal vacío.

- **Patrón de mutación**: cada modal usa `useMutation` (TanStack Query);

  éxito → invalida la query relacionada + cierra el modal; error → banner

  rojo con el mensaje del backend (`ApiError.message`).

- **Branding actual**: `/logo.png` (login, centrado, ~64px alto) y

  `/icon.png` (32px junto al nombre en sidebar/cabecera, y como favicon).

  Nombre de la app: "Mi Agenda Zen" — subtítulo "By MicroFix Cloud".

## 1. Rutas (React Router)

| Ruta | Pantalla | Protegida |

|---|---|---|

| `/login` | Login | No |

| `/` | Hoy (agenda del día) | Sí |

| `/eventos` | Talleres/eventos | Sí |

| `/reportes` | Reportes | Sí |

| `/negocio` | Negocio (5 pestañas internas) | Sí |

"Protegida" = envuelta en `<RequireAuth>` (si no hay sesión, redirige a

`/login`) y en `<AppShell>` (layout con nav). El login redirige a `/` si ya

hay sesión activa.

## 2. Catálogo de pantallas

### 2.1 Login (`/login`)

Formulario centrado, ancho máx. `max-w-sm`: logo, subtítulo, tarjeta blanca

con inputs "Correo" (type email) y "Contraseña" (type password), botón

"Entrar" (ancho completo, emerald). Banner de error inline si falla. Sin

registro ni "olvidé mi contraseña" — el alta de usuarios es manual.

### 2.2 Hoy (`/`)

Header con título "Hoy"/"Agenda" (según si es el día actual), navegación de

día (‹ Hoy ›), label de fecha en español. Lista de citas del día como

tarjetas (`AppointmentCard`). Botón flotante "+" (esquina inferior derecha)

abre modal de nueva cita. Tap en una tarjeta abre modal de detalle.

### 2.3 Talleres y eventos (`/eventos`)

Lista de eventos próximos como tarjetas (nombre, fecha/hora, cupo

`bookedCount/capacity`, ubicación, badges "Lleno"/"Inactivo"). Botón

punteado "Nuevo taller o evento". Tap abre modal de edición con, dentro,

una sub-sección de inscritos (listar/agregar/cancelar).

### 2.4 Reportes (`/reportes`)

Selector de rango (3 presets: 7/30/90 días). 4 stat tiles (citas totales,

% ocupación, canceladas, reagendadas). Secciones con barras horizontales:

citas por estado, cancelaciones por quién (solo si hay canceladas), top 5

servicios más agendados, resumen de eventos (3 tiles). Sin librería de

gráficas — barras hechas a mano con `<div>` + `width%`.

### 2.5 Negocio (`/negocio`) — 5 pestañas internas (tabs, no rutas)

1. **Ubicaciones** — lista + modal crear/editar (nombre, dirección,

   teléfono, correo, activa/inactiva).

2. **Servicios** — lista + modal crear/editar (nombre, descripción,

   duración, personas requeridas, activo/inactivo) + sub-sección "Precio por

   ubicación" (agregar ubicación con precio, editar precio inline).

3. **Horarios** — agrupado por día de la semana (Domingo…Sábado); cada

   bloque muestra rango horario, ubicación, duración de cita. Modal

   crear/editar (día, desde/hasta, duración de cita, descanso, ubicación,

   activo) + botón "Replicar a otros días" (sub-modal: checkboxes de día +

   opción "reemplazar existentes") + botón eliminar.

4. **Cupo** — selector de ubicación (si hay más de una), lista de horarios

   de los próximos 14 días con ocupación (`bookedCount/capacity`) y badge

   "Bloqueado" si inactivo. Modal: editar cupo/activo de uno existente, o

   crear uno manual (fecha, hora, duración, cupo, activo) — eliminar solo si

   `bookedCount === 0`.

5. **Configuración** — 3 tarjetas, cada una abre su modal:

   - **Asistente de IA**: activo, nombre, tono, mensaje de bienvenida +

     switch "enviar en el primer mensaje", mensaje de respaldo, switch

     formato WhatsApp, switch "permitir takeover humano".

   - **Marca**: tema (claro/oscuro/auto), color primario/secundario (color

     picker + hex), tipografía (lista fija), tamaño de texto (chico/normal/

     grande), URL del logo (con preview) — el backend no aloja archivos.

   - **Política de cancelación**: switch "cliente puede cancelar", plazo

     mínimo en horas (si aplica), switch "penalización", texto de

     penalización (si aplica).

## 3. Endpoints de la API consumidos

Base: `VITE_API_URL` (`.env`). Todas las rutas van con header

`Authorization: Bearer <jwt>` excepto `/auth/login`. Nest devuelve `200` con

**cuerpo vacío** (no `"null"`) cuando el controller retorna `null`/`undefined`

— el cliente HTTP debe tolerarlo (leer texto, parsear solo si no está vacío).

### Auth

| Método | URL | Body | Respuesta |

|---|---|---|---|

| POST | `/auth/login` | `{ email, password }` | `{ access_token, user: {id, fullName, email, role, organizationId} }` |

### Citas (Appointments)

| Método | URL | Body / Query | Respuesta |

|---|---|---|---|

| GET | `/appointments?organizationId=&status=PENDING,CONFIRMED&from=&to=` | — (query) | `Appointment[]` |

| POST | `/appointments?raiseCapacityIfFull=true` (query opcional) | `{ organizationId, clientName, clientPhone, age?, locationId, serviceId, startAt, endAt }` | `Appointment` (o `409` con `{ slotFull: {capacity, bookedCount, suggestedCapacity} }` si el horario está lleno y no se manda el flag) |

| PATCH | `/appointments/:id/cancel?by=PROFESSIONAL` | `{ reason? }` | `Appointment` |

| PATCH | `/appointments/:id/reschedule?by=PROFESSIONAL` | `{ startAt, endAt }` | `Appointment` |

### Horarios/cupo (AppointmentSlots)

| Método | URL | Body / Query | Respuesta |

|---|---|---|---|

| GET | `/appointment-slots?organizationId=&locationId=&from=&to=` | — | `AppointmentSlot[]` |

| POST | `/appointment-slots` | `{ organizationId, locationId, startAt, endAt, capacity?, isActive? }` | `AppointmentSlot` |

| PATCH | `/appointment-slots/:id` | `{ capacity?, isActive? }` | `AppointmentSlot` |

| DELETE | `/appointment-slots/:id` | — | vacío |

### Horarios de atención (BusinessHours)

| Método | URL | Body / Query | Respuesta |

|---|---|---|---|

| GET | `/business-hours?organizationId=` | — | `BusinessHour[]` |

| POST | `/business-hours` | `{ organizationId, dayOfWeek, startTime, endTime, appointmentDuration, breakDuration, locationId?, isActive? }` | `BusinessHour` |

| PATCH | `/business-hours/:id` | subset parcial del anterior (sin `organizationId`) | `BusinessHour` |

| DELETE | `/business-hours/:id` | — | vacío |

| POST | `/business-hours/replicate` | `{ sourceId, days: number[], replace? }` | `BusinessHour[]` |

### Eventos/talleres (Events)

| Método | URL | Body / Query | Respuesta |

|---|---|---|---|

| GET | `/events?organizationId=&from=` | — | `Event[]` |

| POST | `/events` | `{ organizationId, name, startAt, endAt, capacity, description?, locationId?, venueName?, venueAddress?, mapsLink?, requirements?, notes?, isActive? }` | `Event` |

| PATCH | `/events/:id` | subset parcial (sin `organizationId`) | `Event` |

| DELETE | `/events/:id` | — | vacío |

### Inscripciones a eventos (EventRegistrations)

| Método | URL | Body | Respuesta |

|---|---|---|---|

| GET | `/events/:eventId/registrations` | — | `EventRegistration[]` |

| POST | `/events/:eventId/registrations` | `{ clientName, clientPhone, notes? }` | `EventRegistration` |

| PATCH | `/events/:eventId/registrations/:regId/cancel` | — | `EventRegistration` |

### Ubicaciones (Locations)

| Método | URL | Body | Respuesta |

|---|---|---|---|

| GET | `/locations?organizationId=` | — | `Location[]` |

| POST | `/locations` | `{ organizationId, name, address?, phone?, email?, isActive? }` | `Location` |

| PATCH | `/locations/:id` | subset parcial | `Location` |

### Servicios (Services) y precio por ubicación

| Método | URL | Body | Respuesta |

|---|---|---|---|

| GET | `/services?organizationId=` | — | `Service[]` (incluye `serviceLocations[]`) |

| POST | `/services` | `{ organizationId, name, description?, durationMinutes, requiredAttendees?, isActive? }` | `Service` |

| PATCH | `/services/:id` | subset parcial | `Service` |

| POST | `/service-locations` | `{ serviceId, locationId, price }` | `ServiceLocation` |

| PATCH | `/service-locations/:id` | `{ price?, isAvailable? }` | `ServiceLocation` |

| GET | `/service-locations/by-service/:serviceId` | — | `ServiceLocation[]` |

### Contexto de la organización (para selects de Ubicación/Servicio en "Nueva cita")

| Método | URL | Respuesta |

|---|---|---|

| GET | `/organizations/:id/context` | `{ locations: Location[], services: Service[] }` |

### Organización (branding + política de cancelación)

| Método | URL | Body | Respuesta |

|---|---|---|---|

| GET | `/organizations/:id` | — | `Organization` |

| PATCH | `/organizations/:id/branding` | `{ theme?, logoUrl?, primaryColor?, secondaryColor?, fontFamily?, fontScale? }` | `Organization` |

| PATCH | `/organizations/:id` | `{ allowClientCancellation?, cancellationDeadlineHours?, hasCancellationPenalty?, cancellationPenaltyText? }` | `Organization` |

### Configuración de IA (AISettings)

| Método | URL | Body | Respuesta |

|---|---|---|---|

| GET | `/ai-settings/organization/:organizationId` | — | `AISettings \| null` (puede venir vacío si no existe fila) |

| PATCH | `/ai-settings/organization/:organizationId` (upsert) | subset de `AISettings` (sin `id`) | `AISettings` |

### Reportes

| Método | URL | Respuesta |

|---|---|---|

| GET | `/organizations/:id/reports?from=&to=` | `Report` (ver tipo abajo) |

## 4. Tipos TypeScript (`frontend/src/types/index.ts`)

```ts

export type UserRole = 'SUPER_ADMIN' | 'PROFESSIONAL' | 'ASSISTANT';

export interface AuthUser {

  id: string;

  fullName: string;

  email: string;

  role: UserRole;

  organizationId: string;

}

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export interface Appointment {

  id: string;

  clientName: string;

  clientPhone: string;

  age: number | null;

  notes: string | null;

  status: AppointmentStatus;

  startAt: string; // ISO

  endAt: string; // ISO

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

  dayOfWeek: number; // 0=domingo ... 6=sábado

  startTime: string; // "HH:MM"

  endTime: string;

  appointmentDuration: number;

  breakDuration: number;

  isActive: boolean;

  organizationId: string;

  locationId: string | null;

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

export type EventRegistrationStatus = 'CONFIRMED' | 'CANCELLED';

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

  theme: 'light' | 'dark' | 'auto';

  logoUrl: string | null;

  primaryColor: string | null;

  secondaryColor: string | null;

  fontFamily: string | null;

  fontScale: 'sm' | 'md' | 'lg';

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

5. Acciones por pantalla (botones y modales)

Login

- Botón "Entrar" (submit) → POST /auth/login; éxito guarda JWT +

  usuario en localStorage y navega a /; error muestra banner rojo con

  el mensaje del backend.

AppShell (global, en todas las pantallas autenticadas)

- 4 links de navegación (Hoy / Eventos / Reportes / Negocio) — resaltan el

  activo según la ruta.

- Botón "Salir" → limpia localStorage (token + usuario) y vuelve al

  login.

Hoy

- ‹ / › → cambia el día mostrado (recalcula from/to del día,

  refetch de citas).

- Botón "Hoy" (solo visible si no estás viendo el día actual) → vuelve

  a hoy.

- Tap en una tarjeta de cita → abre AppointmentDetailModal (vista

  "detail"): muestra cliente, teléfono, edad, servicio, ubicación,

  fecha/hora, notas.

  - Botón "Reagendar" (solo si estado PENDING/CONFIRMED) → sub-vista

    con inputs fecha/hora → "Confirmar nueva fecha" → PATCH /appointments/:id/reschedule?by=PROFESSIONAL (mantiene duración y

    ubicación originales).

  - Botón "Cancelar cita" (solo si PENDING/CONFIRMED) → sub-vista con

    textarea de motivo opcional → "Confirmar cancelación" → PATCH /appointments/:id/cancel?by=PROFESSIONAL.

- Botón flotante "+" → abre NewAppointmentModal: form (cliente,

  teléfono, edad opcional, ubicación*, servicio*, fecha*, hora*) →

  "Agendar cita" → POST /appointments.

  - Si el backend responde 409 con slotFull → cambia a vista de aviso

    ("ya tiene N/M citas") con botones "Volver" / "Agendar de todos

    modos" (reintenta con raiseCapacityIfFull=true).

Eventos

- Tap en tarjeta de evento → abre modal de edición (mismo modal que

  "nuevo", precargado).

- Botón "Nuevo taller o evento" → modal vacío: form completo (nombre,

  descripción, fecha/hora, duración, cupo, ubicación del negocio o

  lugar externo (nombre+dirección), requisitos, [si edita] switch

  activo) → "Guardar" → POST o PATCH /events.

  - Botón "Eliminar" (solo si edita) → DELETE /events/:id.

  - Dentro del modal, sección "Inscritos": lista de inscritos activos

    con botón "Cancelar" por fila (→ PATCH /events/:id/registrations/:regId/cancel); mini-form nombre+teléfono +

    botón "+" (agregar) → POST /events/:id/registrations.

Reportes

- 3 botones de preset (7/30/90 días) → cambian el rango y refetch del

  reporte. Sin más interacción — pantalla solo de lectura.

Negocio → Ubicaciones

- Tap en tarjeta → modal editar; botón "Nueva ubicación" → modal vacío.

  Form: nombre*, dirección, teléfono, correo, [si edita] switch activa →

  "Guardar" → POST/PATCH /locations.

Negocio → Servicios

- Tap en tarjeta → modal editar; botón "Nuevo servicio" → modal vacío.

  Form: nombre*, descripción, duración*, personas requeridas, [si edita]

  switch activo → "Guardar" → POST/PATCH /services.

  - Dentro del modal (solo al editar), sección "Precio por ubicación":

    lista de ubicaciones ya vinculadas con input de precio inline (onBlur

    → PATCH /service-locations/:id); selector de ubicación no vinculada +

    precio + botón "+" → POST /service-locations.

Negocio → Horarios

- Agrupado por día. Tap en bloque → modal editar; botón "Nuevo bloque de

  horario" → modal vacío. Form: día*, desde*/hasta*, duración de cita*,

  descanso*, ubicación (o "todas"), [si edita] switch activo →

  "Guardar" → POST/PATCH /business-hours.

  - (Solo al editar) botón "Replicar a otros días" → sub-modal:

    checkboxes de días destino + switch "reemplazar existentes" →

    "Replicar" → POST /business-hours/replicate.

  - (Solo al editar) botón eliminar (ícono papelera) → DELETE /business-hours/:id.

Negocio → Cupo

- Selector de ubicación (si hay más de una). Tap en horario → modal editar

  (solo cupo + activo); botón "Nuevo horario manual" → modal con

  fecha/hora/duración/cupo/activo → "Guardar" → POST/PATCH /appointment-slots.

  - Switch "Disponible para agendar" (desmarcar = bloquear el horario

    sin borrarlo).

  - Botón "Eliminar horario" (solo visible si bookedCount === 0) →

    DELETE /appointment-slots/:id.

Negocio → Configuración

- Tarjeta "Asistente de IA" → modal: switch activo, nombre, tono,

  mensaje de bienvenida + switch "enviar en primer mensaje", mensaje de

  respaldo, switch formato WhatsApp, switch takeover humano →

  "Guardar" → PATCH /ai-settings/organization/:id (upsert).

- Tarjeta "Marca" → modal: tema (select), color primario/secundario

  (color picker + hex), tipografía (select de lista fija), tamaño de texto

  (select), URL de logo (con preview en vivo) → "Guardar" → PATCH /organizations/:id/branding.

- Tarjeta "Política de cancelación" → modal: switch "cliente puede

  cancelar" (revela plazo en horas si está activo), switch "aplica

  penalización" (revela textarea si está activo) → "Guardar" → PATCH /organizations/:id.

6. Notas de implementación a replicar

- Normalización de auth: el email se manda siempre en minúsculas y sin

  espacios (.toLowerCase().trim()), tanto en el cliente como en el

  backend, para evitar fallos de login por mayúsculas del teclado móvil.

- from/to en queries de fecha: siempre calculados con useMemo

  (nunca new Date() suelto en el cuerpo del componente) — si no, la

  queryKey cambia en cada render y provoca loop infinito de refetch.

- Botones de solo-ícono siempre llevan aria-label (ej. "Nueva cita",

  "Agregar inscrito", "Agregar precio", "Día anterior/siguiente").

- Cliente HTTP debe tolerar 200 con cuerpo vacío como null (no

  llamar res.json() a ciegas).

Ese bloque de arriba es el spec completo — cúbrelo tal cual en Lovable como contexto/system prompt inicial del proyecto. Si quieres, también puedo publicarlo como Artifact para que lo tengas como link en vez de tener que copiarlo del chat — dime si te sirve más así.

✻ Baked for 2m 0s · done 22:40

──────────────────────────────────────────────────────────────────────────────────────────────

❯

──────────────────────────────────────────────────────────────────────────────────────────────

  ⏵⏵ auto mode on (shift+tab to cycle) · ← for agents

---

INSTRUCCIONES PARA LOVABLE:

1. Comienza instalando las dependencias base (Tailwind, Lucide, React Router, date-fns).

2. Configura el sistema de temas (Dark/Light mode) en Tailwind y los colores principales (Emerald/Gold).

3. Construye el componente `AppShell` que maneje el Layout responsive (Sidebar en desktop, Bottom Bar en mobile) y el selector de tema.

4. Crea la pantalla de Login (`/login`) asegurando que el email se envíe siempre `.toLowerCase().trim()`.

5. Implementa el enrutador con las 5 secciones principales (`/`, `/eventos`, `/reportes`, `/negocio`).

"Te adjunto el isotipo dorado de la marca. Usa esta imagen estrictamente como el símbolo visual (para el favicon y para acompañar la cabecera). Para el nombre de la app, NO uses la imagen: escribe 'Mi Agenda Zen' utilizando tipografía nativa (texto renderizado por código, fuente clara y en negrita) posicionado a la derecha de este icono. Esto asegurará que el nombre siempre mantenga resolución perfecta y contraste ideal tanto en modo claro como en modo oscuro."

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://zen-calendar-pro.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/649f4b6f-21f7-4f97-b5ae-917efc3057fd).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
