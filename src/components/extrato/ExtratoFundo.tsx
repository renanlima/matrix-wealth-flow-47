import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money } from "@/components/Money";
import { Download, Info, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDate, formatUSD, pnlClass } from "@/lib/format";
import { generatePdfFromElement } from "@/lib/pdf";
import { buildExtratoEvents, type ExtratoEvent, type ExtratoEventType } from "@/lib/extrato";

const ALL_TYPES: ExtratoEventType[] = ["Compra", "Venda", "Rendimento", "Encerramento", "Taxa", "Aporte", "Retirada"];
const PAGE_SIZE = 100;

interface Props {
  fundId: string;
  fundName: string;
  clientName?: string;
}

export function ExtratoFundo({ fundId, fundName, clientName }: Props) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<ExtratoEvent[]>([]);
  const [cashFetchFailed, setCashFetchFailed] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<ExtratoEventType>>(new Set(ALL_TYPES));
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [generating, setGenerating] = useState(false);
  const snapshotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!fundId) { setLoading(false); setEvents([]); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: h }, { data: fi }, { data: ph }] = await Promise.all([
        supabase.from("holdings").select("*").eq("fund_id", fundId),
        supabase.from("fixed_income").select("*").eq("fund_id", fundId),
        supabase.from("performance_history").select("*").eq("fund_id", fundId),
      ]);
      const holdings = h ?? [];
      const ids = holdings.map((x: any) => x.id);
      let realizations: any[] = [];
      if (ids.length) {
        const { data: r } = await supabase.from("realizations").select("*").in("holding_id", ids);
        realizations = r ?? [];
      }

      // Aportes/Retiradas alocados a este fundo (pode falhar se RLS/coluna não estiver pronta)
      let deposits: any[] = [];
      let withdrawals: any[] = [];
      let cashFailed = false;
      try {
        const [{ data: d, error: de }, { data: w, error: we }] = await Promise.all([
          supabase.from("deposits").select("id, deposit_date, amount_usd, notes, fund_id").eq("fund_id", fundId),
          supabase.from("withdrawals").select("id, withdraw_date, amount_usd, notes, fund_id").eq("fund_id", fundId),
        ]);
        if (de || we) {
          cashFailed = true;
          console.error("Extrato: deposits/withdrawals query error", de ?? we);
        } else {
          deposits = d ?? [];
          withdrawals = w ?? [];
        }
      } catch (err) {
        cashFailed = true;
        console.error("Extrato: deposits/withdrawals fetch failed", err);
      }

      if (cancelled) return;
      const ev = buildExtratoEvents({
        holdings: holdings as any,
        realizations: realizations as any,
        fixedIncome: (fi ?? []) as any,
        fees: (ph ?? []) as any,
        deposits: deposits as any,
        withdrawals: withdrawals as any,
      });
      setEvents(ev);
      setCashFetchFailed(cashFailed);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [fundId]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return events.filter((e) => {
      if (!selectedTypes.has(e.type)) return false;
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo && e.date > dateTo) return false;
      if (s) {
        const hay = `${e.description} ${e.symbol ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [events, selectedTypes, dateFrom, dateTo, search]);

  const summary = useMemo(() => {
    let bought = 0, sold = 0, realizedPnl = 0, yields = 0, fees = 0, deposits = 0, withdrawals = 0;
    for (const e of filtered) {
      switch (e.type) {
        case "Compra": bought += -e.valueUsd; break;
        case "Venda":
          sold += e.valueUsd;
          if (typeof e.profit === "number") realizedPnl += e.profit;
          break;
        case "Rendimento": yields += -e.valueUsd; break;
        case "Encerramento": yields -= e.valueUsd; break; // saída de aplicação volta como crédito
        case "Taxa": fees += -e.valueUsd; break;
        case "Aporte": deposits += e.valueUsd; break;
        case "Retirada": withdrawals += -e.valueUsd; break;
      }
    }
    const net = sold - bought - fees + deposits - withdrawals;
    return { bought, sold, realizedPnl, yields, fees, deposits, withdrawals, net };
  }, [filtered]);

  const toggleType = (t: ExtratoEventType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  };

  const visible = filtered.slice(0, visibleCount);

  const handleExport = async () => {
    if (!snapshotRef.current) return;
    setGenerating(true);
    try {
      const fname = `Extrato_${fundName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
      await generatePdfFromElement(snapshotRef.current, fname);
      toast.success("PDF gerado");
    } catch (e: any) {
      toast.error("Falha ao gerar PDF: " + e.message);
    } finally { setGenerating(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Extrato — {fundName}</h1>
          <p className="text-sm text-muted-foreground">
            Livro-razão de todas as movimentações do fundo.
          </p>
        </div>
        <Button onClick={handleExport} disabled={generating || filtered.length === 0}>
          <Download className="h-4 w-4 mr-1" />
          {generating ? "Gerando..." : "Exportar PDF"}
        </Button>
      </div>

      {/* Cards-resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Total comprado" value={<Money usd={summary.bought} className="text-lg" />} />
        <SummaryCard
          label="Total vendido"
          value={<Money usd={summary.sold} className="text-lg" />}
          sub={
            <span className={cn("text-xs font-mono", pnlClass(summary.realizedPnl))}>
              {summary.realizedPnl >= 0 ? "+" : ""}{formatUSD(summary.realizedPnl)} realizado
            </span>
          }
        />
        <SummaryCard label="Rendimentos (saldo)" value={<Money usd={summary.yields} className="text-lg" />} />
        <SummaryCard
          label="Net do período"
          value={<Money usd={summary.net} className={cn("text-lg", pnlClass(summary.net))} />}
        />
      </div>

      {cashFetchFailed && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Não foi possível carregar aportes e retiradas deste fundo. O extrato está mostrando apenas compras, vendas, rendimentos e taxas.
          </AlertDescription>
        </Alert>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs uppercase text-muted-foreground">De</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase text-muted-foreground">Até</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase text-muted-foreground">Buscar</label>
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-7"
                  placeholder="símbolo ou descrição"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_TYPES.map((t) => {
              const active = selectedTypes.has(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border transition-colors",
                    active
                      ? "bg-primary/10 border-primary/30 text-foreground"
                      : "bg-transparent border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead className="text-right">Valor (USD)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhuma movimentação registrada neste fundo.
                </TableCell></TableRow>
              )}
              {visible.map((e) => <ExtratoRow key={e.id} ev={e} />)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filtered.length > visible.length && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
            Carregar mais ({filtered.length - visible.length} restantes)
          </Button>
        </div>
      )}

      {/* Snapshot escondido para PDF */}
      <div className="fixed -left-[10000px] top-0" aria-hidden>
        <div ref={snapshotRef} className="bg-background text-foreground p-8 w-[800px]">
          <div className="border-b border-border pb-3 mb-4">
            <h2 className="text-xl font-semibold">Extrato — {fundName}</h2>
            {clientName && <div className="text-sm text-muted-foreground">Cliente: {clientName}</div>}
            <div className="text-xs text-muted-foreground mt-1">
              {dateFrom || dateTo
                ? `Período: ${dateFrom || "início"} a ${dateTo || "hoje"}`
                : "Período: completo"} · Gerado em {new Date().toLocaleString("pt-BR")}
            </div>
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 pr-2">Data</th>
                <th className="text-left py-1.5 pr-2">Tipo</th>
                <th className="text-left py-1.5 pr-2">Descrição</th>
                <th className="text-right py-1.5 pr-2">Qtd</th>
                <th className="text-right py-1.5">Valor (USD)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-border/40">
                  <td className="py-1.5 pr-2 font-mono">{formatDate(e.date)}</td>
                  <td className="py-1.5 pr-2">{e.type}</td>
                  <td className="py-1.5 pr-2">{e.description}</td>
                  <td className="py-1.5 pr-2 text-right font-mono">
                    {e.quantity != null ? `${e.quantity} ${e.symbol ?? ""}` : ""}
                  </td>
                  <td className="py-1.5 text-right font-mono">
                    {e.valueUsd >= 0 ? "+" : ""}{formatUSD(e.valueUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ExtratoRow({ ev }: { ev: ExtratoEvent }) {
  return (
    <TableRow>
      <TableCell className="font-mono text-xs whitespace-nowrap">{formatDate(ev.date)}</TableCell>
      <TableCell><TypeBadge ev={ev} /></TableCell>
      <TableCell className="text-sm">{ev.description}</TableCell>
      <TableCell className="text-right font-mono text-xs">
        {ev.quantity != null ? (
          <span>{ev.quantity} <span className="text-muted-foreground">{ev.symbol}</span></span>
        ) : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className={cn(
        "text-right font-mono tabular-nums",
        ev.valueUsd >= 0 ? "text-success" : "text-destructive",
      )}>
        {ev.valueUsd >= 0 ? "+" : ""}{formatUSD(ev.valueUsd)}
      </TableCell>
    </TableRow>
  );
}

function TypeBadge({ ev }: { ev: ExtratoEvent }) {
  const cls = (() => {
    switch (ev.type) {
      case "Compra": return "text-orange-500";
      case "Venda": return (ev.profit ?? 0) >= 0 ? "text-success" : "text-destructive";
      case "Rendimento": return "text-success";
      case "Encerramento": return "text-muted-foreground";
      case "Taxa": return "text-destructive";
      case "Aporte": return "text-success";
      case "Retirada": return "text-orange-700";
    }
  })();
  return (
    <Badge variant={ev.type === "Encerramento" ? "secondary" : "outline"} className={cn("font-mono text-[10px]", cls)}>
      {ev.type}
    </Badge>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Card className="border-primary/10">
      <CardContent className="p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
        {value}
        {sub && <div className="mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
