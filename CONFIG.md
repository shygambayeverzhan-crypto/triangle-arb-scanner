# Configuration

Set these in Vercel → Project → Settings → Environment Variables, then redeploy.

| Variable | Default | Meaning |
|---|---:|---|
| TELEGRAM_BOT_TOKEN | required | Telegram bot token; keep secret |
| TELEGRAM_CHAT_ID | required | Destination chat ID |
| CRON_SECRET | required | Bearer secret protecting /api/scan |
| START_USDT | 25 | Illustrative starting amount |
| FEE_RATE | 0.001 | Assumed fee per leg (0.1%) |
| SLIPPAGE_BUFFER_PCT | 0.05 | Percentage points deducted from return |
| MIN_NET_PROFIT_PCT | 0.20 | Alert threshold |
| MAX_ALERTS_PER_RUN | 3 | Maximum messages per scan |
| COOLDOWN_SECONDS | 300 | Cooldown when Redis is configured |
| ASSETS | common USDT/BTC/ETH/etc. | Assets included in route search |
| UPSTASH_REDIS_REST_URL | optional | Upstash Redis endpoint for persistent cooldown |
| UPSTASH_REDIS_REST_TOKEN | optional | Upstash Redis REST token |

Each route multiplies its three conversion rates, applies the assumed fee three times, then subtracts the slippage buffer. This is a screening estimate, not an execution simulator.

## Limitations
- Best bid/ask snapshots do not model full order-book depth.
- Exchange filters, rounding, minimum order sizes, market impact, and latency are not fully simulated.
- Fees vary by account and market.
- Routes are scanned independently within each exchange.
- Without Upstash Redis, cooldowns are not persistent across serverless requests.

No trading orders are sent. Independently verify any opportunity before acting.
