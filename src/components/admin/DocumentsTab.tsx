// Sub-tab admin: Documentos (3 abas internas: Contratos, Recibos, NFs)
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Download, Loader2, FileText, Star } from "lucide-react";
import { toast } from "sonner";
import { Money } from "@/components/Money";
import { uploadFile, getSignedUrl, removeFile, validateFile } from "@/lib/upload";
import { formatDate, parseUsdInput } from "@/lib/format";

export function DocumentsTab({ clientId }: { clientId: string }) {
  return (
    <Tabs defaultValue="contracts">
      <TabsList>
        <TabsTrigger value="contracts">Contratos</TabsTrigger>
        <TabsTrigger value="receipts">Recibos</TabsTrigger>
        <TabsTrigger value="invoices">NFs</TabsTrigger>
      </TabsList>
      <TabsContent value="contracts" className="mt-4"><ContractsPanel clientId={clientId} /></TabsContent>
      <TabsContent value="receipts" className="mt-4"><ReceiptsPanel clientId={clientId} /></TabsContent>
      <TabsContent value="invoices" className="mt-4"><InvoicesPanel clientId={clientId} /></TabsContent>
    </Tabs>
  );
}

async function downloadDoc(bucket: string, path: string) {
  try {
    const url = await getSignedUrl(bucket, path);
    window.open(url, "_blank");
  } catch (e: any) { toast.error(e.message); }
}

// ============= CONTRATOS (versionados) =============
interface Contract {
  id: string; client_id: string; file_path: string; version: number;
  is_active: boolean; signed_date: string | null; notes: string | null; created_at: string;
}

function ContractsPanel({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("contracts")
      .select("*")
      .eq("client_id", clientId)
      .order("version", { ascending: false });
    setRows((data as Contract[]) ?? []);
    setLoading(false);
  }, [clientId]);
  useEffect(() => { load(); }, [load]);

  const setActive = async (id: string) => {
    // desativa todos e ativa este
    await supabase.from("contracts").update({ is_active: false }).eq("client_id", clientId);
    const { error } = await supabase.from("contracts").update({ is_active: true }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Contrato ativo atualizado"); load(); }
  };

  const remove = async (r: Contract) => {
    if (!confirm("Remover este contrato?")) return;
    try { await removeFile("contracts", r.file_path); } catch {}
    const { error } = await supabase.from("contracts").delete().eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); load(); }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Contratos</CardTitle>
        <NewContractDialog clientId={clientId} nextVersion={(rows[0]?.version ?? 0) + 1} onCreated={load} />
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Versão</TableHead>
              <TableHead>Assinado em</TableHead>
              <TableHead>Observações</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Carregando...</TableCell></TableRow>}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">Nenhum contrato.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">v{r.version}</TableCell>
                <TableCell className="text-xs">{formatDate(r.signed_date)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.notes ?? "—"}</TableCell>
                <TableCell>
                  {r.is_active
                    ? <span className="text-xs font-mono uppercase text-success flex items-center gap-1"><Star className="h-3 w-3" /> Ativo</span>
                    : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    {!r.is_active && <Button variant="outline" size="sm" onClick={() => setActive(r.id)}>Ativar</Button>}
                    <Button variant="ghost" size="icon" onClick={() => downloadDoc("contracts", r.file_path)}><Download className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function NewContractDialog({ clientId, nextVersion, onCreated }: { clientId: string; nextVersion: number; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [signedDate, setSignedDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { toast.error("Selecione um arquivo"); return; }
    const v = validateFile(file);
    if (v) { toast.error(v); return; }
    setSubmitting(true);
    try {
      const up = await uploadFile({ bucket: "contracts", pathPrefix: `${clientId}/contracts`, file });
      // desativar anteriores
      await supabase.from("contracts").update({ is_active: false }).eq("client_id", clientId);
      const { error } = await supabase.from("contracts").insert({
        client_id: clientId,
        file_path: up.path,
        version: nextVersion,
        is_active: true,
        signed_date: signedDate || null,
        notes: notes || null,
      });
      if (error) throw error;
      toast.success(`Contrato v${nextVersion} adicionado`);
      setOpen(false); setFile(null); setNotes("");
      onCreated();
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="glow-cyan"><Plus className="h-4 w-4 mr-1" /> Nova versão</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo contrato (v{nextVersion})</DialogTitle>
          <DialogDescription>Esta versão se torna a ativa automaticamente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5"><Label>Data de assinatura</Label><Input type="date" value={signedDate} onChange={(e) => setSignedDate(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Observações</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Arquivo *</Label><Input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required /></div>
          <DialogFooter><Button type="submit" disabled={submitting} className="glow-cyan">{submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}{submitting ? "Enviando..." : "Salvar"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============= RECIBOS =============
interface Receipt { id: string; file_path: string; receipt_date: string | null; amount_usd: number | null; notes: string | null; }

function ReceiptsPanel({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("receipts").select("*").eq("client_id", clientId).order("receipt_date", { ascending: false });
    setRows((data as Receipt[]) ?? []);
    setLoading(false);
  }, [clientId]);
  useEffect(() => { load(); }, [load]);

  const remove = async (r: Receipt) => {
    if (!confirm("Remover este recibo?")) return;
    try { await removeFile("receipts", r.file_path); } catch {}
    const { error } = await supabase.from("receipts").delete().eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); load(); }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Recibos</CardTitle>
        <NewReceiptDialog clientId={clientId} onCreated={load} />
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Observações</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Carregando...</TableCell></TableRow>}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Nenhum recibo.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{formatDate(r.receipt_date)}</TableCell>
                <TableCell className="text-right">{r.amount_usd != null ? <Money usd={Number(r.amount_usd)} /> : "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.notes ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => downloadDoc("receipts", r.file_path)}><Download className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function NewReceiptDialog({ clientId, onCreated }: { clientId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { toast.error("Selecione um arquivo"); return; }
    const v = validateFile(file);
    if (v) { toast.error(v); return; }
    setSubmitting(true);
    try {
      const up = await uploadFile({ bucket: "receipts", pathPrefix: `${clientId}/receipts`, file });
      const { error } = await supabase.from("receipts").insert({
        client_id: clientId,
        file_path: up.path,
        receipt_date: date || null,
        amount_usd: amount ? Number(amount) : null,
        notes: notes || null,
      });
      if (error) throw error;
      toast.success("Recibo adicionado");
      setOpen(false); setFile(null); setAmount(""); setNotes("");
      onCreated();
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="glow-cyan"><Plus className="h-4 w-4 mr-1" /> Novo</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo recibo</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Valor (USD)</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Observações</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Arquivo *</Label><Input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required /></div>
          <DialogFooter><Button type="submit" disabled={submitting} className="glow-cyan">{submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}{submitting ? "Enviando..." : "Salvar"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============= NOTAS FISCAIS =============
interface Invoice { id: string; file_path: string; periodo_inicio: string | null; periodo_fim: string | null; notes: string | null; }

function InvoicesPanel({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("invoices").select("*").eq("client_id", clientId).order("periodo_fim", { ascending: false });
    setRows((data as Invoice[]) ?? []);
    setLoading(false);
  }, [clientId]);
  useEffect(() => { load(); }, [load]);

  const remove = async (r: Invoice) => {
    if (!confirm("Remover esta NF?")) return;
    try { await removeFile("invoices", r.file_path); } catch {}
    const { error } = await supabase.from("invoices").delete().eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); load(); }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Notas Fiscais</CardTitle>
        <NewInvoiceDialog clientId={clientId} onCreated={load} />
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Período</TableHead><TableHead>Observações</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">Carregando...</TableCell></TableRow>}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">Nenhuma NF.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">
                  {r.periodo_inicio || r.periodo_fim
                    ? <>{formatDate(r.periodo_inicio)} → {formatDate(r.periodo_fim)}</>
                    : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.notes ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => downloadDoc("invoices", r.file_path)}><Download className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function NewInvoiceDialog({ clientId, onCreated }: { clientId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { toast.error("Selecione um arquivo"); return; }
    const v = validateFile(file);
    if (v) { toast.error(v); return; }
    setSubmitting(true);
    try {
      const up = await uploadFile({ bucket: "invoices", pathPrefix: `${clientId}/invoices`, file });
      const { error } = await supabase.from("invoices").insert({
        client_id: clientId,
        file_path: up.path,
        periodo_inicio: periodoInicio || null,
        periodo_fim: periodoFim || null,
        notes: notes || null,
      });
      if (error) throw error;
      toast.success("NF adicionada");
      setOpen(false); setFile(null); setNotes(""); setPeriodoInicio(""); setPeriodoFim("");
      onCreated();
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="glow-cyan"><Plus className="h-4 w-4 mr-1" /> Nova NF</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova nota fiscal</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Período início</Label><Input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Período fim</Label><Input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Observações</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Arquivo *</Label><Input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required /></div>
          <DialogFooter><Button type="submit" disabled={submitting} className="glow-cyan">{submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}{submitting ? "Enviando..." : "Salvar"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
