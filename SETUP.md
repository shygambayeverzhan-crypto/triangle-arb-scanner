# Setup guide

This project runs in Google Apps Script. You do not need Python, Node.js, or a continuously running PC.

## 1. Create a Telegram bot

1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. Send `/newbot` and follow its instructions.
3. Copy the token BotFather provides. Treat it like a password.
4. Open your new bot and send it `/start`.

## 2. Get your chat ID

1. Open [Google Apps Script](https://script.google.com/) and create a project.
2. Copy the contents of `Code.gs` from this repository into the script editor.
3. In the `CONFIG` object, temporarily paste your token into `TELEGRAM_TOKEN`.
4. Save, select `getChatIdFromUpdates`, and click **Run**.
5. Approve the requested permissions, then open **Execution log**. Find the numeric `chat_id` for your Telegram chat.
6. Paste that ID into `CHAT_ID` in `CONFIG`.

If no chat appears, send `/start` to your bot and run the function again.

## 3. Test notifications

- Run `testTelegram`.
- Confirm that the test message arrives in Telegram.
- If it fails, check the token and chat ID, and review the execution log.

## 4. Start scanning

- Run `scanMarkets` manually once and review the execution log.
- Run `setupTrigger` to create an approximately one-minute time-driven trigger.
- Google may ask for permission to fetch external URLs and manage triggers.

To stop scheduled scans, run `removeTrigger`.

## Keep credentials private

**Do not paste your real token or chat ID into the public GitHub repository.** Configure them only in your private Apps Script project. If you accidentally expose a bot token, revoke it through BotFather and create a replacement.

No Binance or Bybit API keys are needed: the scanner only reads public market data and sends Telegram messages.
