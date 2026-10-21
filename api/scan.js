const ASSETS = (process.env.ASSETS || "USDT,BTC,ETH,BNB,SOL,XRP,ADA,DOGE,USDC,FDUSD").split(",").map(x => x.trim().toUpperCase()).filter(Boolean);
const START_USDT = Number(process.env.START_USDT || 25);
const FEE_RATE = Number(process.env.FEE_RATE || 0.001);
const SLIPPAGE_BUFFER_PCT = Number(process.env.SLIPPAGE_BUFFER_PCT || 0.05);
const MIN_NET_PROFIT_PCT = Number(process.env.MIN_NET_PROFIT_PCT || 0.2);
const MAX_ALERTS_PER_RUN = Number(process.env.MAX_ALERTS_PER_RUN || 3);
const COOLDOWN_SECONDS = Number(process.env.COOLDOWN_SECONDS || 300);

module.exports = async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) { res.setHeader("Allow", "GET, POST"); return res.status(405).json({ error: "Method not allowed" }); }
  const secret = process.env.CRON_SECRET;
  if (!secret || (req.headers.authorization || "") !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return res.status(500).json({ error: "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID" });
  if (!(FEE_RATE >= 0 && FEE_RATE < 1) || !(START_USDT > 0)) return res.status(500).json({ error: "Invalid START_USDT or FEE_RATE" });

  try {
    const [binance, bybit] = await Promise.all([fetchBinanceMarkets(), fetchBybitMarkets()]);
    const opportunities = [...findTriangles(binance, "Binance"), ...findTriangles(bybit, "Bybit")].sort((a, b) => b.netPct - a.netPct);
    const eligible = opportunities.filter(op => op.netPct >= MIN_NET_PROFIT_PCT);
    let sent = 0, skippedCooldown = 0;
    const alertErrors = [];
    for (const op of eligible) {
      if (sent >= MAX_ALERTS_PER_RUN) break;
      if (!(await acquireCooldown(op))) { skippedCooldown++; continue; }
      try { await sendTelegram(botToken, chatId, formatOpportunity(op)); sent++; }
      catch (error) { alertErrors.push(String(error.message || error)); }
    }
    return res.status(200).json({ ok: true, exchanges: { Binance: binance.length, Bybit: bybit.length }, routesChecked: opportunities.length, opportunitiesAboveThreshold: eligible.length, alertsSent: sent, skippedCooldown, alertErrors });
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: "Market scan failed", detail: String(error.message || error) });
  }
};

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": "triangle-arb-scanner/1.0" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
  return response.json();
}
async function fetchBinanceMarkets() {
  const data = await fetchJson("https://api.binance.com/api/v3/ticker/bookTicker");
  return parseKnownPairs(data.map(x => ({ symbol: x.symbol, bid: Number(x.bidPrice), ask: Number(x.askPrice) })));
}
async function fetchBybitMarkets() {
  const data = await fetchJson("https://api.bybit.com/v5/market/tickers?category=spot");
  if (data.retCode !== 0 || !data.result || !Array.isArray(data.result.list)) throw new Error("Unexpected response from Bybit public API");
  return parseKnownPairs(data.result.list.map(x => ({ symbol: x.symbol, bid: Number(x.bid1Price), ask: Number(x.ask1Price) })));
}
function parseKnownPairs(raw) {
  const bySymbol = new Map();
  for (const item of raw) if (item.symbol && item.bid > 0 && item.ask > 0) bySymbol.set(item.symbol, item);
  const markets = [];
  for (const base of ASSETS) for (const quote of ASSETS) {
    if (base === quote) continue;
    const symbol = base + quote, item = bySymbol.get(symbol);
    if (item) markets.push({ symbol, base, quote, bid: item.bid, ask: item.ask });
  }
  return markets;
}
function findTriangles(markets, exchange) {
  const graph = new Map();
  const addEdge = (from, to, rate, market) => { if (!graph.has(from)) graph.set(from, []); graph.get(from).push({ from, to, rate, market }); };
  for (const market of markets) {
    addEdge(market.base, market.quote, market.bid, market);
    addEdge(market.quote, market.base, 1 / market.ask, market);
  }
  const found = new Map();
  for (const first of graph.get("USDT") || []) {
    if (first.to === "USDT") continue;
    for (const second of graph.get(first.to) || []) {
      if (second.to === "USDT" || second.to === first.to) continue;
      for (const third of graph.get(second.to) || []) {
        if (third.to !== "USDT") continue;
        const edges = [first, second, third];
        const grossFactor = edges.reduce((acc, edge) => acc * edge.rate, 1);
        const netPct = (grossFactor * Math.pow(1 - FEE_RATE, 3) - 1) * 100 - SLIPPAGE_BUFFER_PCT;
        const routeKey = edges.map(e => `${e.from}>${e.to}:${e.market.symbol}`).join("|");
        const op = { exchange, edges, routeKey, netPct, endUSDT: START_USDT * (1 + netPct / 100) };
        if (!found.has(routeKey) || found.get(routeKey).netPct < netPct) found.set(routeKey, op);
      }
    }
  }
  return [...found.values()];
}
async function acquireCooldown(op) {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return true;
  const key = `triangle-arb:alert:${op.exchange}:${hash(op.routeKey)}`;
  const response = await fetch(`${url.replace(/\/$/, "")}/set/${encodeURIComponent(key)}/1?EX=${COOLDOWN_SECONDS}&NX`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Cooldown storage request failed");
  return (await response.json()).result === "OK";
}
function hash(value) { let h = 2166136261; for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
async function sendTelegram(token, chatId, text) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }) });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(`Telegram API error: ${result.description || response.status}`);
}
function formatOpportunity(op) {
  const route = op.edges.map(edge => edge.from).concat("USDT").join(" → ");
  const lines = [`🔎 Треугольный арбитраж — ${op.exchange} Spot`, `Маршрут: ${route}`, `Стартовая сумма: ${START_USDT.toFixed(2)} USDT`, `Расчётная сумма после комиссий/буфера: ${op.endUSDT.toFixed(4)} USDT`, `Оценочная доходность: ${op.netPct >= 0 ? "+" : ""}${op.netPct.toFixed(3)}%`, "", "Котировки:"];
  op.edges.forEach((edge, index) => lines.push(`${index + 1}) ${edge.from} → ${edge.to} | ${edge.market.symbol} | bid ${edge.market.bid} / ask ${edge.market.ask}`));
  lines.push("", "⚠️ Оценка по лучшим bid/ask, не гарантия исполнения. Проверь комиссии, глубину стакана, лимиты и округление. Бот не торгует.");
  return lines.join("\n");
}
