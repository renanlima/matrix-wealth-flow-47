import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface Props {
  requireRole?: "admin" | "client";
  children: React.ReactNode;
}

export function AuthGate({ requireRole, children }: Props) {
  const navigate = useNavigate();
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (!profile) return;
    if (requireRole && profile.role !== requireRole) {
      navigate({ to: profile.role === "admin" ? "/admin" : "/app", replace: true });
    }
  }, [session, profile, loading, requireRole, navigate]);

  // Render children imediatamente se já temos session + profile na memória —
  // evita o "flash de spinner" ao navegar entre abas do menu.
  if (session && profile && (!requireRole || profile.role === requireRole)) {
    return <>{children}</>;
  }

  if (loading || (session && !profile)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return null;
}
