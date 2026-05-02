// Sub-tab admin: Mercado Futuro — uploads de prints + título/descrição
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Trash2, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadFile, getSignedUrl, removeFile, validateFile } from "@/lib/upload";
import { formatDate } from "@/lib/format";

interface FuturesRow {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  file_path: string | null;
  file_type: string | null;
  created_at: string;
}

export function FuturesTab({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<FuturesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("futures_records")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    setRows((data as FuturesRow[]) ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const remove = async (r: FuturesRow) => {
    if (!confirm("Remover este registro?")) return;
    if (r.file_path) {
      try { await removeFile("futures", r.file_path); } catch {}
    }
    const { error } = await supabase.from("futures_records").delete().eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); load(); }
  };

  const open = async (r: FuturesRow) => {
    if (!r.file_path) return;
    try {
      const url = await getSignedUrl("futures", r.file_path);
      setPreviewUrl(url);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Mercado futuro</CardTitle>
          <NewFuturesDialog clientId={clientId} onCreated={load} />
        </CardHeader>
        <CardContent>
          {loading && <div className="text-center py-6 text-muted-foreground text-sm">Carregando...</div>}
          {!loading && rows.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">Nenhum registro futuro cadastrado.</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rows.map((r) => (
              <Card key={r.id} className="overflow-hidden hover:border-primary/40 transition-colors">
                <button
                  className="aspect-video bg-muted/30 flex items-center justify-center w-full hover:bg-muted/50"
                  onClick={() => open(r)}
                >
                  <FileText className="h-10 w-10 text-muted-foreground" />
                </button>
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-sm">{r.title}</div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 -mt-1 -mr-1" onClick={() => remove(r)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {r.description && <div className="text-xs text-muted-foreground line-clamp-2">{r.description}</div>}
                  <div className="text-xs text-muted-foreground font-mono">{formatDate(r.created_at)}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Preview</DialogTitle></DialogHeader>
          {previewUrl && (
            previewUrl.match(/\.(pdf)(\?|$)/i)
              ? <iframe src={previewUrl} className="w-full h-[70vh]" />
              : <img src={previewUrl} alt="preview" className="w-full max-h-[70vh] object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewFuturesDialog({ clientId, onCreated }: { clientId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { toast.error("Selecione um arquivo"); return; }
    const v = validateFile(file);
    if (v) { toast.error(v); return; }
    setSubmitting(true);
    try {
      const up = await uploadFile({ bucket: "futures", pathPrefix: clientId, file });
      const { error } = await supabase.from("futures_records").insert({
        client_id: clientId,
        title,
        description: description || null,
        file_path: up.path,
        file_type: up.mime,
      });
      if (error) throw error;
      toast.success("Registro adicionado");
      setOpen(false); setTitle(""); setDescription(""); setFile(null);
      onCreated();
    } catch (err: any) {
      toast.error(err.message);
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="glow-cyan"><Plus className="h-4 w-4 mr-1" /> Novo</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo registro futuro</DialogTitle>
          <DialogDescription>Print da operação (PDF, JPG ou PNG, até 5MB).</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Arquivo *</Label>
            <Input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting} className="glow-cyan">
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {submitting ? "Enviando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
