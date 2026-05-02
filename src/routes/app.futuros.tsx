import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/app/futuros")({
  component: () => (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Mercado futuro</h1>
      <Card className="border-dashed"><CardContent className="py-16 text-center text-sm text-muted-foreground"><span className="font-mono uppercase tracking-wider text-primary/70">Em breve</span><div className="mt-2">Próxima fase.</div></CardContent></Card>
    </div>
  ),
});
