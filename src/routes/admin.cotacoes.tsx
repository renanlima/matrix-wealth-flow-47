import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, Loader2 } from "lucide-react";
import { Money, Pct } from "@/components/Money";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/cotacoes")({
  component: PricesAdmin,
});

interface Price {
  symbol: string;
  name: string | null;
  price_usd: number;
  percent_change_24h: number | null;
  updated_at: string;
}

function PricesAdmin() {
  const [loadingCoins, setLoadingCoins] = useState(false);
  const [loadingFx, setLoadingFx] = useState(false);
  const [loadingFi, setLoadingFi] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["admin", "prices"],
    queryFn: async () => {
      const [{ data: p }, { data: fx }] = await Promise.all([
        supabase.from("coin_prices").select("*").order("symbol"),
        supabase.from("fx_rates").select("rate, updated_at").eq("pair", "USD/BRL").maybeSingle(),
      ]);
      return {
        prices: (p as Price[]) ?? [],
        fxRate: fx ? { rate: Number(fx.rate), updated_at: fx.updated_at } : null,
      };
    },
  });
  const prices = data?.prices ?? [];
  const fxRate = data?.fxRate ?? null;
  const load = () => {
    refetch();
  };

  const refreshCoins = async () => {
    setLoadingCoins(true);
    const { error } = await supabase.functions.invoke("update-coin-prices");
    setLoadingCoins(false);
    if (error) toast.error("Cripto: " + error.message);
    else toast.success("Cotações de cripto atualizadas");
    load();
  };
  const refreshFx = async () => {
    setLoadingFx(true);
    const { error } = await supabase.functions.invoke("update-fx-rates");
    setLoadingFx(false);
    if (error) toast.error("Câmbio: " + error.message);
    else toast.success("Câmbio atualizado");
    load();
  };
  const refreshFi = async () => {
    setLoadingFi(true);
    const { error } = await supabase.functions.invoke("update-fixed-income-prices");
    setLoadingFi(false);
    if (error) toast.error("Rend. fixos: " + error.message);
    else toast.success("Rendimentos alternativos atualizados");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Cotações</h1>
          <p className="text-sm text-muted-foreground">
            Cache de preços e câmbio · Atualização automática diária às 10:00 UTC.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={refreshCoins} disabled={loadingCoins} size="sm" variant="outline">
            {loadingCoins ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Cripto
          </Button>
          <Button onClick={refreshFx} disabled={loadingFx} size="sm" variant="outline">
            {loadingFx ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Câmbio USD/BRL
          </Button>
          <Button onClick={refreshFi} disabled={loadingFi} size="sm" className="glow-cyan">
            {loadingFi ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Rend. Alternativos
          </Button>
        </div>
      </div>

      <Card className="border-primary/20">
        <CardHeader><CardTitle className="text-base">Câmbio USD/BRL</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-mono text-primary text-glow">
              {fxRate ? `R$ ${fxRate.rate.toFixed(4)}` : "—"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {fxRate ? formatDateTime(fxRate.updated_at) : "Sem dados"}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Preços de criptomoedas</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticker</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Preço (USD)</TableHead>
                <TableHead className="text-right">24h</TableHead>
                <TableHead>Atualizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    Sem cotações em cache. Cadastre posições e atualize.
                  </TableCell>
                </TableRow>
              )}
              {prices.map((p) => (
                <TableRow key={p.symbol}>
                  <TableCell className="font-mono font-semibold">{p.symbol}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.name ?? "—"}</TableCell>
                  <TableCell className="text-right"><Money usd={p.price_usd} /></TableCell>
                  <TableCell className="text-right"><Pct value={p.percent_change_24h} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(p.updated_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
