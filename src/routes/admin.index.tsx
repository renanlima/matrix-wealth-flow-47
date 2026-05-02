import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/Money";
import { Users, Wallet, Activity, RefreshCw } from "lucide-react";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

interface Stats {
  clientCount: number;
  aumUsd: number;
  activeHoldings: number;
  lastPriceUpdate: string | null;
}

async function fetchAdminStats(): Promise<Stats> {
  const [{ count: clientCount }, { data: holdings }, { data: prices }, { data: cash }, { data: w }] =
    await Promise.all([
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase.from("holdings").select("coin_symbol, quantity").eq("status", "ativa"),
      supabase.from("coin_prices").select("symbol, price_usd, updated_at"),
      supabase.from("deposits").select("amount_usd"),
      supabase.from("withdrawals").select("amount_usd"),
    ]);

  const priceMap = new Map(prices?.map((p) => [p.symbol.toUpperCase(), Number(p.price_usd)]));
  const aumHoldings =
    holdings?.reduce(
      (sum, h) =>
        sum + Number(h.quantity) * (priceMap.get(h.coin_symbol.toUpperCase()) ?? 0),
      0,
    ) ?? 0;

  const cashUsd = cash?.reduce((s, d) => s + Number(d.amount_usd), 0) ?? 0;
  const wUsd = w?.reduce((s, d) => s + Number(d.amount_usd), 0) ?? 0;

  const lastUpdate =
    prices?.reduce(
      (latest, p) => (!latest || p.updated_at > latest ? p.updated_at : latest),
      null as string | null,
    ) ?? null;

  return {
    clientCount: clientCount ?? 0,
    aumUsd: aumHoldings + cashUsd - wUsd,
    activeHoldings: holdings?.length ?? 0,
    lastPriceUpdate: lastUpdate,
  };
}

function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: fetchAdminStats,
    placeholderData: { clientCount: 0, aumUsd: 0, activeHoldings: 0, lastPriceUpdate: null },
  });
  const s = stats ?? { clientCount: 0, aumUsd: 0, activeHoldings: 0, lastPriceUpdate: null };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão consolidada da gestora.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Wallet}
          label="AUM total"
          value={<Money usd={stats.aumUsd} className="text-xl text-glow text-primary" />}
        />
        <StatCard
          icon={Users}
          label="Clientes ativos"
          value={<span className="text-xl font-mono">{stats.clientCount}</span>}
        />
        <StatCard
          icon={Activity}
          label="Posições ativas"
          value={<span className="text-xl font-mono">{stats.activeHoldings}</span>}
        />
        <StatCard
          icon={RefreshCw}
          label="Último preço"
          value={
            <span className="text-sm font-mono text-muted-foreground">
              {formatDateTime(stats.lastPriceUpdate)}
            </span>
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Atalhos</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• Use o menu lateral para navegar entre Clientes, Mural e Cotações.</p>
          <p>• Em "Cotações" você pode forçar uma atualização imediata dos preços.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card className="border-primary/10">
      <CardContent className="p-5 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            {label}
          </div>
          {value}
        </div>
        <div className="rounded-md p-2 bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}
