# Matrix Digital Assets — Plano

## Rodada 2 — TODAS as fases concluídas ✅

### Fase 1 (Backend) ✅
- Views `client_funds` / `client_performance_history` (sem taxas)
- Storage RLS (contracts/receipts/invoices/futures/mural)
- Edge `close-monthly-performance`
- pg_cron (preços, fx, fechamento mensal)

### Fase 2 (Admin) ✅
- Sub-tabs: Rendimentos Alternativos, Futuros, Documentos (3 abas), Performance Mensal
- Aba Histórico no detalhe do fundo (admin vê taxas)
- /admin/cotacoes com 3 botões + edge `update-fixed-income-prices` + cron diário

### Fase 3 (Cliente + PDF) ✅
- /app/rendimentos — fixed_income com KPIs (sem taxas)
- /app/futuros — galeria com lightbox via signed URLs
- /app/documentos — Contratos / Recibos / NFs com download
- /app/relatorios — histórico, gráfico de evolução e exportação PDF (jspdf + html2canvas) com logo, KPIs, posições e rendimentos
- src/lib/pdf.ts — helper de geração multi-página
