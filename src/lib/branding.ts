const FONT_STACKS: Record<string, string> = {
  Inter: '"Inter", ui-sans-serif, system-ui, sans-serif',
  "Plus Jakarta Sans": '"Plus Jakarta Sans", "Inter", ui-sans-serif, system-ui, sans-serif',
  Roboto: '"Roboto", ui-sans-serif, system-ui, sans-serif',
  Lato: '"Lato", ui-sans-serif, system-ui, sans-serif',
  Merriweather: '"Merriweather", Georgia, ui-serif, serif',
};

const SCALES: Record<string, string> = { sm: "15px", md: "16px", lg: "18px" };

const isHex = (v?: string | null) => !!v && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());

export interface BrandingValues {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  fontFamily?: string | null;
  fontScale?: string | null;
}

/** Inyecta los colores y tipografía de la marca como variables CSS globales. */
export function applyBranding(v: BrandingValues) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (isHex(v.primaryColor)) {
    const c = v.primaryColor!.trim();
    root.style.setProperty("--primary", c);
    root.style.setProperty("--ring", c);
    root.style.setProperty("--status-confirmed", c);
  } else {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--ring");
    root.style.removeProperty("--status-confirmed");
  }

  if (isHex(v.secondaryColor)) {
    const c = v.secondaryColor!.trim();
    root.style.setProperty("--gold", c);
    root.style.setProperty("--gold-soft", c);
  } else {
    root.style.removeProperty("--gold");
    root.style.removeProperty("--gold-soft");
  }

  const stack = v.fontFamily ? FONT_STACKS[v.fontFamily] : undefined;
  if (stack) {
    root.style.setProperty("--font-sans", stack);
    root.style.fontFamily = stack;
  } else {
    root.style.removeProperty("--font-sans");
    root.style.removeProperty("font-family");
  }

  const size = v.fontScale ? SCALES[v.fontScale] : undefined;
  if (size) root.style.fontSize = size;
  else root.style.removeProperty("font-size");
}

export const BRAND_FONTS = Object.keys(FONT_STACKS);
