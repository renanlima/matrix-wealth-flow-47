import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, Star } from "lucide-react";
import { toast } from "sonner";
import { Money } from "@/components/Money";
import { getSignedUrl } from "@/lib/upload";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/app/documentos")({
  component: ClientDocuments,
});

async function downloadDoc(bucket: string, path: string) {
  try {
    const url = await getSignedUrl(bucket, path);
    window.open(url, "_blank");
  } catch (e: any) { toast.error(e.message); }
}

function ClientDocuments() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Documentos</h1>
        <p className="text-sm text-muted-foreground">Contratos, recibos e notas fiscais.</p>
      </div>
      <Tabs defaultValue="contracts">
        <TabsList>
          <TabsTrigger value="contracts">Contratos</TabsTrigger>
          <TabsTrigger value="receipts">Recibos</TabsTrigger>
          <TabsTrigger value="invoices">Notas Fiscais</TabsTrigger>
        </TabsList>
        <TabsContent value="contracts" className="mt-4"><ContractsList /></TabsContent>
        <TabsContent value="receipts" className="mt-4"><ReceiptsList /></TabsContent>
        <TabsContent value="invoices" className="mt-4"><InvoicesList /></TabsContent>
      </Tabs>
    </div>
  );
}

interface Contract { id: string; file_path: string; version: number; is_active: boolean; signed_date: string | null; notes: string | null; }
function ContractsList() {
  const { user } = useAuth();
  const { data: rows = [], isLoading: loading } = useQuery({
    queryKey: ["client", "contracts", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("contracts")
        .select("id, file_path, version, is_active, signed_date, notes")
        .eq("client_id", user!.id)
        .order("version", { ascending: false });
      return (data as Contract[]) ?? [];
    },
    enabled: !!user,
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Contratos</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Versão</TableHead><TableHead>Assinado em</TableHead><TableHead>Status</TableHead><TableHead>Observações</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Carregando...</TableCell></TableRow>}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Nenhum contrato disponível.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">v{r.version}</TableCell>
                <TableCell className="text-xs">{formatDate(r.signed_date)}</TableCell>
                <TableCell>
                  {r.is_active
                    ? <span className="text-xs font-mono uppercase text-success flex items-center gap-1"><Star className="h-3 w-3" /> Vigente</span>
                    : <span className="text-xs text-muted-foreground">Histórico</span>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.notes ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => downloadDoc("contracts", r.file_path)}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Baixar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

interface Receipt { id: string; file_path: string; receipt_date: string | null; amount_usd: number | null; notes: string | null; }
function ReceiptsList() {
  const { user } = useAuth();
  const { data: rows = [], isLoading: loading } = useQuery({
    queryKey: ["client", "receipts", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("receipts")
        .select("id, file_path, receipt_date, amount_usd, notes")
        .eq("client_id", user!.id)
        .order("receipt_date", { ascending: false });
      return (data as Receipt[]) ?? [];
    },
    enabled: !!user,
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Recibos</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Observações</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Carregando...</TableCell></TableRow>}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">Nenhum recibo disponível.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{formatDate(r.receipt_date)}</TableCell>
                <TableCell className="text-right">{r.amount_usd != null ? <Money usd={Number(r.amount_usd)} /> : "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.notes ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => downloadDoc("receipts", r.file_path)}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Baixar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

interface Invoice { id: string; file_path: string; periodo_inicio: string | null; periodo_fim: string | null; notes: string | null; }
function InvoicesList() {
  const { user } = useAuth();
  const { data: rows = [], isLoading: loading } = useQuery({
    queryKey: ["client", "invoices", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, file_path, periodo_inicio, periodo_fim, notes")
        .eq("client_id", user!.id)
        .order("periodo_fim", { ascending: false });
      return (data as Invoice[]) ?? [];
    },
    enabled: !!user,
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Notas Fiscais</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Período</TableHead><TableHead>Observações</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">Carregando...</TableCell></TableRow>}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={3} className="py-10 text-center text-muted-foreground">Nenhuma NF disponível.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">
                  {r.periodo_inicio || r.periodo_fim
                    ? <>{formatDate(r.periodo_inicio)} → {formatDate(r.periodo_fim)}</>
                    : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.notes ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => downloadDoc("invoices", r.file_path)}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Baixar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
