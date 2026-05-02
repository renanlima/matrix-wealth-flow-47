import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Money, CryptoQty, Pct } from "@/components/Money";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Meus fundos</h1>
        <p className="text-sm text-muted-foreground">Posições e rentabilidade por fundo.</p>
      </div>

      {funds.length === 0 && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Você ainda não tem fundos cadastrados.</CardContent></Card>
      )}

      {funds.map((f) => {
        const fundHoldings = holdings.filter((h) => h.fund_id === f.id);
        const totalCost = fundHoldings.reduce((s, h) => s + Number(h.quantity) * Number(h.entry_price_usd), 0);
        const totalMarket = fundHoldings.filter((h) => h.status === "ativa").reduce((s, h) => {
          const cur = prices.get(h.coin_symbol.toUpperCase()) ?? 0;
          return s + Number(h.quantity) * cur;
        }, 0);
        const activeCost = fundHoldings.filter((h) => h.status === "ativa").reduce((s, h) => s + Number(h.quantity) * Number(h.entry_price_usd), 0);
        const pnlPct = activeCost > 0 ? ((totalMarket - activeCost) / activeCost) * 100 : 0;

        return (
          <Card key={f.id} className="border-primary/10">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">{f.name}</CardTitle>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-muted-foreground">Início {formatDate(f.start_date)}</span>
                  <span className={f.status === "ativo" ? "text-success" : "text-muted-foreground"}>
                    {f.status}
                  </span>
                  <Pct value={pnlPct} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Moeda</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Preço médio</TableHead>
                    <TableHead className="text-right">Preço atual</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fundHoldings.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">Sem posições.</TableCell></TableRow>
                  )}
                  {fundHoldings.map((h) => {
                    const cur = prices.get(h.coin_symbol.toUpperCase()) ?? 0;
                    const cost = Number(h.quantity) * Number(h.entry_price_usd);
                    const market = Number(h.quantity) * cur;
                    const pnlH = cost > 0 ? ((market - cost) / cost) * 100 : 0;
                    return (
                      <TableRow key={h.id}>
                        <TableCell className="font-mono font-semibold">{h.coin_symbol}</TableCell>
                        <TableCell className="text-right"><CryptoQty qty={h.quantity} /></TableCell>
                        <TableCell className="text-right"><Money usd={h.entry_price_usd} /></TableCell>
                        <TableCell className="text-right">{cur > 0 ? <Money usd={cur} /> : "—"}</TableCell>
                        <TableCell className="text-right">
                          {h.status === "ativa" && cur > 0 ? <Pct value={pnlH} /> : <span className="text-xs text-muted-foreground">{h.status}</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
