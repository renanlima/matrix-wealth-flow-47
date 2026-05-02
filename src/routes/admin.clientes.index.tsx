import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClickableRow } from "@/components/ui/clickable-row";
import { Plus, Loader2, Search, ArrowUp, ArrowDown, ChevronRight, Users } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useDemo } from "@/contexts/DemoContext";
import { getDemoClients } from "@/lib/demo-data";

export const Route = createFileRoute("/admin/clientes/")({
  component: ClientList,
});

interface ClientRow {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  created_at: string;
}

async function fetchClients(): Promise<ClientRow[]> {
  const { data: clients } = await supabase
    .from("clients")
    .select("id, phone, created_at")
    .order("created_at", { ascending: false });
  if (!clients) return [];
  const ids = clients.map((c) => c.id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const profMap = new Map(profiles?.map((p) => [p.id, p]));
  return clients.map((c) => ({
    id: c.id,
    phone: c.phone,
    created_at: c.created_at,
    full_name: profMap.get(c.id)?.full_name ?? null,
    email: profMap.get(c.id)?.email ?? null,
  }));
}

type SortKey = "full_name" | "email" | "created_at";
type SortDir = "asc" | "desc";

function ClientList() {
  const navigate = useNavigate();
  const { demo, seed } = useDemo();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: rows = [], isLoading: loading, refetch } = useQuery({
    queryKey: ["admin", "clients", { demo, seed }],
    queryFn: async () => (demo ? (getDemoClients(seed) as ClientRow[]) : await fetchClients()),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? rows.filter(
          (r) =>
            (r.full_name ?? "").toLowerCase().includes(q) ||
            (r.email ?? "").toLowerCase().includes(q) ||
            (r.phone ?? "").toLowerCase().includes(q),
        )
      : rows;
    const sorted = [...list].sort((a, b) => {
      const av = (a[sortKey] ?? "") as string;
      const bv = (b[sortKey] ?? "") as string;
      const cmp = av.localeCompare(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rows, search, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const SortHead = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {label}
        {sortKey === k &&
          (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">Gerencie a base de clientes da gestora.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="glow-cyan">
          <Plus className="h-4 w-4 mr-1" /> Novo cliente
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, email ou telefone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead k="full_name" label="Nome" />
                <SortHead k="email" label="Email" />
                <TableHead>Telefone</TableHead>
                <SortHead k="created_at" label="Criado em" />
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-12">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Users className="h-8 w-8 opacity-40" />
                      <p className="text-sm">
                        {search ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado."}
                      </p>
                      {!search && (
                        <Button size="sm" onClick={() => setOpen(true)} className="glow-cyan">
                          <Plus className="h-4 w-4 mr-1" /> Cadastrar primeiro cliente
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <ClickableRow
                  key={r.id}
                  onActivate={() =>
                    navigate({ to: "/admin/clientes/$clientId", params: { clientId: r.id } })
                  }
                >
                  <TableCell className="font-medium">{r.full_name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.email}</TableCell>
                  <TableCell className="font-mono text-xs">{r.phone ?? "—"}</TableCell>
                  <TableCell className="text-xs">{formatDate(r.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 text-muted-foreground/60 transition-transform",
                        "group-hover:translate-x-0.5",
                      )}
                    />
                  </TableCell>
                </ClickableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NewClientDialog open={open} onOpenChange={setOpen} onCreated={() => refetch()} />
    </div>
  );
}

function NewClientDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("create-client", {
      body: form,
    });
    setSubmitting(false);
    if (error || (data && (data as any).error)) {
      toast.error("Erro ao criar cliente", {
        description: error?.message ?? (data as any)?.error,
      });
      return;
    }
    toast.success("Cliente criado");
    setForm({ full_name: "", email: "", password: "", phone: "", notes: "" });
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
          <DialogDescription>
            O cliente recebe acesso imediato. A senha pode ser trocada em "Perfil".
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome completo *</Label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Senha inicial *</Label>
            <Input
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting} className="glow-cyan">
              {submitting ? "Criando..." : "Criar cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
