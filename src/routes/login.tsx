import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import matrixLogo from "@/assets/matrix-logo.png";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, profile, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (session && profile) {
      navigate({ to: profile.role === "admin" ? "/admin" : "/app", replace: true });
    }
  }, [session, profile, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error("Falha no login", { description: error.message });
      return;
    }
    toast.success("Bem-vindo de volta");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="absolute inset-0 bg-grid-fade pointer-events-none" />
      <Card className="w-full max-w-md relative border-primary/20 bg-card/80 backdrop-blur">
        <CardHeader className="text-center">
          <img
            src={matrixLogo}
            alt="Matrix Digital Assets"
            className="mx-auto mb-3 h-20 w-auto object-contain"
          />
          <CardDescription>Acesse sua área restrita</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full glow-cyan" disabled={submitting}>
              {submitting ? "Entrando..." : "Entrar"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Esqueceu a senha? Entre em contato com o administrador.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
