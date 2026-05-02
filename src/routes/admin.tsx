import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { LayoutDashboard, Users, Megaphone, Activity, Settings } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <AuthGate requireRole="admin">
      <AppShell
        title="Painel Admin"
        basePath="/admin"
        navItems={[
          { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
          { to: "/admin/clientes", label: "Clientes", icon: Users },
          { to: "/admin/mural", label: "Mural", icon: Megaphone },
          { to: "/admin/cotacoes", label: "Cotações", icon: Activity },
          { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
        ]}
      >
        <Outlet />
      </AppShell>
    </AuthGate>
  );
}
