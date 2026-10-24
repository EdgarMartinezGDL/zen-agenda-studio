import { Modal } from "@/components/Modal";

export function Confirm({
  open,
  title = "¿Confirmar eliminación?",
  message,
  confirmLabel = "Sí, eliminar",
  cancelLabel = "Cancelar",
  pending,
  large = false,
  tone = "danger",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  /** Diálogo centrado y de mayor escala. */
  large?: boolean;
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmCls = tone === "primary" ? "btn-primary" : "btn-3d btn-3d-danger";

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      centered={large}
      size={large ? "lg" : "md"}
    >
      <p className={`${large ? "text-lg leading-relaxed" : "text-sm"} text-muted-foreground`}>
        {message}
      </p>
      <div className={`${large ? "mt-8 gap-4" : "mt-5 gap-2"} flex flex-col sm:flex-row`}>
        <button
          onClick={onCancel}
          className={`btn-3d btn-3d-muted flex-1 ${
            large ? "px-5 py-3.5 text-lg" : "px-3 py-2 text-sm"
          }`}
        >
          {cancelLabel}
        </button>

        <button
          onClick={onConfirm}
          disabled={pending}
          className={`flex-1 ${confirmCls} ${large ? "px-5 py-3.5 text-lg" : "px-3 py-2 text-sm"} disabled:opacity-60`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
