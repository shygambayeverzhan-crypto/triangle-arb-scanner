# Triangle Arb Scanner

A lightweight **triangular-arbitrage opportunity scanner** for Binance Spot and Bybit Spot, with Telegram alerts. It runs in Google Apps Script, so you do not need to install Python or keep your computer running.

> **Alerts only. No trading is performed.** This project uses public market data and never sends orders to an exchange.

## Features

- Reads best bid/ask quotes from the public Binance Spot and Bybit Spot APIs.
- Searches three-leg routes that start and finish in USDT on each exchange separately.
- Estimates returns after a configurable trading-fee assumption and slippage buffer.
- Sends Telegram alerts when an estimated opportunity clears your threshold.
- Includes alert cooldowns and a per-run alert limit.
- Uses no exchange API keys.

## How it works

For each exchange, the scanner builds conversion paths from the best bid/ask prices and checks routes such as:

`USDT → BTC → ETH → USDT`

It estimates the effect of three trading fees and subtracts a configurable slippage buffer. An alert is only a **signal to investigate**, not proof that a trade can be executed profitably.

## Quick start

1. Open [Google Apps Script](https://script.google.com/) and create a new project.
2. Copy `Code.gs` from this repository into the editor.
3. Create a Telegram bot using [@BotFather](https://t.me/BotFather) and copy its token.
4. In `CONFIG` inside Apps Script, enter the bot token and your chat ID. Keep these private; do not commit your edited script or secrets to this public repository.
5. Save the project and run `testTelegram`. Approve the requested Apps Script permissions.
6. Run `setupTrigger` to schedule scans approximately once per minute.
7. Review the logs and adjust the assumptions in `CONFIG`.

Detailed steps: see [SETUP.md](SETUP.md). Configuration notes and limitations: see [CONFIG.md](CONFIG.md).

## Configuration defaults

| Setting | Default | Meaning |
|---|---:|---|
| Starting amount | 25 USDT | Illustrative amount for the estimate |
| Fee per leg | 0.10% | Change to your actual fee tier |
| Slippage buffer | 0.05 percentage points | Conservative deduction from estimated return |
| Alert threshold | 0.20% net | Minimum estimated return for an alert |
| Cooldown | 5 minutes | Avoid repeating the same route too frequently |

These are example settings, not a recommendation to trade. A small starting balance may be affected significantly by minimum order sizes and exchange-specific precision rules.

## Important limitations

- Uses best bid/ask quotes, not full order-book depth.
- Does not account perfectly for market impact, latency, minimum order sizes, precision, or every exchange fee tier.
- Google Apps Script triggers are approximate and are not a real-time execution system.
- Quotes can change before a person could act on an alert.
- Binance and Bybit markets are evaluated separately; this version does not perform cross-exchange transfers or arbitrage.
- The estimated result can be wrong or negative in real execution.

**Never treat an alert as guaranteed profit.** Test with small amounts and independently verify all prices, fees, liquidity, and market rules.

## Safety

- No automated trading, withdrawals, or exchange order endpoints.
- No exchange API keys are required.
- Never publish your Telegram bot token or private chat information.
- The placeholder values in this repository are not real credentials.

## Files

- `Code.gs` — Google Apps Script scanner and Telegram notifications.
- `SETUP.md` — setup and run instructions.
- `CONFIG.md` — configuration and limitations.
- `.gitignore` — common local files to exclude.

## License

Released under the MIT License; see [LICENSE](LICENSE).
