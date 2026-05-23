import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { ExtratoFundo } from "@/components/extrato/ExtratoFundo";

export const Route = createFileRoute("/admin/clientes/$clientId/fundos/$fundId_/extrato")({
  component: AdminExtrato,
});

function AdminExtrato() {
  const { clientId, fundId } = useParams({ from: "/admin/clientes/$clientId/fundos/$fundId/extrato" });
  const [fundName, setFundName] = useState<string>("");
  const [clientName, setClientName] = useState<string>("");

  useEffect(() => {
    (async () => {
      const [{ data: f }, { data: c }] = await Promise.all([
        supabase.from("funds").select("name").eq("id", fundId).maybeSingle(),
        supabase.from("profiles").select("full_name").eq("id", clientId).maybeSingle(),
      ]);
      setFundName(f?.name ?? "—");
      setClientName(c?.full_name ?? "");
    })();
  }, [fundId, clientId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/admin/clientes/$clientId/fundos/$fundId" params={{ clientId, fundId }}>
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar ao fundo
          </Button>
        </Link>
      </div>
      <ExtratoFundo fundId={fundId} fundName={fundName} clientName={clientName} />
    </div>
  );
}
