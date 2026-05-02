import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // Always redirect to login; AuthGate will route to admin/app based on role
    throw redirect({ to: "/login" });
  },
});
