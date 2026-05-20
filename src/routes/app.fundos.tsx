import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Money, Pct } from "@/components/Money";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ClientHoldingsTable } from "@/components/client/ClientHoldingsTable";

export const Route = createFileRoute("/app/fundos")({
  component: ClientFunds,
});

async function fetchClientFunds(userId: string) {
  const [{ data: f }, { data: p }] = await Promise.all([
    supabase.from("funds").select("*").eq("client_id", userId).order("created_at", { ascending: false }),
    supabase.from("coin_prices").select("symbol, price_usd"),
  ]);
  const funds = f ?? [];
  const prices = new Map((p ?? []).map((x) => [x.symbol.toUpperCase(), Number(x.price_usd)]));
  const ids = funds.map((x) => x.id);
  let holdings: any[] = [];
  if (ids.length) {
    const { data: h } = await supabase.from("holdings").select("*").in("fund_id", ids);
    holdings = h ?? [];
  }
  return { funds, holdings, prices };
}

function ClientFunds() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["client", "funds", user?.id],
    queryFn: () => fetchClientFunds(user!.id),
    enabled: !!user,
  });
  const funds = data?.funds ?? [];
  const holdings = data?.holdings ?? [];
  const prices = data?.prices ?? new Map<string, number>();
  const [showClosed, setShowClosed] = useState(false);

  // Aggregate totals across all active positions
  const totals = useMemo(() => {
    const active = holdings.filter((h) => h.status === "ativa");
    const cost = active.reduce((s, h) => s + Number(h.quantity) * Number(h.entry_price_usd), 0);
    const market = active.reduce((s, h) => {
      const cur = prices.get(h.coin_symbol.toUpperCase()) ?? Number(h.entry_price_usd);
      return s + Number(h.quantity) * cur;
    }, 0);
    return { cost, market, pnl: market - cost, pct: cost > 0 ? ((market - cost) / cost) * 100 : 0 };
  }, [holdings, prices]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Meus fundos</h1>
          <p className="text-sm text-muted-foreground">Posições e rentabilidade por fundo.</p>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="show-closed" checked={showClosed} onCheckedChange={setShowClosed} />
          <Label htmlFor="show-closed" className="text-xs text-muted-foreground cursor-pointer">
            Mostrar encerradas
          </Label>
        </div>
      </div>

      {funds.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="Patrimônio (mercado)" value={<Money usd={totals.market} className="text-lg text-primary text-glow" />} />
          <SummaryCard label="Custo investido" value={<Money usd={totals.cost} className="text-lg" />} />
          <SummaryCard
            label="P&L não realizado"
            value={<Money usd={totals.pnl} className={cn("text-lg", totals.pnl >= 0 ? "text-success" : "text-destructive")} />}
          />
          <SummaryCard label="Variação" value={<Pct value={totals.pct} className="text-lg" />} />
        </div>
      )}

      {funds.length === 0 && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Você ainda não tem fundos cadastrados.</CardContent></Card>
      )}

      {funds.map((f) => {
        const allFundHoldings = holdings.filter((h) => h.fund_id === f.id);
        const fundHoldings = showClosed
          ? allFundHoldings
          : allFundHoldings.filter((h) => h.status === "ativa");
        const totalCost = fundHoldings.reduce((s, h) => s + Number(h.quantity) * Number(h.entry_price_usd), 0);
        const totalMarket = fundHoldings.filter((h) => h.status === "ativa").reduce((s, h) => {
          const cur = prices.get(h.coin_symbol.toUpperCase()) ?? Number(h.entry_price_usd);
          return s + Number(h.quantity) * cur;
        }, 0);
        const activeCost = fundHoldings.filter((h) => h.status === "ativa").reduce((s, h) => s + Number(h.quantity) * Number(h.entry_price_usd), 0);
        const pnlPct = activeCost > 0 ? ((totalMarket - activeCost) / activeCost) * 100 : 0;

        return (
          <Card key={f.id} className="border-primary/10">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">
                  <Link
                    to="/app/fundos_/$fundId"
                    params={{ fundId: f.id }}
                    className="hover:text-primary transition-colors"
                  >
                    {f.name}
                  </Link>
                </CardTitle>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-muted-foreground">Início {formatDate(f.start_date)}</span>
                  <span className={f.status === "ativo" ? "text-success" : "text-muted-foreground"}>
                    {f.status}
                  </span>
                  <Pct value={pnlPct} />
                  <Link to="/app/fundos_/$fundId/extrato" params={{ fundId: f.id }}>
                    <Button variant="ghost" size="sm" className="h-7 px-2">
                      <FileText className="h-3.5 w-3.5 mr-1" /> Extrato
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ClientHoldingsTable holdings={fundHoldings} prices={prices} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="border-primary/10">
      <CardContent className="p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
        {value}
      </CardContent>
    </Card>
  );
}
