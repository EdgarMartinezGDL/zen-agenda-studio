import isotipo from "@/assets/isotipo.png.asset.json";

/** Sello institucional de la plataforma (secundario, discreto). */
export function PlatformSeal({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2 opacity-90">
      <img
        src={isotipo.url}
        alt="Mi Agenda Zen"
        className={`${compact ? "h-6 w-6" : "h-7 w-7"} shrink-0 object-contain`}
        width={56}
        height={56}
      />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[11px] font-semibold tracking-tight text-foreground">
          Mi Agenda Zen
        </p>
        <p className="truncate text-[10px] font-medium tracking-wide text-muted-foreground">
          By MicroFix Cloud
        </p>
      </div>
    </div>
  );
}

/** Línea institucional en una sola línea (pies de página públicos). */
export function PlatformFooter() {
  return (
    <div className="flex items-center justify-center gap-2 py-6">
      <img src={isotipo.url} alt="" aria-hidden className="h-5 w-5 object-contain" />
      <p className="text-xs font-medium text-muted-foreground">
        Mi Agenda Zen · By MicroFix Cloud
      </p>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** Marca del profesional: protagonista en cabeceras. */
export function BusinessBrand({
  name,
  logoUrl,
  size = "md",
  center = false,
  nameSize,
}: {
  name: string;
  logoUrl?: string | null | undefined;
  size?: "md" | "lg";
  center?: boolean;
  /** Fuerza el tamaño del nombre; si se omite se ajusta según su longitud. */
  nameSize?: "sm" | "md" | "lg" | null;
}) {
  const logoH = size === "lg" ? "h-16" : "h-12 md:h-14";
  const len = name.trim().length;
  const auto: "sm" | "md" | "lg" = len > 28 ? "sm" : len > 16 ? "md" : "lg";
  const chosen = nameSize ?? auto;
  const titleCls =
    size === "lg"
      ? "text-xl md:text-2xl"
      : chosen === "sm"
        ? "text-sm md:text-base"
        : chosen === "lg"
          ? "text-lg md:text-xl"
          : "text-base md:text-lg";
  const short = len <= 16;

  return (
    <div
      className={`flex min-w-0 items-center gap-3 ${center ? "flex-col justify-center text-center" : ""}`}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={name}
          className={`${logoH} my-0.5 w-auto shrink-0 object-contain`}
        />
      ) : (
        <div
          aria-hidden
          className={`${size === "lg" ? "h-16 w-16 text-lg" : "my-0.5 h-12 w-12 text-base md:h-14 md:w-14"} flex shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/15 font-bold tracking-wide text-gold`}
        >
          {initials(name || "MZ")}
        </div>
      )}
      <p
        className={`${titleCls} min-w-0 font-bold leading-tight tracking-tight text-foreground ${
          short ? "truncate" : "line-clamp-2 break-words"
        }`}
      >
        {name}
      </p>
    </div>
  );
}

/** Compatibilidad: marca de plataforma completa. */
export function Brand({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const icon = size === "lg" ? "h-14 w-14" : size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const title = size === "lg" ? "text-2xl" : "text-base";

  return (
    <div className="flex min-w-0 items-center gap-3">
      <img
        src={isotipo.url}
        alt="Mi Agenda Zen"
        className={`${icon} shrink-0 object-contain`}
        width={56}
        height={56}
      />
      <div className="min-w-0 leading-tight">
        <p className={`${title} truncate font-bold tracking-tight text-foreground`}>
          Mi Agenda Zen
        </p>
        <p className="truncate text-[11px] font-medium tracking-wide text-muted-foreground">
          By MicroFix Cloud
        </p>
      </div>
    </div>
  );
}
