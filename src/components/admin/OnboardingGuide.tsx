import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  CheckCircle2,
  Circle,
  ArrowRight,
  X,
  ChevronDown,
  ChevronUp,
  Users,
  Wallet,
  DollarSign,
  Coins,
  RefreshCw,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "admin_onboarding_dismissed";
const REOPEN_EVENT = "reopen-onboarding";

export interface OnboardingState {
  hasClient: boolean;
  hasFund: boolean;
  hasDeposit: boolean;
  hasHolding: boolean;
  pricesFresh: boolean;
  firstClientId: string | null;
  firstFundId: string | null;
}

interface Step {
  key: string;
  title: string;
  description: string;
  help: string;
  icon: React.ComponentType<{ className?: string }>;
  done: boolean;
  cta: { label: string; to?: string; href?: string; params?: Record<string, string> };
}

export function OnboardingGuide({ state }: { state: OnboardingState }) {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(DISMISS_KEY) === "1";
  });
  const [expandedHelp, setExpandedHelp] = useState<string | null>(null);

  useEffect(() => {
    const handler = () => {
      localStorage.removeItem(DISMISS_KEY);
      setDismissed(false);
    };
    window.addEventListener(REOPEN_EVENT, handler);
    return () => window.removeEventListener(REOPEN_EVENT, handler);
  }, []);

  const clientId = state.firstClientId;
  const fundId = state.firstFundId;

  const steps: Step[] = [
    {
      key: "client",
      title: "Cadastrar o primeiro cliente",
      description: "Crie a conta do cliente para começar a operar.",
      help: "Vá em Clientes e clique em \"Novo cliente\". Você define nome, e-mail e a senha de acesso. Esse cliente vai conseguir entrar no painel dele assim que for criado.",
      icon: Users,
      done: state.hasClient,
      cta: { label: "Ir para Clientes", to: "/admin/clientes" },
    },
    {
      key: "fund",
      title: "Criar um fundo para o cliente",
      description: "O fundo agrupa as posições e o resultado do cliente.",
      help: "Abra o cliente recém-criado, vá na aba Fundos e clique em \"Novo fundo\". Defina nome (ex: \"Fundo Cripto\"), data de início e a taxa de performance. Cada cliente pode ter vários fundos.",
      icon: Wallet,
      done: state.hasFund,
      cta: clientId
        ? { label: "Abrir cliente", to: "/admin/clientes/$clientId", params: { clientId } }
        : { label: "Ir para Clientes", to: "/admin/clientes" },
    },
    {
      key: "deposit",
      title: "Registrar o depósito inicial (USD)",
      description: "Lance o aporte do cliente para formar o caixa.",
      help: "Dentro do cliente, abra a aba Caixa e adicione um Depósito em USD. Esse valor forma o caixa disponível e entra no cálculo de patrimônio.",
      icon: DollarSign,
      done: state.hasDeposit,
      cta: clientId
        ? { label: "Abrir Caixa", to: "/admin/clientes/$clientId", params: { clientId } }
        : { label: "Ir para Clientes", to: "/admin/clientes" },
    },
    {
      key: "holding",
      title: "Adicionar a primeira posição",
      description: "Lance uma compra de cripto, renda fixa ou futuros.",
      help: "Abra o fundo do cliente e adicione uma posição: ticker (ex: BTC), quantidade e preço de entrada em USD. O sistema calcula automaticamente o P&L com base na cotação atual.",
      icon: Coins,
      done: state.hasHolding,
      cta:
        clientId && fundId
          ? {
              label: "Abrir fundo",
              to: "/admin/clientes/$clientId/fundos/$fundId",
              params: { clientId, fundId },
            }
          : clientId
            ? { label: "Abrir cliente", to: "/admin/clientes/$clientId", params: { clientId } }
            : { label: "Ir para Clientes", to: "/admin/clientes" },
    },
    {
      key: "prices",
      title: "Atualizar cotações",
      description: "Garanta que os preços de mercado estão recentes.",
      help: "Em Cotações, clique em \"Atualizar agora\" para puxar os preços mais recentes. Recomendamos atualizar pelo menos 1x por dia — o painel avisa quando algo está desatualizado há mais de 24h.",
      icon: RefreshCw,
      done: state.pricesFresh,
      cta: { label: "Ir para Cotações", to: "/admin/cotacoes" },
    },
    {
      key: "preview",
      title: "Conferir o que o cliente vê",
      description: "Abra o painel do cliente em outra aba para validar.",
      help: "Acesse /app em uma aba anônima usando as credenciais do cliente, ou peça para ele logar. Confira se patrimônio, posições e extrato batem com o que você lançou.",
      icon: Eye,
      done: false,
      cta: { label: "Abrir painel do cliente", href: "/app" },
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const allDone = doneCount === total;
  const firstPendingKey = steps.find((s) => !s.done)?.key;

  if (dismissed) {
    return (
      <button
        type="button"
        onClick={() => {
          localStorage.removeItem(DISMISS_KEY);
          setDismissed(false);
        }}
        className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
      >
        <Sparkles className="h-3 w-3" />
        Ver guia inicial ({doneCount}/{total})
      </button>
    );
  }

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Comece por aqui
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {allDone
                ? "Tudo pronto. Você já passou por todos os passos essenciais."
                : "Siga os passos abaixo para colocar a operação no ar."}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              localStorage.setItem(DISMISS_KEY, "1");
              setDismissed(true);
            }}
            aria-label="Ocultar guia"
            className="h-7 w-7 p-0"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Progress bar */}
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-mono">
              {doneCount} de {total}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(doneCount / total) * 100}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isCurrent = !step.done && step.key === firstPendingKey;
          const helpOpen = expandedHelp === step.key;

          return (
            <div
              key={step.key}
              className={cn(
                "rounded-lg border p-3 transition-all",
                step.done && "border-border/40 bg-muted/20 opacity-70",
                isCurrent && "border-primary/40 bg-primary/5",
                !step.done && !isCurrent && "border-border/60",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 pt-0.5">
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <Circle
                      className={cn(
                        "h-5 w-5",
                        isCurrent ? "text-primary" : "text-muted-foreground/50",
                      )}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <h3
                      className={cn(
                        "text-sm font-medium",
                        step.done && "line-through text-muted-foreground",
                      )}
                    >
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>

                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {!step.done &&
                      (step.cta.href ? (
                        <Button asChild size="sm" variant={isCurrent ? "default" : "outline"} className="h-7 text-xs">
                          <a href={step.cta.href} target="_blank" rel="noopener noreferrer">
                            {step.cta.label}
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </a>
                        </Button>
                      ) : (
                        <Button
                          asChild
                          size="sm"
                          variant={isCurrent ? "default" : "outline"}
                          className="h-7 text-xs"
                        >
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          <Link to={step.cta.to as any} params={step.cta.params as any}>
                            {step.cta.label}
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      ))}
                    <button
                      type="button"
                      onClick={() => setExpandedHelp(helpOpen ? null : step.key)}
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      Como faço?
                      {helpOpen ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                  </div>

                  {helpOpen && (
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed bg-muted/30 rounded p-2">
                      {step.help}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {allDone && (
          <Button
            className="w-full mt-2"
            onClick={() => {
              localStorage.setItem(DISMISS_KEY, "1");
              setDismissed(true);
            }}
          >
            Concluir guia
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function reopenOnboarding() {
  window.dispatchEvent(new CustomEvent(REOPEN_EVENT));
}
