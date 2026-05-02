import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText } from "lucide-react";
import { monthNamesPT, formatDate } from "@/lib/format";

export const Route = createFileRoute("/app/mural")({
  component: ClientMural,
});

function ClientMural() {
  const [posts, setPosts] = useState<any[]>([]);
  const [year, setYear] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("mural_posts").select("*").order("period_year", { ascending: false }).order("period_month", { ascending: false });
      setPosts(data ?? []);
    })();
  }, []);

  const open = async (path: string) => {
    const { data } = await supabase.storage.from("mural").createSignedUrl(path, 60 * 5);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const years = Array.from(new Set(posts.map((p) => p.period_year))).sort((a, b) => b - a);
  const filtered = year === "all" ? posts : posts.filter((p) => String(p.period_year) === year);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Mural</h1>
          <p className="text-sm text-muted-foreground">Lâminas mensais publicadas pela gestora.</p>
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {years.map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground col-span-full">Nenhuma lâmina disponível.</CardContent></Card>
        )}
        {filtered.map((p) => (
          <Card key={p.id} className="border-primary/10 hover:border-primary/40 transition-colors">
            <CardContent className="p-4 space-y-2">
              <div className="font-medium">{p.title}</div>
              <div className="text-xs font-mono text-muted-foreground">
                {monthNamesPT[p.period_month - 1]} {p.period_year}
              </div>
              <div className="text-xs text-muted-foreground">{formatDate(p.published_at)}</div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => open(p.file_path)}>
                <FileText className="h-3.5 w-3.5 mr-1" /> Abrir
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
