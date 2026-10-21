# Deploy and run on Vercel

## 1. Import the repository
1. Sign in to [Vercel](https://vercel.com/).
2. Select **Add New → Project**.
3. Import `shygambayeverzhan-crypto/triangle-arb-scanner`.
4. Keep the default project settings and deploy.

The project uses built-in Node.js serverless functions and has no third-party npm dependencies.

## 2. Add environment variables
In **Project → Settings → Environment Variables**, add for Production:
- `TELEGRAM_BOT_TOKEN`: the token for the Telegram bot you already created.
- `TELEGRAM_CHAT_ID`: your numeric user or group chat ID.
- `CRON_SECRET`: a long random secret used to protect the scan endpoint.

Optional variables: `START_USDT` (25), `FEE_RATE` (0.001), `SLIPPAGE_BUFFER_PCT` (0.05), `MIN_NET_PROFIT_PCT` (0.20), `MAX_ALERTS_PER_RUN` (3), `COOLDOWN_SECONDS` (300), and `ASSETS` (comma-separated symbols).

After changing environment variables, redeploy.

**Never add real credentials to GitHub, chat messages, source files, or a public URL.**

## 3. Check deployment
Open `https://YOUR-DEPLOYMENT.vercel.app/api/health`. Expected JSON includes `"ok": true`.

## 4. Test the scan endpoint
Send a GET request to `https://YOUR-DEPLOYMENT.vercel.app/api/scan` with header `Authorization: Bearer YOUR_CRON_SECRET`. A successful call returns JSON with market counts, routes checked, and alerts sent. Wrong/missing secret returns 401.

## 5. Schedule scans
Vercel Hobby Cron Jobs have frequency restrictions. For frequent scans, create a job at [cron-job.org](https://cron-job.org/):
- URL: your `/api/scan` endpoint
- Method: GET
- Schedule: every 1–5 minutes, if supported by your scheduler
- Header: `Authorization: Bearer YOUR_CRON_SECRET`

Do not put the secret in the query string.

## 6. Optional: persistent cooldown with Upstash Redis
Without persistent storage, repeated scan requests may send the same route again. Create a Redis database at [Upstash](https://upstash.com/) and add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel, then redeploy. This lets the scanner suppress duplicate routes across serverless invocations.

## Troubleshooting
- **401:** check Authorization header and CRON_SECRET.
- **Missing Telegram variables:** check names and redeploy.
- **No alert:** there may be no routes above the threshold; check endpoint JSON.
- **Telegram API error:** verify bot token/chat ID and that the bot can message the chat.
- **No prices:** check Vercel function logs and public exchange API status.

The service only sends alerts; it never places exchange orders or requests exchange API keys.
