import { createFileRoute, redirect } from "@tanstack/react-router";

// Facturación oculta en la V1 (cobro manual); la ruta redirige a /negocio.
export const Route = createFileRoute("/billing")({
  beforeLoad: () => {
    throw redirect({ to: "/negocio" });
  },
  component: () => null,
});
