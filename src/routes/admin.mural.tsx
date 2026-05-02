import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { monthNamesPT, formatDate } from "@/lib/format";

export const Route = createFileRoute("/admin/mural")({
  component: MuralAdmin,
});

interface Post {
  id: string;
  title: string;
  file_path: string;
  file_type: string;
  period_year: number;
  period_month: number;
  published_at: string;
}

function MuralAdmin() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("mural_posts")
      .select("*")
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false });
    setPosts((data as Post[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (post: Post) => {
    if (!confirm(`Remover lâmina "${post.title}"?`)) return;
    await supabase.storage.from("mural").remove([post.file_path]);
    await supabase.from("mural_posts").delete().eq("id", post.id);
    toast.success("Lâmina removida");
    load();
  };

  const openFile = async (path: string) => {
    const { data } = await supabase.storage.from("mural").createSignedUrl(path, 60 * 5);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mural</h1>
          <p className="text-sm text-muted-foreground">Lâminas mensais publicadas para todos os clientes.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="glow-cyan"><Plus className="h-4 w-4 mr-1" /> Nova lâmina</Button>
          </DialogTrigger>
          <NewPostDialog onCreated={() => { setOpen(false); load(); }} />
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.length === 0 && (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground col-span-full">Nenhuma lâmina publicada.</CardContent></Card>
        )}
        {posts.map((p) => (
          <Card key={p.id} className="border-primary/10">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium">{p.title}</div>
                <Button variant="ghost" size="icon" onClick={() => remove(p)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {monthNamesPT[p.period_month - 1]} {p.period_year}
              </div>
              <div className="text-xs text-muted-foreground">{formatDate(p.published_at)}</div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => openFile(p.file_path)}>
                <FileText className="h-3.5 w-3.5 mr-1" /> Abrir
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NewPostDialog({ onCreated }: { onCreated: () => void }) {
  const now = new Date();
  const [title, setTitle] = useState("");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Selecione um arquivo");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo excede 5MB");
      return;
    }
    setSubmitting(true);
    const ext = file.name.split(".").pop();
    const path = `${year}/${month}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("mural").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (upErr) {
      setSubmitting(false);
      toast.error(upErr.message);
      return;
    }
    const { error } = await supabase.from("mural_posts").insert({
      title,
      file_path: path,
      file_type: file.type,
      period_year: Number(year),
      period_month: Number(month),
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Lâmina publicada");
    onCreated();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nova lâmina</DialogTitle>
        <DialogDescription>PDF ou imagem (até 5MB).</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label>Título *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Mês *</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthNamesPT.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Ano *</Label>
            <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} required />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Arquivo (PDF/JPG/PNG, até 5MB) *</Label>
          <Input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting}>{submitting ? "Enviando..." : "Publicar"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
