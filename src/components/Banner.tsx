export function Banner({ kind, message }: { kind: "success" | "error"; message: string }) {
  return (
    <div
      role="status"
      className={
        kind === "error"
          ? "mb-4 rounded-md bg-status-cancelled-bg px-3 py-2 text-sm font-medium text-status-cancelled"
          : "mb-4 rounded-md bg-status-confirmed-bg px-3 py-2 text-sm font-medium text-status-confirmed"
      }
    >
      {message}
    </div>
  );
}
