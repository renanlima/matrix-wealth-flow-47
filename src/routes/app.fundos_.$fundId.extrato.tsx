import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import { ExtratoFundo } from "@/components/extrato/ExtratoFundo";

export const Route = createFileRoute("/app/fundos_/$fundId/extrato")({
  component: ClientExtrato,
});

function ClientExtrato() {
  const { fundId } = useParams({ from: "/app/fundos_/$fundId/extrato" });
  const { user } = useAuth();
  const [state, setState] = useState<{ name: string; allowed: boolean } | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("funds")
        .select("name, client_id")
        .eq("id", fundId)
        .maybeSingle();
      if (!data) { setState({ name: "—", allowed: false }); return; }
      setState({ name: data.name, allowed: data.client_id === user.id });
    })();
  }, [fundId, user]);

  if (!state) return null;

  if (!state.allowed) {
    return (
      <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
        Fundo não encontrado.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/app/fundos">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar aos fundos
          </Button>
        </Link>
      </div>
      <ExtratoFundo fundId={fundId} fundName={state.name} />
    </div>
  );
}
