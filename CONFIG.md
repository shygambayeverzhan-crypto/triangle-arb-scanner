# Configuration

Edit the `CONFIG` object near the top of `Code.gs` in your private Google Apps Script project.

| Setting | Default | Notes |
|---|---:|---|
| `START_USDT` | `25` | Illustrative starting amount used for estimates |
| `FEE_RATE` | `0.001` | Assumed fee per leg (0.1%); replace with your actual fee |
| `SLIPPAGE_BUFFER_PCT` | `0.05` | Percentage points deducted from estimated return |
| `MIN_NET_PROFIT_PCT` | `0.20` | Minimum estimated net percentage required for an alert |
| `ALERT_COOLDOWN_MINUTES` | `5` | Minimum time between alerts for the same route |
| `MAX_ALERTS_PER_RUN` | `5` | Caps alerts sent during one scan |
| `ASSETS` | USDT, BTC, ETH, BNB, SOL, XRP, ADA, DOGE, USDC, FDUSD | Assets used to filter available pairs |

## What the estimate means

For each three-leg route, the script multiplies the conversion rates, applies the assumed fee three times, then subtracts the slippage buffer from the percentage return. It is an approximate screening calculation, not an execution simulator.

## Known limitations

- Prices are best bid/ask snapshots; order-book depth and market impact are not simulated.
- The code does not fully validate exchange lot-size, tick-size, minimum-notional, or precision filters.
- Actual fees can differ by account, fee tier, discounts, and market.
- Network latency and Apps Script scheduling mean quotes may be stale by the time an alert is read.
- A positive estimate may disappear before a trade could be made.
- This version scans triangular routes within each exchange, not between Binance and Bybit.

Do not use the alert threshold as a promise of profitability. Verify live prices, fees, liquidity, and exchange rules independently.
