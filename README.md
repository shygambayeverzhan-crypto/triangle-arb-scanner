# Triangle Arb Scanner

Serverless triangular-arbitrage scanner for Binance Spot and Bybit Spot with Telegram alerts, deployed on Vercel. No Python or always-on PC required.

**Alerts only. No trading execution and no exchange API keys.**

## Deploy
1. Import this repository at [Vercel](https://vercel.com/new).
2. Add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and a long random `CRON_SECRET` in Project → Settings → Environment Variables.
3. Deploy and check `/api/health`.
4. Call `/api/scan` with header `Authorization: Bearer YOUR_CRON_SECRET`.
5. For frequent scans, use [cron-job.org](https://cron-job.org/) to call the endpoint every 1–5 minutes. Vercel Hobby Cron has frequency limits.

See [VERCEL_SETUP.md](VERCEL_SETUP.md) and [CONFIG.md](CONFIG.md).

## Defaults
| Setting | Default |
|---|---:|
| Start amount | 25 USDT |
| Assumed fee per leg | 0.10% |
| Slippage buffer | 0.05 percentage points |
| Alert threshold | 0.20% estimated net |
| Cooldown | 300 seconds with optional Redis |
| Max alerts per scan | 3 |

Uses best bid/ask snapshots, not full order-book depth. It does not fully simulate latency, market impact, exchange filters, rounding, or minimum order sizes. Binance and Bybit are scanned separately, not as cross-exchange arbitrage. Alerts do not guarantee profit.

**Secrets:** never commit real tokens to GitHub. Store them in Vercel Environment Variables. If exposed, revoke and replace them.

## Files
- `api/scan.js` — protected scanner and Telegram alerts
- `api/health.js` — health endpoint
- `VERCEL_SETUP.md` — deployment guide
- `CONFIG.md` — configuration
- `.env.example` — placeholders only

MIT license; see [LICENSE](LICENSE).
