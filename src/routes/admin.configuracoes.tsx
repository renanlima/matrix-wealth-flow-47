import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sparkles, RefreshCw, AlertTriangle, ListChecks, RotateCcw } from "lucide-react";
import { useDemo } from "@/contexts/DemoContext";
import { toast } from "sonner";
import { useEffect, useState } from "react";

const RESET_KEY = "admin_onboarding_reset_at";
const DISMISS_KEY = "admin_onboarding_dismissed";
const RESET_EVENT = "reset-onboarding";
const REOPEN_EVENT = "reopen-onboarding";

export const Route = createFileRoute("/admin/configuracoes")({
  component: SettingsPage,
});

function SettingsPage() {
  const { demo, toggle, reseed, seed } = useDemo();
  const navigate = useNavigate();
  const [resetAt, setResetAt] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem(RESET_KEY),
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === RESET_KEY) setResetAt(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleResetGuide = () => {
    const now = String(Date.now());
    localStorage.setItem(RESET_KEY, now);
    localStorage.removeItem(DISMISS_KEY);
    setResetAt(now);
    window.dispatchEvent(new CustomEvent(RESET_EVENT));
    window.dispatchEvent(new CustomEvent(REOPEN_EVENT));
    toast.success("Guia resetado", { description: "Todos os passos voltaram a aparecer como pendentes." });
    navigate({ to: "/admin" });
  };

  const handleClearReset = () => {
    localStorage.removeItem(RESET_KEY);
    setResetAt(null);
    window.dispatchEvent(new CustomEvent(RESET_EVENT));
    toast.success("Progresso real restaurado");
  };


  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Preferências do painel administrativo.</p>
      </div>

      <Card className={demo ? "border-warning/40 bg-warning/5" : "border-primary/20"}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Modo Demonstração
              </CardTitle>
              <CardDescription>
                Substitui os dados reais do painel admin por um conjunto fictício otimista
                (3 clientes, 4 fundos, ~15 ativos, 90 dias de histórico). Ideal para
                apresentações comerciais.
              </CardDescription>
            </div>
            <Switch checked={demo} onCheckedChange={() => toggle()} aria-label="Ativar modo demo" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 rounded-md border border-border/60 bg-background/40 p-3">
            <Label className="flex-1 text-sm font-normal">
              <span className="block font-medium">Status</span>
              <span className="text-muted-foreground">
                {demo ? "Ativo — você está vendo dados fictícios." : "Desativado — dados reais."}
              </span>
            </Label>
            <span
              className={
                "px-2 py-1 rounded text-xs font-mono " +
                (demo
                  ? "bg-warning/20 text-warning border border-warning/40"
                  : "bg-muted text-muted-foreground")
              }
            >
              {demo ? "DEMO" : "LIVE"}
            </span>
          </div>

          <div className="flex items-center gap-3 rounded-md border border-border/60 bg-background/40 p-3">
            <div className="flex-1 text-sm">
              <div className="font-medium">Variar dados</div>
              <div className="text-muted-foreground text-xs">
                Gera um novo conjunto otimista (mesma estrutura, números diferentes).
                Seed atual: <span className="font-mono">{seed}</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!demo}
              onClick={() => {
                reseed();
                toast.success("Novo dataset demo gerado");
              }}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Resetar
            </Button>
          </div>

          <div className="text-xs text-muted-foreground space-y-1.5 border-t border-border/40 pt-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-warning shrink-0" />
              <div>
                <strong className="text-foreground">Nenhum dado real é alterado.</strong>{" "}
                O modo demo é puramente visual — nada é gravado no banco. O painel do
                cliente continua mostrando os dados reais normalmente.
              </div>
            </div>
            <div>
              • Afeta: Dashboard, Clientes, Cotações.
            </div>
            <div>
              • Persiste entre sessões neste navegador. Sincroniza entre abas abertas.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
