import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Money, Pct } from "@/components/Money";
import { Download, Loader2, FileBarChart } from "lucide-react";
import {
  LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import { generatePdfFromElement } from "@/lib/pdf";
import logo from "@/assets/matrix-logo.png";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/app/relatorios")({
  component: ClientReports,
});

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface PHRow {
  id: string;
  fund_id: string;
  year: number;
  month: number;
  patrimonio_inicio_usd: number;
  patrimonio_fim_usd: number;
  alocacoes_usd: number;
  desalocacoes_usd: number;
  lucro_bruto_usd: number;
}
interface ClientFund { id: string; name: string; }
interface Holding { id: string; fund_id: string; coin_symbol: string; coin_name: string | null; quantity: number; entry_price_usd: number; status: string; }
interface FixedIncome { id: string; fund_id: string; product_name: string; valor_aplicado_usd: number; ultimo_preco_usd: number | null; data_saida: string | null; }

function ClientReports() {
  const { user, profile } = useAuth();
  const [funds, setFunds] = useState<ClientFund[]>([]);
  const [history, setHistory] = useState<PHRow[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [fixedIncome, setFixedIncome] = useState<FixedIncome[]>([]);
  const [prices, setPrices] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const now = new Date();
  const lastMonth = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth();
  const lastYear = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const [periodKey, setPeriodKey] = useState(`${lastYear}-${lastMonth}`);

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: fs }, { data: p }] = await Promise.all([
        supabase.from("client_funds").select("id, name").eq("client_id", user.id),
        supabase.from("coin_prices").select("symbol, price_usd"),
      ]);
      const validFunds = (fs ?? []).filter((f): f is { id: string; name: string } => !!f.id && !!f.name);
      setFunds(validFunds);
      setPrices(new Map((p ?? []).map((x) => [x.symbol.toUpperCase(), Number(x.price_usd)])));
      if (validFunds.length === 0) { setHistory([]); setHoldings([]); setFixedIncome([]); setLoading(false); return; }
      const fundIds = validFunds.map((f) => f.id);
      const [{ data: ph }, { data: h }, { data: fi }] = await Promise.all([
        supabase.from("client_performance_history")
          .select("*")
          .in("fund_id", fundIds)
          .order("year").order("month"),
        supabase.from("holdings")
          .select("id, fund_id, coin_symbol, coin_name, quantity, entry_price_usd, status")
          .in("fund_id", fundIds),
        supabase.from("fixed_income")
          .select("id, fund_id, product_name, valor_aplicado_usd, ultimo_preco_usd, data_saida")
          .in("fund_id", fundIds),
      ]);
      setHistory(((ph ?? []) as PHRow[]).filter((r) => r.year != null && r.month != null));
      setHoldings((h as Holding[]) ?? []);
      setFixedIncome((fi as FixedIncome[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  // Mapeia histórico em série de evolução agregada (somando todos os fundos por mês)
  const evolution = useMemo(() => {
    const byPeriod = new Map<string, { period: string; patrimonio: number; lucro: number }>();
    for (const r of history) {
      const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
      const cur = byPeriod.get(key) ?? { period: `${MONTHS[r.month - 1]}/${r.year}`, patrimonio: 0, lucro: 0 };
      cur.patrimonio += Number(r.patrimonio_fim_usd);
      cur.lucro += Number(r.lucro_bruto_usd);
      byPeriod.set(key, cur);
    }
    return [...byPeriod.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [history]);

  const periodOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of history) set.add(`${r.year}-${r.month}`);
    return [...set].sort().reverse();
  }, [history]);

  const [selYear, selMonth] = periodKey.split("-").map(Number);
  const selectedRows = history.filter((r) => r.year === selYear && r.month === selMonth);

  // Totais agregados do período
  const periodTotals = selectedRows.reduce(
    (acc, r) => ({
      inicio: acc.inicio + Number(r.patrimonio_inicio_usd),
      fim: acc.fim + Number(r.patrimonio_fim_usd),
      aloc: acc.aloc + Number(r.alocacoes_usd),
      desaloc: acc.desaloc + Number(r.desalocacoes_usd),
      lucro: acc.lucro + Number(r.lucro_bruto_usd),
    }),
    { inicio: 0, fim: 0, aloc: 0, desaloc: 0, lucro: 0 },
  );

  // Posições atuais (snapshot na hora da geração)
  const activeHoldings = holdings.filter((h) => h.status === "ativa");
  const totalHoldingsValue = activeHoldings.reduce((s, h) => {
    const cur = prices.get(h.coin_symbol.toUpperCase()) ?? Number(h.entry_price_usd);
    return s + Number(h.quantity) * cur;
  }, 0);
  const activeFI = fixedIncome.filter((r) => !r.data_saida);
  const totalFIValue = activeFI.reduce((s, r) => s + Number(r.ultimo_preco_usd ?? r.valor_aplicado_usd), 0);

  const handleDownload = async () => {
    if (!reportRef.current) return;
    setGenerating(true);
    try {
      const fname = `Matrix_Relatorio_${selYear}-${String(selMonth).padStart(2, "0")}.pdf`;
      await generatePdfFromElement(reportRef.current, fname);
      toast.success("PDF gerado");
    } catch (e: any) {
      toast.error("Falha ao gerar PDF: " + e.message);
    } finally { setGenerating(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Relatórios mensais</h1>
          <p className="text-sm text-muted-foreground">Performance consolidada e exportação em PDF.</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase">Período</label>
            <Select value={periodKey} onValueChange={setPeriodKey}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {periodOptions.length === 0 && <SelectItem value="empty" disabled>Sem fechamentos</SelectItem>}
                {periodOptions.map((k) => {
                  const [y, m] = k.split("-").map(Number);
                  return <SelectItem key={k} value={k}>{MONTHS[m - 1]}/{y}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleDownload} disabled={generating || loading || selectedRows.length === 0} className="glow-cyan">
            {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            {generating ? "Gerando..." : "Exportar PDF"}
          </Button>
        </div>
      </div>

      {loading && <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Carregando...</CardContent></Card>}

      {!loading && (
        <>
          {/* Histórico tabular completo */}
          <Card>
            <CardHeader><CardTitle className="text-base">Histórico mensal</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Fundo</TableHead>
                  <TableHead className="text-right">Início</TableHead>
                  <TableHead className="text-right">Fim</TableHead>
                  <TableHead className="text-right">Aloc.</TableHead>
                  <TableHead className="text-right">Desaloc.</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {history.length === 0 && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Sem fechamentos mensais ainda.</TableCell></TableRow>}
                  {[...history].reverse().map((r) => {
                    const fund = funds.find((f) => f.id === r.fund_id);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{MONTHS[r.month - 1]}/{r.year}</TableCell>
                        <TableCell className="text-xs">{fund?.name ?? "—"}</TableCell>
                        <TableCell className="text-right"><Money usd={Number(r.patrimonio_inicio_usd)} /></TableCell>
                        <TableCell className="text-right"><Money usd={Number(r.patrimonio_fim_usd)} /></TableCell>
                        <TableCell className="text-right text-xs"><Money usd={Number(r.alocacoes_usd)} /></TableCell>
                        <TableCell className="text-right text-xs"><Money usd={Number(r.desalocacoes_usd)} /></TableCell>
                        <TableCell className={`text-right font-mono ${Number(r.lucro_bruto_usd) >= 0 ? "text-success" : "text-destructive"}`}>
                          <Money usd={Number(r.lucro_bruto_usd)} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Gráfico de evolução */}
          {evolution.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Evolução do patrimônio</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: "#0A0E1A", border: "1px solid #00D4FF55" }} formatter={(v: number) => `$${v.toFixed(2)}`} />
                    <Line type="monotone" dataKey="patrimonio" stroke="#00D4FF" strokeWidth={2} dot={{ r: 3 }} name="Patrimônio" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Card "snapshot do PDF" — renderizado para captura, mas visível também */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileBarChart className="h-4 w-4" /> Pré-visualização do relatório — {MONTHS[selMonth - 1]}/{selYear}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ReportSnapshot
                ref={reportRef}
                periodLabel={`${MONTHS[selMonth - 1]}/${selYear}`}
                clientName={profile?.full_name ?? user?.email ?? "—"}
                rows={selectedRows}
                funds={funds}
                totals={periodTotals}
                holdings={activeHoldings}
                fixedIncome={activeFI}
                prices={prices}
                holdingsValue={totalHoldingsValue}
                fixedIncomeValue={totalFIValue}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ============= Snapshot de relatório (DOM capturado pelo PDF) =============
import { forwardRef } from "react";

interface SnapshotProps {
  periodLabel: string;
  clientName: string;
  rows: PHRow[];
  funds: ClientFund[];
  totals: { inicio: number; fim: number; aloc: number; desaloc: number; lucro: number };
  holdings: Holding[];
  fixedIncome: FixedIncome[];
  prices: Map<string, number>;
  holdingsValue: number;
  fixedIncomeValue: number;
}

const ReportSnapshot = forwardRef<HTMLDivElement, SnapshotProps>((props, ref) => {
  const { periodLabel, clientName, rows, funds, totals, holdings, fixedIncome, prices, holdingsValue, fixedIncomeValue } = props;
  const rendimentoPct = totals.inicio > 0 ? (totals.lucro / totals.inicio) * 100 : 0;
  const today = new Date();

  return (
    <div
      ref={ref}
      style={{
        background: "#0A0E1A",
        color: "#E2E8F0",
        padding: "32px",
        fontFamily: "system-ui, sans-serif",
        width: "794px", // ~A4 a 96dpi
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #00D4FF40", paddingBottom: "16px", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img src={logo} alt="Matrix" style={{ height: "40px", width: "auto" }} crossOrigin="anonymous" />
          <div>
            <div style={{ fontSize: "18px", fontWeight: 600, color: "#00D4FF" }}>Matrix Digital Assets</div>
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>Relatório mensal de performance</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#00D4FF" }}>{periodLabel}</div>
          <div style={{ fontSize: "10px", color: "#94a3b8" }}>Emitido em {formatDate(today)}</div>
        </div>
      </div>

      {/* Cliente */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px" }}>Cliente</div>
        <div style={{ fontSize: "16px", fontWeight: 600 }}>{clientName}</div>
      </div>

      {/* Resumo do período */}
      <div style={{ marginBottom: "24px" }}>
        <SectionTitle>Resumo do período</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px", marginTop: "8px" }}>
          <KpiBox label="Patrimônio início" value={formatUsd(totals.inicio)} />
          <KpiBox label="Patrimônio fim" value={formatUsd(totals.fim)} highlight />
          <KpiBox label="Lucro bruto" value={formatUsd(totals.lucro)} positive={totals.lucro >= 0} />
          <KpiBox label="Rendimento" value={`${rendimentoPct >= 0 ? "+" : ""}${rendimentoPct.toFixed(2)}%`} positive={rendimentoPct >= 0} />
        </div>
      </div>

      {/* Detalhamento por fundo */}
      {rows.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <SectionTitle>Detalhamento por fundo</SectionTitle>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "8px", fontSize: "11px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #00D4FF40", textAlign: "left", color: "#94a3b8" }}>
                <th style={{ padding: "6px 4px" }}>Fundo</th>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>Início</th>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>Fim</th>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>Aloc.</th>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>Desaloc.</th>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>Lucro</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const fund = funds.find((f) => f.id === r.fund_id);
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid #1f2937" }}>
                    <td style={{ padding: "6px 4px" }}>{fund?.name ?? "—"}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right" }}>{formatUsd(Number(r.patrimonio_inicio_usd))}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right" }}>{formatUsd(Number(r.patrimonio_fim_usd))}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right" }}>{formatUsd(Number(r.alocacoes_usd))}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right" }}>{formatUsd(Number(r.desalocacoes_usd))}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right", color: Number(r.lucro_bruto_usd) >= 0 ? "#5BE49B" : "#FB7185" }}>{formatUsd(Number(r.lucro_bruto_usd))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Posições cripto */}
      {holdings.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <SectionTitle>Posições cripto ativas — {formatUsd(holdingsValue)}</SectionTitle>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "8px", fontSize: "11px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #00D4FF40", textAlign: "left", color: "#94a3b8" }}>
                <th style={{ padding: "6px 4px" }}>Ativo</th>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>Qtd</th>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>Custo</th>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>Mercado</th>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>P&L</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const cur = prices.get(h.coin_symbol.toUpperCase()) ?? Number(h.entry_price_usd);
                const cost = Number(h.quantity) * Number(h.entry_price_usd);
                const market = Number(h.quantity) * cur;
                const pnl = market - cost;
                return (
                  <tr key={h.id} style={{ borderBottom: "1px solid #1f2937" }}>
                    <td style={{ padding: "6px 4px", fontFamily: "monospace" }}>{h.coin_symbol}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right", fontFamily: "monospace" }}>{Number(h.quantity).toLocaleString("en-US", { maximumFractionDigits: 8 })}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right" }}>{formatUsd(cost)}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right" }}>{formatUsd(market)}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right", color: pnl >= 0 ? "#5BE49B" : "#FB7185" }}>{formatUsd(pnl)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Rendimentos alternativos */}
      {fixedIncome.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <SectionTitle>Rendimentos alternativos — {formatUsd(fixedIncomeValue)}</SectionTitle>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "8px", fontSize: "11px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #00D4FF40", textAlign: "left", color: "#94a3b8" }}>
                <th style={{ padding: "6px 4px" }}>Produto</th>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>Aplicado</th>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>Atual</th>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>Rend.</th>
              </tr>
            </thead>
            <tbody>
              {fixedIncome.map((r) => {
                const aplicado = Number(r.valor_aplicado_usd);
                const atual = Number(r.ultimo_preco_usd ?? aplicado);
                const pct = aplicado > 0 ? ((atual - aplicado) / aplicado) * 100 : 0;
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid #1f2937" }}>
                    <td style={{ padding: "6px 4px" }}>{r.product_name}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right" }}>{formatUsd(aplicado)}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right" }}>{formatUsd(atual)}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right", color: pct >= 0 ? "#5BE49B" : "#FB7185" }}>{pct >= 0 ? "+" : ""}{pct.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: "32px", paddingTop: "12px", borderTop: "1px solid #1f2937", fontSize: "9px", color: "#64748b", textAlign: "center" }}>
        Documento gerado automaticamente pela plataforma Matrix Digital Assets · Confidencial
      </div>
    </div>
  );
});
ReportSnapshot.displayName = "ReportSnapshot";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "12px", color: "#00D4FF", textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: 600 }}>
      {children}
    </div>
  );
}

function KpiBox({ label, value, highlight, positive }: { label: string; value: string; highlight?: boolean; positive?: boolean }) {
  const color = positive === undefined ? (highlight ? "#00D4FF" : "#E2E8F0") : (positive ? "#5BE49B" : "#FB7185");
  return (
    <div style={{ border: "1px solid #1f2937", borderRadius: "6px", padding: "10px" }}>
      <div style={{ fontSize: "9px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px" }}>{label}</div>
      <div style={{ fontSize: "16px", fontWeight: 600, fontFamily: "monospace", color, marginTop: "4px" }}>{value}</div>
    </div>
  );
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}
