module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ ok: true, service: "triangle-arb-scanner", mode: "alerts-only", exchanges: ["Binance Spot", "Bybit Spot"] });
};
