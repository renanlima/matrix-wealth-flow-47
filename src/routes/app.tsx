import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import {
  LayoutDashboard,
  Briefcase,
  TrendingUp,
  LineChart,
  Megaphone,
  FileText,
  FileBarChart,
  UserCog,
} from "lucide-react";

export const Route = createFileRoute("/app")({
  component: ClientLayout,
});

function ClientLayout() {
  return (
    <AuthGate requireRole="client">
      <AppShell
        title="Área do Cliente"
        basePath="/app"
        navItems={[
          { to: "/app", label: "Dashboard", icon: LayoutDashboard },
          { to: "/app/fundos", label: "Fundos", icon: Briefcase },
          { to: "/app/rendimentos", label: "Rendimentos", icon: TrendingUp },
          { to: "/app/futuros", label: "Futuros", icon: LineChart },
          { to: "/app/mural", label: "Mural", icon: Megaphone },
          { to: "/app/documentos", label: "Documentos", icon: FileText },
          { to: "/app/relatorios", label: "Relatórios", icon: FileBarChart },
          { to: "/app/perfil", label: "Perfil", icon: UserCog },
        ]}
      >
        <Outlet />
      </AppShell>
    </AuthGate>
  );
}
