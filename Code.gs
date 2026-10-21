/**
 * Triangle arbitrage alert scanner for Binance Spot + Bybit Spot.
 * Runs in Google Apps Script. No local Python and no exchange trading keys.
 * Public market data only. It does NOT place orders.
 *
 * IMPORTANT: Configure the Telegram token and chat ID only in your private
 * Apps Script project. Never commit real credentials to a public repository.
 */

const CONFIG = {
  TELEGRAM_TOKEN: "PASTE_TELEGRAM_BOT_TOKEN_HERE",
  CHAT_ID: "PASTE_NUMERIC_CHAT_ID_HERE",
  START_USDT: 25,
  FEE_RATE: 0.001,              // 0.1% per leg; change to your actual fee tier
  SLIPPAGE_BUFFER_PCT: 0.05,    // percentage points deducted from estimated net return
  MIN_NET_PROFIT_PCT: 0.20,     // alert threshold after estimated fees and buffer
  ALERT_COOLDOWN_MINUTES: 5,
  MAX_ALERTS_PER_RUN: 5,
  ASSETS: ["USDT", "BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE", "USDC", "FDUSD"]
};

function scanMarkets() {
  validateConfig_();

  const markets = fetchBinanceMarkets_().concat(fetchBybitMarkets_());
  const opportunities = [];

  ["Binance", "Bybit"].forEach(exchange => {
    const exchangeMarkets = markets.filter(m => m.exchange === exchange);
    const graph = buildGraph_(exchangeMarkets);
    findTriangles_(graph, exchange).forEach(op => opportunities.push(op));
  });

  opportunities.sort((a, b) => b.netPct - a.netPct);
  const props = PropertiesService.getScriptProperties();
  let sent = 0;

  opportunities.forEach(op => {
    if (sent >= CONFIG.MAX_ALERTS_PER_RUN || op.netPct < CONFIG.MIN_NET_PROFIT_PCT) return;
    const key = "alert_" + op.exchange + "_" + op.routeKey;
    const last = Number(props.getProperty(key) || "0");
    if (Date.now() - last < CONFIG.ALERT_COOLDOWN_MINUTES * 60 * 1000) return;

    sendTelegram_(formatOpportunity_(op));
    props.setProperty(key, String(Date.now()));
    sent++;
  });

  console.log("Markets: " + markets.length +
    "; estimated routes: " + opportunities.length + "; alerts sent: " + sent);
}

function fetchBinanceMarkets_() {
  const url = "https://api.binance.com/api/v3/ticker/bookTicker";
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    throw new Error("Binance API error: " + response.getResponseCode());
  }
  const data = JSON.parse(response.getContentText());
  return parseKnownPairs_(data.map(x => ({
    exchange: "Binance",
    symbol: x.symbol,
    bid: Number(x.bidPrice),
    ask: Number(x.askPrice)
  })));
}

function fetchBybitMarkets_() {
  const url = "https://api.bybit.com/v5/market/tickers?category=spot";
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    throw new Error("Bybit API error: " + response.getResponseCode());
  }
  const json = JSON.parse(response.getContentText());
  if (json.retCode !== 0 || !json.result || !json.result.list) {
    throw new Error("Bybit API returned an error: " +
      response.getContentText().slice(0, 300));
  }
  return parseKnownPairs_(json.result.list.map(x => ({
    exchange: "Bybit",
    symbol: x.symbol,
    bid: Number(x.bid1Price),
    ask: Number(x.ask1Price)
  })));
}

function parseKnownPairs_(raw) {
  const symbols = {};
  raw.forEach(x => {
    if (x.symbol && x.bid > 0 && x.ask > 0) symbols[x.symbol] = x;
  });

  const result = [];
  CONFIG.ASSETS.forEach(base => {
    CONFIG.ASSETS.forEach(quote => {
      if (base === quote) return;
      const symbol = base + quote;
      const market = symbols[symbol];
      if (market) {
        result.push({
          exchange: market.exchange,
          symbol: symbol,
          base: base,
          quote: quote,
          bid: market.bid,
          ask: market.ask
        });
      }
    });
  });
  return result;
}

function buildGraph_(markets) {
  const graph = {};

  function addEdge(from, to, rate, market, direction) {
    if (!graph[from]) graph[from] = [];
    graph[from].push({
      from: from,
      to: to,
      rate: rate,
      market: market,
      direction: direction
    });
  }

  markets.forEach(market => {
    // Sell base asset at the best bid to receive quote asset.
    addEdge(market.base, market.quote, market.bid, market, "sell at bid");
    // Spend quote asset to buy base asset at the best ask.
    addEdge(market.quote, market.base, 1 / market.ask, market, "buy at ask");
  });
  return graph;
}

function findTriangles_(graph, exchange) {
  const found = [];
  const start = "USDT";

  (graph[start] || []).forEach(e1 => {
    const a = e1.to;
    if (a === start) return;

    (graph[a] || []).forEach(e2 => {
      const b = e2.to;
      if (b === start || b === a) return;

      (graph[b] || []).forEach(e3 => {
        if (e3.to !== start) return;

        const edges = [e1, e2, e3];
        const grossFactor = edges.reduce((value, edge) => value * edge.rate, 1);
        const feeFactor = Math.pow(1 - CONFIG.FEE_RATE, 3);
        const afterFeesFactor = grossFactor * feeFactor;
        const netPct = (afterFeesFactor - 1) * 100 - CONFIG.SLIPPAGE_BUFFER_PCT;
        const routeKey = edges.map(edge =>
          edge.from + ">" + edge.to + ":" + edge.market.symbol
        ).join("|");

        found.push({
          exchange: exchange,
          edges: edges,
          grossPct: (grossFactor - 1) * 100,
          netPct: netPct,
          endUSDT: CONFIG.START_USDT * (1 + netPct / 100),
          routeKey: routeKey
        });
      });
    });
  });

  const unique = {};
  found.forEach(op => {
    if (!unique[op.routeKey] || op.netPct > unique[op.routeKey].netPct) {
      unique[op.routeKey] = op;
    }
  });
  return Object.keys(unique).map(key => unique[key]);
}

function formatOpportunity_(op) {
  const route = op.edges.map(edge => edge.from).concat(["USDT"]).join(" → ");
  const lines = [
    "🔎 Треугольный арбитраж — " + op.exchange + " Spot",
    "Маршрут: " + route,
    "Стартовая сумма: " + CONFIG.START_USDT.toFixed(2) + " USDT",
    "Расчёт после комиссий и буфера: " + op.endUSDT.toFixed(4) + " USDT",
    "Оценочная доходность: " + (op.netPct >= 0 ? "+" : "") + op.netPct.toFixed(3) + "%",
    "",
    "Шаги:"
  ];

  op.edges.forEach((edge, index) => {
    lines.push((index + 1) + ") " + edge.from + " → " + edge.to +
      " | " + edge.market.symbol +
      " | bid " + edge.market.bid + " / ask " + edge.market.ask);
  });

  lines.push(
    "",
    "⚠️ Это приблизительная оценка по лучшим bid/ask, не гарантия исполнения. " +
    "Проверьте комиссии, глубину стакана, минимальные объёмы, округление и актуальность цен. Бот не торгует."
  );
  return lines.join("\n");
}

function sendTelegram_(messageText) {
  const url = "https://api.telegram.org/bot" + CONFIG.TELEGRAM_TOKEN + "/sendMessage";
  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      chat_id: CONFIG.CHAT_ID,
      text: messageText,
      disable_web_page_preview: true
    }),
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) {
    throw new Error("Telegram send failed: " +
      response.getContentText().slice(0, 300));
  }
}

function testTelegram() {
  validateConfig_();
  sendTelegram_("✅ Сканер подключён к Telegram. Торговые ордера не выставляются.");
}

function getChatIdFromUpdates() {
  if (!CONFIG.TELEGRAM_TOKEN || CONFIG.TELEGRAM_TOKEN.indexOf("PASTE_") === 0) {
    throw new Error("Сначала вставьте Telegram bot token в CONFIG.TELEGRAM_TOKEN.");
  }

  const url = "https://api.telegram.org/bot" + CONFIG.TELEGRAM_TOKEN + "/getUpdates";
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const json = JSON.parse(response.getContentText());
  if (!json.ok) throw new Error("Telegram getUpdates error: " + response.getContentText());

  const chats = {};
  (json.result || []).forEach(update => {
    const message = update.message || update.edited_message;
    if (message && message.chat) {
      chats[String(message.chat.id)] = {
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        username: message.chat.username || "",
        first_name: message.chat.first_name || ""
      };
    }
  });

  console.log("Найденные чаты: " +
    JSON.stringify(Object.keys(chats).map(key => chats[key])));
  if (!Object.keys(chats).length) {
    console.log("Сообщений не найдено. Откройте бота в Telegram, отправьте /start и запустите функцию снова.");
  }
}

function setupTrigger() {
  validateConfig_();
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === "scanMarkets") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger("scanMarkets").timeBased().everyMinutes(1).create();
  console.log("Сканирование запущено примерно раз в минуту. Это не real-time сканер.");
}

function removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === "scanMarkets") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  console.log("Автоматическое сканирование остановлено.");
}

function validateConfig_() {
  if (!CONFIG.TELEGRAM_TOKEN || CONFIG.TELEGRAM_TOKEN.indexOf("PASTE_") === 0) {
    throw new Error("Вставьте Telegram bot token в CONFIG.TELEGRAM_TOKEN.");
  }
  if (!CONFIG.CHAT_ID || CONFIG.CHAT_ID.indexOf("PASTE_") === 0) {
    throw new Error("Вставьте числовой chat ID в CONFIG.CHAT_ID.");
  }
  if (!(CONFIG.FEE_RATE >= 0 && CONFIG.FEE_RATE < 1)) {
    throw new Error("FEE_RATE должен быть от 0 (включительно) до 1 (не включая).");
  }
}
