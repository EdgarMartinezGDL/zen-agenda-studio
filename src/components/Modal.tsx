import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

const SIZE_CLS: Record<"md" | "lg" | "xl", string> = {
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-3xl",
};

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Se mantiene por compatibilidad: todos los diálogos ya son centrados. */
  centered?: boolean;
  size?: "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex max-w-[100vw] items-center justify-center overflow-x-hidden overscroll-x-none bg-foreground/50 p-3 backdrop-blur-sm sm:p-6">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        className={`card-zen relative z-10 box-border max-h-[90vh] w-full max-w-[100vw] touch-pan-y overflow-x-hidden overflow-y-auto overscroll-x-none break-words rounded-[var(--radius-lg)] p-6 sm:p-8 ${SIZE_CLS[size]}`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className={`${size === "md" ? "text-xl" : "text-2xl"} font-bold leading-tight`}>
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
