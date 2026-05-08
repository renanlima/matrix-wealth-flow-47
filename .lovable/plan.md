## Objetivo

Permitir "resetar" o guia inicial para começar do zero, sem mexer em dados reais. O reset funciona de duas formas:

1. **Botão manual** em Configurações → "Resetar guia inicial".
2. **Automático no modo DEMO**: quando o DEMO está ligado, o guia ignora o progresso real e mostra todos os passos como pendentes (bom pra demonstração ao vivo).

## Como vai funcionar

- Novo flag em `localStorage`: `admin_onboarding_reset_at` (timestamp).
- Quando esse flag existe **ou** o modo DEMO está ativo, o `OnboardingGuide` força todos os `done = false` no estado derivado, ignorando os dados reais.
- O flag é limpo quando o admin clicar em "Concluir guia" ou no X (volta ao comportamento normal baseado em dados).
- Reabrir o guia (botão Guia no header) continua igual — só desfaz o "dispensado".

## Mudanças

**1. `src/components/admin/OnboardingGuide.tsx`**
- Importar `useDemo`.
- Ler `localStorage.getItem("admin_onboarding_reset_at")` no estado inicial e escutar `storage` event pra sincronizar.
- Calcular `forcePending = demo || resetActive`.
- Ao montar `steps`, se `forcePending` → `done: false` em todos.
- Mostrar um aviso discreto no topo do card quando `forcePending`: "Modo demonstração — passos exibidos como pendentes" (texto pequeno, `text-muted-foreground`).
- Ao clicar "Concluir guia" ou X → também limpar `admin_onboarding_reset_at`.

**2. `src/routes/admin.configuracoes.tsx`**
- Adicionar nova seção "Guia inicial" com:
  - Botão **"Resetar guia"** → seta `admin_onboarding_reset_at = Date.now()`, remove `admin_onboarding_dismissed`, dispara `reopen-onboarding`, navega pra `/admin`, mostra `toast.success("Guia resetado")`.
  - Texto explicativo: "Mostra todos os passos como pendentes de novo, sem apagar nenhum dado. Útil pra revisar o fluxo ou treinar alguém."
  - Indicador do estado atual ("Reset ativo desde …" se houver flag).
  - Botão secundário **"Voltar ao normal"** (aparece só se reset estiver ativo) → limpa o flag.

**3. `src/contexts/DemoContext.tsx`**
- Sem mudanças funcionais. O `OnboardingGuide` apenas lê `useDemo()` e reage.

## Não muda

- Lógica de `fetchAdminStats` e dados reais — continuam intactos.
- Botão "Guia" do header.
- Conteúdo dos passos, ícones, CTAs.
- Banco de dados.

## Resultado

- Em **Configurações → Guia inicial**, o admin clica em "Resetar guia" e o checklist volta a aparecer 0/6 no dashboard.
- Ao ligar o **Modo DEMO**, o guia automaticamente fica 0/6 também — perfeito pra demonstrar o fluxo do zero numa apresentação.
- Nenhum dado real é tocado em nenhum dos dois casos.