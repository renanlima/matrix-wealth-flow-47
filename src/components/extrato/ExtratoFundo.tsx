import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money } from "@/components/Money";
import { ChevronDown, ChevronRight, Download, FileSpreadsheet, Info, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDate, formatUSD, monthNamesPT, pnlClass } from "@/lib/format";
import { generatePdfFromElement } from "@/lib/pdf";
import { buildExtratoEvents, type ExtratoEvent, type ExtratoEventType } from "@/lib/extrato";
import { useCurrency } from "@/contexts/CurrencyContext";

const ALL_TYPES: ExtratoEventType[] = [
  "Compra",
  "Venda",
  "Rendimento",
  "Encerramento",
  "Taxa",
  "Aporte",
  "Retirada",
  "Edição",
  "Início do fundo",
  "Encerramento do fundo",
];
const PAGE_SIZE = 100;

interface Props {
  fundId: string;
  fundName: string;
  clientName?: string;
}

export function ExtratoFundo({ fundId, fundName, clientName }: Props) {
  const { currency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<ExtratoEvent[]>([]);
  const [cashFetchFailed, setCashFetchFailed] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<ExtratoEventType>>(new Set(ALL_TYPES));
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [generating, setGenerating] = useState(false);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const snapshotRef = useRef<HTMLDivElement>(null);

  const toggleMonth = (m: string) => {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  };

  useEffect(() => {
    if (!fundId) { setLoading(false); setEvents([]); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: h }, { data: fi }, { data: ph }, { data: fundRow }] = await Promise.all([
        supabase.from("holdings").select("*").eq("fund_id", fundId),
        supabase.from("fixed_income").select("*").eq("fund_id", fundId),
        supabase.from("performance_history").select("*").eq("fund_id", fundId),
        supabase.from("funds").select("id, name, start_date, end_date, status").eq("id", fundId).maybeSingle(),
      ]);
      const holdings = h ?? [];
      const ids = holdings.map((x: any) => x.id);
      let realizations: any[] = [];
      if (ids.length) {
        const { data: r } = await supabase.from("realizations").select("*").in("holding_id", ids);
        realizations = r ?? [];
      }

      // audit_log: RLS só permite leitura para admin. Cliente recebe array vazio sem erro.
      let audit: any[] = [];
      if (ids.length) {
        const { data: au } = await supabase
          .from("audit_log")
          .select("id, action, entity_type, entity_id, actor_email, before, after, created_at")
          .eq("entity_type", "holdings")
          .in("entity_id", ids)
          .in("action", ["UPDATE", "DELETE"])
          .order("created_at", { ascending: false });
        audit = au ?? [];
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
        fund: fundRow as any,
        audit: audit as any,
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
    let bought = 0, sold = 0, realizedPnl = 0, yieldsFlow = 0, fees = 0, deposits = 0, withdrawals = 0;
    let net = 0;
    for (const e of filtered) {
      // valueUsd já está assinado (entrada positiva, saída negativa) — net é a soma direta.
      net += e.valueUsd;
      switch (e.type) {
        case "Compra": bought += -e.valueUsd; break;
        case "Venda":
          sold += e.valueUsd;
          if (typeof e.profit === "number") realizedPnl += e.profit;
          break;
        // Fluxo de aplicações = encerramentos (entrada) + aplicações (saída).
        // Positivo = recuperado mais do que aplicado no período. Negativo = ainda alocado.
        case "Rendimento": yieldsFlow += e.valueUsd; break;
        case "Encerramento": yieldsFlow += e.valueUsd; break;
        case "Taxa": fees += -e.valueUsd; break;
        case "Aporte": deposits += e.valueUsd; break;
        case "Retirada": withdrawals += -e.valueUsd; break;
      }
    }
    return { bought, sold, realizedPnl, yieldsFlow, fees, deposits, withdrawals, net };
  }, [filtered]);

  const toggleType = (t: ExtratoEventType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  };

  const visible = filtered.slice(0, visibleCount);

  // Agrupa eventos visíveis por mês preservando a ordem DESC.
  // endBalance = saldo APÓS o evento mais recente do mês (primeiro elemento, pois é DESC).
  const visibleByMonth = useMemo(() => {
    const groups: { month: string; events: ExtratoEvent[]; netValue: number; endBalance: number | null }[] = [];
    let cur: (typeof groups)[number] | null = null;
    for (const e of visible) {
      const month = e.date.slice(0, 7); // YYYY-MM
      if (!cur || cur.month !== month) {
        cur = { month, events: [], netValue: 0, endBalance: e.runningBalance ?? null };
        groups.push(cur);
      }
      cur.events.push(e);
      cur.netValue += e.valueUsd;
    }
    return groups;
  }, [visible]);

  const handleExportCsv = () => {
    if (filtered.length === 0) return;
    const headers = ["Data", "Tipo", "Símbolo", "Quantidade", "Descrição", "Valor (USD)", "Saldo (USD)", "Lucro/Prejuízo (USD)", "Observações"];
    const escape = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
    const rows = filtered.map((e) =>
      [
        e.date,
        e.type,
        e.symbol ?? "",
        e.quantity != null ? String(e.quantity) : "",
        e.description,
        e.valueUsd === 0 ? "" : e.valueUsd.toFixed(2),
        e.runningBalance != null ? e.runningBalance.toFixed(2) : "",
        e.profit != null ? e.profit.toFixed(2) : "",
        e.notes ?? "",
      ].map(escape).join(",")
    );
    const csv = [headers.map(escape).join(","), ...rows].join("\n");
    // BOM para Excel reconhecer UTF-8 corretamente
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Extrato_${fundName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

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
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
          <Button onClick={handleExport} disabled={generating || filtered.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            {generating ? "Gerando..." : "Exportar PDF"}
          </Button>
        </div>
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
        <SummaryCard
          label="Fluxo de aplicações"
          value={<Money usd={summary.yieldsFlow} className={cn("text-lg", pnlClass(summary.yieldsFlow))} />}
          sub={<span className="text-[10px] text-muted-foreground">(+) recuperado · (−) alocado líquido</span>}
        />
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
                <TableHead className="text-right">Valor ({currency})</TableHead>
                <TableHead className="text-right">Saldo de caixa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhuma movimentação registrada neste fundo.
                </TableCell></TableRow>
              )}
              {visibleByMonth.map((g) => {
                const collapsed = collapsedMonths.has(g.month);
                return (
                  <Fragment key={g.month}>
                    <MonthDividerRow
                      month={g.month}
                      count={g.events.length}
                      netValue={g.netValue}
                      endBalance={g.endBalance}
                      collapsed={collapsed}
                      onToggle={() => toggleMonth(g.month)}
                    />
                    {!collapsed && g.events.map((e) => <ExtratoRow key={e.id} ev={e} />)}
                  </Fragment>
                );
              })}
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
                <th className="text-right py-1.5 pr-2">Valor (USD)</th>
                <th className="text-right py-1.5">Saldo (USD)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-border/40">
                  <td className="py-1.5 pr-2 font-mono">{formatDate(e.date)}</td>
                  <td className="py-1.5 pr-2">{e.type}</td>
                  <td className="py-1.5 pr-2">
                    {e.description}
                    {e.notes && (
                      <div className="text-[10px] italic text-muted-foreground mt-0.5">“{e.notes}”</div>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono">
                    {e.quantity != null ? `${e.quantity} ${e.symbol ?? ""}` : ""}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono">
                    {e.valueUsd === 0 ? "—" : `${e.valueUsd >= 0 ? "+" : ""}${formatUSD(e.valueUsd)}`}
                  </td>
                  <td className="py-1.5 text-right font-mono">
                    {e.runningBalance != null ? formatUSD(e.runningBalance) : "—"}
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
  const isInfo = ev.valueUsd === 0;
  return (
    <TableRow>
      <TableCell className="font-mono text-xs whitespace-nowrap align-top">{formatDate(ev.date)}</TableCell>
      <TableCell className="align-top"><TypeBadge ev={ev} /></TableCell>
      <TableCell className="text-sm align-top">
        <div>{ev.description}</div>
        {ev.notes && (
          <div className="text-[11px] italic text-muted-foreground mt-0.5 whitespace-pre-wrap">
            “{ev.notes}”
          </div>
        )}
      </TableCell>
      <TableCell className="text-right font-mono text-xs align-top">
        {ev.quantity != null ? (
          <span>{ev.quantity} <span className="text-muted-foreground">{ev.symbol}</span></span>
        ) : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className={cn(
        "text-right font-mono tabular-nums align-top",
        isInfo ? "text-muted-foreground" : ev.valueUsd >= 0 ? "text-success" : "text-destructive",
      )}>
        {isInfo ? "—" : `${ev.valueUsd >= 0 ? "+" : ""}${formatUSD(ev.valueUsd)}`}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums text-xs align-top">
        {ev.runningBalance != null ? <Money usd={ev.runningBalance} /> : "—"}
      </TableCell>
    </TableRow>
  );
}

function MonthDividerRow({
  month,
  count,
  netValue,
  endBalance,
  collapsed,
  onToggle,
}: {
  month: string; // YYYY-MM
  count: number;
  netValue: number;
  endBalance: number | null;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const [y, m] = month.split("-").map(Number);
  const label = `${monthNamesPT[m - 1]} ${y}`;
  return (
    <TableRow
      className="cursor-pointer bg-muted/40 hover:bg-muted/60 border-t-2 border-primary/20"
      onClick={onToggle}
    >
      <TableCell colSpan={3} className="font-semibold text-sm">
        <div className="flex items-center gap-2">
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-primary" />
          )}
          <span>{label}</span>
          <span className="text-xs font-normal text-muted-foreground">
            · {count} {count === 1 ? "movimento" : "movimentos"}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right text-[10px] uppercase tracking-wider text-muted-foreground">
        net no mês
      </TableCell>
      <TableCell className={cn(
        "text-right font-mono tabular-nums text-sm",
        netValue >= 0 ? "text-success" : "text-destructive",
      )}>
        {netValue >= 0 ? "+" : ""}{formatUSD(netValue)}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums text-xs text-muted-foreground">
        {endBalance != null ? (
          <span>fim: <Money usd={endBalance} /></span>
        ) : "—"}
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
      case "Encerramento": return (ev.profit ?? 0) >= 0 ? "text-success" : "text-destructive";
      // Taxa zerada (fechamento sem cobrança) usa cor neutra; cobrada usa vermelha. C10.
      case "Taxa": return ev.valueUsd < 0 ? "text-destructive" : "text-muted-foreground";
      case "Aporte": return "text-success";
      case "Retirada": return "text-orange-700";
      case "Início do fundo": return "text-primary";
      case "Encerramento do fundo": return "text-muted-foreground";
      case "Edição": return "text-amber-500";
    }
  })();
  const isInfo =
    ev.type === "Início do fundo" ||
    ev.type === "Encerramento do fundo" ||
    ev.type === "Edição";
  return (
    <Badge
      variant={isInfo || ev.type === "Encerramento" ? "secondary" : "outline"}
      className={cn("font-mono text-[10px] whitespace-nowrap", cls)}
    >
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
