import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { getSignedUrl } from "@/lib/upload";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/app/futuros")({
  component: ClientFutures,
});

interface FuturesRow {
  id: string;
  title: string;
  description: string | null;
  file_path: string | null;
  file_type: string | null;
  created_at: string;
}

function ClientFutures() {
  const { user } = useAuth();
  const [rows, setRows] = useState<FuturesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("futures_records")
        .select("id, title, description, file_path, file_type, created_at")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false });
      setRows((data as FuturesRow[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const open = async (r: FuturesRow) => {
    if (!r.file_path) return;
    try {
      const url = await getSignedUrl("futures", r.file_path);
      setPreviewUrl(url);
      setPreviewTitle(r.title);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mercado futuro</h1>
        <p className="text-sm text-muted-foreground">Registros e prints das operações.</p>
      </div>

      {loading && <div className="text-center py-10 text-muted-foreground text-sm">Carregando...</div>}
      {!loading && rows.length === 0 && (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">
          Você ainda não possui registros futuros.
        </CardContent></Card>
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
              <div className="font-medium text-sm">{r.title}</div>
              {r.description && <div className="text-xs text-muted-foreground line-clamp-2">{r.description}</div>}
              <div className="text-xs text-muted-foreground font-mono">{formatDate(r.created_at)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{previewTitle}</DialogTitle></DialogHeader>
          {previewUrl && (
            previewUrl.match(/\.(pdf)(\?|$)/i)
              ? <iframe src={previewUrl} className="w-full h-[70vh]" title={previewTitle} />
              : <img src={previewUrl} alt={previewTitle} className="w-full max-h-[70vh] object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
