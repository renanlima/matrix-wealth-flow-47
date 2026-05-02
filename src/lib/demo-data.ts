// Dataset demonstrativo determinístico (overlay visual, não toca o banco)
// Gera ~3 meses de operações otimistas para 3 clientes / 4 fundos / ~15 ativos.

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CLIENT_IDS = ["demo-c1", "demo-c2", "demo-c3"] as const;
const CLIENT_PROFILES = [
  { id: "demo-c1", full_name: "Mariana Souza", email: "mariana@aurora.demo", phone: "+55 11 99876-1234", company: "Aurora Capital" },
  { id: "demo-c2", full_name: "Carlos Mendes", email: "carlos@blueridge.demo", phone: "+55 21 98123-4567", company: "BlueRidge Wealth" },
  { id: "demo-c3", full_name: "Fernanda Lopes", email: "fernanda@helix.demo", phone: "+55 31 97456-8899", company: "Helix Family Office" },
];

const FUNDS = [
  { id: "demo-f1", client_id: "demo-c1", name: "Aurora Cripto Core" },
  { id: "demo-f2", client_id: "demo-c1", name: "Aurora RF USD" },
  { id: "demo-f3", client_id: "demo-c2", name: "BlueRidge Hedge Fund" },
  { id: "demo-f4", client_id: "demo-c3", name: "Helix Diversificado" },
];

interface Coin {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
}

const COINS: Coin[] = [
  { symbol: "BTC", name: "Bitcoin", price: 92450, change24h: 2.3 },
  { symbol: "ETH", name: "Ethereum", price: 3380, change24h: 1.8 },
  { symbol: "SOL", name: "Solana", price: 198, change24h: 4.5 },
  { symbol: "BNB", name: "BNB", price: 612, change24h: 0.9 },
  { symbol: "AVAX", name: "Avalanche", price: 41.2, change24h: -1.4 },
  { symbol: "LINK", name: "Chainlink", price: 17.8, change24h: 3.1 },
  { symbol: "MATIC", name: "Polygon", price: 0.74, change24h: 2.7 },
  { symbol: "ARB", name: "Arbitrum", price: 1.12, change24h: 5.2 },
  { symbol: "DOT", name: "Polkadot", price: 7.45, change24h: -2.1 },
  { symbol: "ADA", name: "Cardano", price: 0.62, change24h: 1.4 },
  { symbol: "OP", name: "Optimism", price: 2.31, change24h: 6.8 },
  { symbol: "INJ", name: "Injective", price: 28.9, change24h: 4.1 },
];

interface Holding {
  id: string;
  fund_id: string;
  client_id: string;
  coin_symbol: string;
  coin_name: string;
  quantity: number;
  entry_price_usd: number;
  current_price_usd: number;
  market_value: number;
  cost: number;
  pnl: number;
  pct: number;
}

interface Realization {
  exit_date: string; // YYYY-MM-DD
  total_usd: number;
  profit_usd: number;
  client_id: string;
  coin: string;
}

interface CashFlow {
  client_id: string;
  date: string;
  amount: number;
  kind: "deposit" | "withdrawal";
}

export interface DemoDataset {
  clients: typeof CLIENT_PROFILES;
  funds: typeof FUNDS;
  coins: Coin[];
  holdings: Holding[];
  realizations: Realization[];
  cashflow: CashFlow[];
  generatedAt: string;
}

const HOLDING_PLAN: { fund_id: string; coin: string; baseQty: number }[] = [
  { fund_id: "demo-f1", coin: "BTC", baseQty: 1.85 },
  { fund_id: "demo-f1", coin: "ETH", baseQty: 22 },
  { fund_id: "demo-f1", coin: "SOL", baseQty: 280 },
  { fund_id: "demo-f1", coin: "LINK", baseQty: 1800 },
  { fund_id: "demo-f3", coin: "BTC", baseQty: 0.95 },
  { fund_id: "demo-f3", coin: "ETH", baseQty: 14 },
  { fund_id: "demo-f3", coin: "AVAX", baseQty: 950 },
  { fund_id: "demo-f3", coin: "ARB", baseQty: 22000 },
  { fund_id: "demo-f3", coin: "OP", baseQty: 8500 },
  { fund_id: "demo-f4", coin: "BTC", baseQty: 0.62 },
  { fund_id: "demo-f4", coin: "ETH", baseQty: 9 },
  { fund_id: "demo-f4", coin: "SOL", baseQty: 110 },
  { fund_id: "demo-f4", coin: "MATIC", baseQty: 28000 },
  { fund_id: "demo-f4", coin: "DOT", baseQty: 1400 },
  { fund_id: "demo-f4", coin: "INJ", baseQty: 95 },
];

const datasetCache = new Map<number, DemoDataset>();

export function generateDemoData(seed: number): DemoDataset {
  if (datasetCache.has(seed)) return datasetCache.get(seed)!;

  const rng = mulberry32(seed);
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  // Holdings com entry price favorável (preço atual ~+15-25% acima)
  const holdings: Holding[] = HOLDING_PLAN.map((h, idx) => {
    const coin = COINS.find((c) => c.symbol === h.coin)!;
    // Variação: ~85% das posições com lucro 8%-30%, 1-2 com -3% a -6%
    const isLoser = idx === 4 || idx === 11;
    const factor = isLoser ? 1 + 0.03 + rng() * 0.03 : 1 / (1 + 0.08 + rng() * 0.22);
    const entry = +(coin.price * factor).toFixed(coin.price < 1 ? 4 : 2);
    const qty = +(h.baseQty * (0.92 + rng() * 0.16)).toFixed(coin.price > 1000 ? 3 : 2);
    const market = qty * coin.price;
    const cost = qty * entry;
    const fund = FUNDS.find((f) => f.id === h.fund_id)!;
    return {
      id: `demo-h${idx + 1}`,
      fund_id: h.fund_id,
      client_id: fund.client_id,
      coin_symbol: coin.symbol,
      coin_name: coin.name,
      quantity: qty,
      entry_price_usd: entry,
      current_price_usd: coin.price,
      market_value: market,
      cost,
      pnl: market - cost,
      pct: ((market - cost) / cost) * 100,
    };
  });

  // Cashflow 90 dias: ~12 depósitos + ~5 saques
  const cashflow: CashFlow[] = [];
  const depositAmounts = [180000, 50000, 120000, 75000, 220000, 90000, 45000, 60000, 150000, 35000, 110000, 80000];
  for (let i = 0; i < depositAmounts.length; i++) {
    const dayOffset = Math.floor(rng() * 88) + 1;
    const d = new Date(today.getTime() - dayOffset * 86400000);
    cashflow.push({
      client_id: CLIENT_IDS[i % 3],
      date: iso(d),
      amount: depositAmounts[i],
      kind: "deposit",
    });
  }
  const withdrawals = [25000, 18000, 40000, 12000, 30000];
  for (let i = 0; i < withdrawals.length; i++) {
    const dayOffset = Math.floor(rng() * 80) + 5;
    const d = new Date(today.getTime() - dayOffset * 86400000);
    cashflow.push({
      client_id: CLIENT_IDS[i % 3],
      date: iso(d),
      amount: withdrawals[i],
      kind: "withdrawal",
    });
  }

  // Realizações: 6 saídas com lucro nos últimos 90 dias
  const realPlans = [
    { coin: "SOL", base: 35000, profitPct: 0.18 },
    { coin: "BTC", base: 88000, profitPct: 0.12 },
    { coin: "ETH", base: 42000, profitPct: 0.21 },
    { coin: "ARB", base: 18000, profitPct: 0.25 },
    { coin: "LINK", base: 28000, profitPct: 0.16 },
    { coin: "AVAX", base: 22000, profitPct: 0.09 },
  ];
  const realizations: Realization[] = realPlans.map((r, i) => {
    const dayOffset = Math.floor(rng() * 85) + 3;
    const d = new Date(today.getTime() - dayOffset * 86400000);
    const total = r.base * (0.9 + rng() * 0.2);
    return {
      exit_date: iso(d),
      total_usd: +total.toFixed(2),
      profit_usd: +(total * r.profitPct).toFixed(2),
      client_id: CLIENT_IDS[i % 3],
      coin: r.coin,
    };
  });

  const dataset: DemoDataset = {
    clients: CLIENT_PROFILES,
    funds: FUNDS,
    coins: COINS,
    holdings,
    realizations,
    cashflow,
    generatedAt: today.toISOString(),
  };
  datasetCache.set(seed, dataset);
  return dataset;
}

// ---------------- Adapters para shapes esperados pelas telas ----------------

export interface DemoStats {
  clientCount: number;
  aumUsd: number;
  cashUsd: number;
  unrealizedPnl: number;
  unrealizedPct: number;
  realizedMtd: number;
  netFlow30d: number;
  activeHoldings: number;
  lastPriceUpdate: string | null;
  staleCoins: number;
  recentErrors: number;
  aumByClient: { name: string; value: number }[];
  coinDistribution: { name: string; value: number }[];
  cashFlow90d: { date: string; deposits: number; withdrawals: number }[];
  topMovers: { client: string; coin: string; pnl: number; pct: number }[];
  inactiveClients: number;
  firstClientId: string | null;
  firstFundId: string | null;
  hasDeposit: boolean;
  pricesFresh: boolean;
}

export function getDemoStats(seed: number): DemoStats {
  const d = generateDemoData(seed);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const days30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);

  const totalMarket = d.holdings.reduce((s, h) => s + h.market_value, 0);
  const totalCost = d.holdings.reduce((s, h) => s + h.cost, 0);
  const totalDep = d.cashflow.filter((c) => c.kind === "deposit").reduce((s, c) => s + c.amount, 0);
  const totalWd = d.cashflow.filter((c) => c.kind === "withdrawal").reduce((s, c) => s + c.amount, 0);
  const totalReal = d.realizations.reduce((s, r) => s + r.total_usd, 0);
  const cashUsd = totalDep - totalWd - totalCost + totalReal;

  // AUM por cliente
  const aumByClientMap = new Map<string, number>();
  for (const h of d.holdings) {
    aumByClientMap.set(h.client_id, (aumByClientMap.get(h.client_id) ?? 0) + h.market_value);
  }
  for (const c of d.cashflow) {
    const sign = c.kind === "deposit" ? 1 : -1;
    aumByClientMap.set(c.client_id, (aumByClientMap.get(c.client_id) ?? 0) + sign * c.amount);
  }
  const aumByClient = d.clients
    .map((c) => ({ name: c.full_name, value: aumByClientMap.get(c.id) ?? 0 }))
    .sort((a, b) => b.value - a.value);

  // Distribuição por moeda
  const coinMap = new Map<string, number>();
  for (const h of d.holdings) {
    coinMap.set(h.coin_symbol, (coinMap.get(h.coin_symbol) ?? 0) + h.market_value);
  }
  const coinDistribution = [...coinMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Cashflow 90d
  const flowMap = new Map<string, { deposits: number; withdrawals: number }>();
  for (const c of d.cashflow) {
    const cur = flowMap.get(c.date) ?? { deposits: 0, withdrawals: 0 };
    if (c.kind === "deposit") cur.deposits += c.amount;
    else cur.withdrawals += c.amount;
    flowMap.set(c.date, cur);
  }
  const cashFlow90d = [...flowMap.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Top movers
  const moverMap = new Map<string, { client: string; coin: string; pnl: number; cost: number; market: number }>();
  for (const h of d.holdings) {
    const key = `${h.client_id}|${h.coin_symbol}`;
    const cli = d.clients.find((c) => c.id === h.client_id)!.full_name;
    const cur = moverMap.get(key);
    if (cur) {
      cur.cost += h.cost;
      cur.market += h.market_value;
      cur.pnl = cur.market - cur.cost;
    } else {
      moverMap.set(key, { client: cli, coin: h.coin_symbol, cost: h.cost, market: h.market_value, pnl: h.pnl });
    }
  }
  const topMovers = [...moverMap.values()]
    .map((m) => ({ client: m.client, coin: m.coin, pnl: m.pnl, pct: (m.pnl / m.cost) * 100 }))
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
    .slice(0, 5);

  const realizedMtd = d.realizations
    .filter((r) => r.exit_date >= startOfMonth)
    .reduce((s, r) => s + r.profit_usd, 0);

  const dep30 = d.cashflow
    .filter((c) => c.kind === "deposit" && c.date >= days30)
    .reduce((s, c) => s + c.amount, 0);
  const wd30 = d.cashflow
    .filter((c) => c.kind === "withdrawal" && c.date >= days30)
    .reduce((s, c) => s + c.amount, 0);

  return {
    clientCount: d.clients.length,
    aumUsd: totalMarket + cashUsd,
    cashUsd,
    unrealizedPnl: totalMarket - totalCost,
    unrealizedPct: totalCost > 0 ? ((totalMarket - totalCost) / totalCost) * 100 : 0,
    realizedMtd,
    netFlow30d: dep30 - wd30,
    activeHoldings: d.holdings.length,
    lastPriceUpdate: new Date(now.getTime() - 2 * 60_000).toISOString(),
    staleCoins: 0,
    recentErrors: 0,
    aumByClient: aumByClient.slice(0, 10),
    coinDistribution: coinDistribution.slice(0, 8),
    cashFlow90d,
    topMovers,
    inactiveClients: 0,
    firstClientId: d.clients[0].id,
    firstFundId: d.funds[0].id,
    hasDeposit: true,
    pricesFresh: true,
  };
}

export interface DemoClientRow {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  created_at: string;
}

export function getDemoClients(seed: number): DemoClientRow[] {
  const d = generateDemoData(seed);
  const now = Date.now();
  return d.clients.map((c, i) => ({
    id: c.id,
    full_name: c.full_name,
    email: c.email,
    phone: c.phone,
    created_at: new Date(now - (60 + i * 30) * 86400000).toISOString(),
  }));
}

export function getDemoPrices(seed: number) {
  const d = generateDemoData(seed);
  const now = new Date();
  return {
    prices: d.coins.map((c, i) => ({
      symbol: c.symbol,
      name: c.name,
      price_usd: c.price,
      percent_change_24h: c.change24h,
      updated_at: new Date(now.getTime() - (i + 1) * 60_000).toISOString(),
    })),
    fxRate: { rate: 5.4321, updated_at: new Date(now.getTime() - 30 * 60_000).toISOString() },
  };
}
