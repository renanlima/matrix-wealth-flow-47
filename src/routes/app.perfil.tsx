import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/app/perfil")({
  component: ClientProfile,
});

function ClientProfile() {
  const { profile } = useAuth();
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 6) {
      toast.error("Senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (pwd !== pwd2) {
      toast.error("As senhas não coincidem");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha alterada");
    setPwd("");
    setPwd2("");
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-semibold">Perfil</h1>
        <p className="text-sm text-muted-foreground">Seus dados de acesso.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Informações</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">Nome:</span> {profile?.full_name ?? "—"}</div>
          <div><span className="text-muted-foreground">Email:</span> <span className="font-mono">{profile?.email}</span></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Trocar senha</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nova senha</Label>
              <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Confirmar nova senha</Label>
              <Input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} required />
            </div>
            <Button type="submit" disabled={submitting} className="glow-cyan">
              {submitting ? "Salvando..." : "Atualizar senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
