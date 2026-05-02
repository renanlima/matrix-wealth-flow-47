## Objetivo

Aplicar **máscara monetária USD** (`$ 1,234.56`, formato US) em todos os campos de valor dos formulários de admin, mantendo a gravação como `numeric` em USD no banco. Sem mudanças de schema.

## Comportamento da máscara

- Enquanto digita: insere separador de milhar automaticamente, aceita apenas dígitos + um `.` decimal, máximo 2 casas (ou 8 para preço de cripto).
- Mostra prefixo `$` cinza dentro do input (ícone à esquerda).
- Cola/digita "1234.5" → exibe `$ 1,234.50`.
- Backspace funciona naturalmente (remove caractere por caractere).
- No submit, manda `Number(unmasked)` para o Supabase — exatamente como hoje.
- Vazio = vazio (não força `$ 0.00`).

## Componente novo: `MoneyInput`

Arquivo: `src/components/ui/money-input.tsx`

Props:
- `value: string` (sempre a string formatada exibida)
- `onValueChange(raw: string, numeric: number)`
- `decimals?: number` (default 2; usar 8 para `entry_price_usd` cripto)
- `currency?: "USD"` (preparado para futuro, mas hoje fixo)
- demais props do `Input` do shadcn

Implementação:
- Wrapper sobre o `<Input>` existente (mantém estilo neon do projeto).
- Função `formatUSD(raw, decimals)` usa `Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: decimals })`.
- Prefixo `$` via `<span className="absolute left-3 ...">` + `pl-7` no input.
- `inputMode="decimal"` para teclado numérico no mobile; `type="text"` (não `number`, porque `number` não aceita vírgulas).

## Onde aplicar (8 campos no total)

1. **`admin.clientes.$clientId.fundos.$fundId.tsx`**
   - "Nova posição" → Quantidade (sem máscara, fica como está — é cripto, não USD), **Preço entrada (USD)** ← `MoneyInput decimals={8}`.
   - "Vender posição" → **Preço saída (USD)** ← `MoneyInput decimals={8}`.
2. **`admin.clientes.$clientId.index.tsx`**
   - Diálogo Depósito → **Valor (USD)** ← `MoneyInput decimals={2}`.
   - Diálogo Saque → **Valor (USD)** ← `MoneyInput decimals={2}`.
3. **`components/admin/FixedIncomeTab.tsx`**
   - **Valor aplicado (USD)** ← `MoneyInput decimals={2}`.
   - **Preço entrada (opcional)** ← `MoneyInput decimals={8}`.
   - Taxa anual (%) **fica como está** — é percentual, não moeda.
4. **`components/admin/DocumentsTab.tsx`**
   - **Valor (USD)** do recibo ← `MoneyInput decimals={2}`.

Campos que **não** mudam:
- Quantidade de cripto (é unidade da moeda, ex.: 0.005 BTC).
- Taxa de performance (%) e taxa anual (%).
- Ano/mês de relatórios.

## Detalhe de implementação

```ts
// money-input.tsx — núcleo
function maskUsd(input: string, decimals = 2): { display: string; numeric: number } {
  // 1. remove tudo que não é dígito ou '.'
  const cleaned = input.replace(/[^\d.]/g, "");
  // 2. mantém só o primeiro '.'
  const [int, dec = ""] = cleaned.split(".");
  const decTrimmed = dec.slice(0, decimals);
  // 3. formata parte inteira com vírgulas
  const intFmt = int ? Number(int).toLocaleString("en-US") : "";
  const display = decTrimmed || cleaned.includes(".")
    ? `${intFmt}.${decTrimmed}`
    : intFmt;
  const numeric = Number(`${int || "0"}.${decTrimmed || "0"}`);
  return { display, numeric };
}
```

Nos forms atuais o estado é `string`. O `MoneyInput` mantém isso — só troca a função de formatação. Submit segue chamando `Number(form.amount)` (que agora vem da string crua, não da formatada — guardo as duas).

Padrão de uso:
```tsx
const [amount, setAmount] = useState({ display: "", numeric: 0 });
<MoneyInput
  value={amount.display}
  onValueChange={(d, n) => setAmount({ display: d, numeric: n })}
  decimals={2}
  required
/>
// no submit:
.insert({ amount_usd: amount.numeric })
```

## Ordem de execução

1. Criar `src/components/ui/money-input.tsx` + testes manuais (digitar, colar, backspace, decimais).
2. Refatorar os 8 campos listados.
3. Validar que cada submit grava o número correto no banco (sem vírgulas).

Posso seguir?
