# Matrix Digital Assets — Plano

## Rodada 2 — Fase 2 (Telas Admin) ✅ CONCLUÍDA

### Implementado
- **Sub-tab Rendimentos Alternativos**: CRUD de fixed_income por fundo, com cálculo de rendimento atual, encerramento e KPIs.
- **Sub-tab Mercado Futuro**: galeria de prints (PDF/JPG/PNG) com upload, lightbox e remoção via storage.
- **Sub-tab Documentos** (3 abas internas):
  - Contratos versionados (versão sempre +1, ativação automática da última)
  - Recibos com data e valor opcional
  - Notas Fiscais com período
- **Sub-tab Performance Mensal**: lista performance_history e dispara `close-monthly-performance` por mês/ano.
- **Aba Histórico no detalhe do fundo**: tabela admin completa com taxa, déficit, base de cálculo (visão sensível).
- **/admin/cotacoes**: 3 botões separados — Cripto, Câmbio, Rend. Alternativos.
- **Edge function nova**: `update-fixed-income-prices` (yield acumulado anual) + cron 10:10 UTC.
- **Helper**: `src/lib/upload.ts` com validação 5MB / PDF·JPG·PNG / signed URLs TTL 1h.

### Próximo (Fase 3 — Cliente / PDF)
- Telas /app/rendimentos, /app/futuros, /app/documentos consumindo as views públicas (sem taxas)
- /app/relatorios — geração de PDF mensal (jspdf + html2canvas) com performance, posições, fixed income
- Verificar que cliente NUNCA enxerga taxa_aplicada/carried_deficit
