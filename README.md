# FreeScout → Telegram Alerts

A Google Apps Script that checks FreeScout every 5 minutes and sends a Telegram alert when one of your tickets becomes Active or a customer replies on it. It runs free on Google's servers, 24/7.

## Accounts and links

> Real values (Gmail, script ID, FreeScout IDs) are kept in the owner's **private** repo `freescout-telegram-alerts-private`, and locally in `LOCAL-PRIVATE.md` (git-ignored).

| What | Value |
|---|---|
| Google account (owns the script, used by clasp) | Your **personal** Gmail (not the BuddyBoss Workspace account). Real address is in `LOCAL-PRIVATE.md` on your Mac, which is not in git |
| Apps Script project | **FreeScout Telegram Alerts** |
| Open the script editor | https://script.google.com/d/YOUR_SCRIPT_ID/edit?authuser=YOUR_PERSONAL_GMAIL |
| Executions (run history) | https://script.google.com/home/projects/YOUR_SCRIPT_ID/executions?authuser=YOUR_PERSONAL_GMAIL |
| Triggers (schedule) | https://script.google.com/home/projects/YOUR_SCRIPT_ID/triggers?authuser=YOUR_PERSONAL_GMAIL |
| Script ID | `YOUR_SCRIPT_ID`: the real one is in `LOCAL-PRIVATE.md` and `freescout-telegram-alerts/.clasp.json` on your Mac (both git-ignored). You can also find it in Apps Script under Project Settings → IDs |
| FreeScout | https://support.buddyboss.com. Mailbox id and user id are in Script Properties and `LOCAL-PRIVATE.md` |
| FreeScout API key | Profile → My API Keys (Read only, BuddyBoss Support) |
| Telegram | Bot created with @BotFather on the Telegram account on Rezwan's phone. The alerts arrive in that bot's chat |

> Replace `YOUR_SCRIPT_ID` and `YOUR_PERSONAL_GMAIL` in the links with your real values. If a link says "file can't be opened", you're signed in with another Google account; keep `?authuser=...` in the link, or use an Incognito window signed in to only the personal Gmail.

## Files

| Path | What it is |
|---|---|
| [`SETUP-GUIDE.md`](SETUP-GUIDE.md) | **Start here.** Full step-by-step manual setup: Google, Apps Script, FreeScout, Telegram bot, tests, troubleshooting |
| [`freescout-telegram-alerts-setup.md`](freescout-telegram-alerts-setup.md) | Phase-by-phase setup brief for Claude Code |
| [`freescout-telegram-alerts/README.md`](freescout-telegram-alerts/README.md) | Day-to-day use: pause, resume, reset, interval, revoke keys |
| [`freescout-telegram-alerts/progress.md`](freescout-telegram-alerts/progress.md) | Full log of the first setup (2026-11-19), including every issue hit |
| [`freescout-telegram-alerts/src/`](freescout-telegram-alerts/src/) | The script (`Code.js`) and manifest (`appsscript.json`) |

## Setting it up again (on a new Google account or for someone else)

Follow **[`SETUP-GUIDE.md`](SETUP-GUIDE.md)** to do it by hand, or give [`freescout-telegram-alerts-setup.md`](freescout-telegram-alerts-setup.md) to Claude Code. Key points learned the first time:

1. **Telegram bot:**
   - in Telegram, message @BotFather, send `/newbot` and keep the token
   - open your new bot, press **Start** and send `hi`
   - add `TELEGRAM_BOT_TOKEN` in Script Properties
   - run `findTelegramChatId`, which saves `TELEGRAM_CHAT_ID` for you
   - run `testTelegram`
2. **Script Properties:** `FREESCOUT_URL`, `FREESCOUT_API_KEY`, `FREESCOUT_MAILBOX_ID`, `FREESCOUT_USER_ID`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. Leave the two IDs empty at first; `testFreeScout` lists them.
3. **Several Google accounts in one browser:** open the script with `?authuser=<personal gmail>` or in an Incognito window. Otherwise you get "file can't be opened" or "requires access" errors.
4. **Turn on the Apps Script API** at https://script.google.com/home/usersettings **while signed in as the same account clasp uses**, and wait a couple of minutes before `clasp create`.
5. **Deleted tickets show up as "active":** FreeScout's API returns deleted and merged conversations with `status=active`. The script keeps only `state === "published"`. Don't remove that filter.
6. **Interval:** Apps Script allows only 1, 5, 10, 15 or 30 minutes. A run takes about 2.5 s, so 1 minute uses about 60 of the 90 free minutes a day and 5 minutes uses about 12.
7. **Real test without emailing anyone:** in FreeScout, create a **New Phone Conversation** (no email is sent) assigned to yourself with status Active, run `checkTickets`, check Telegram, then delete the ticket.

### Quick commands

```bash
npm install -g @google/clasp
clasp login                      # pick the personal Google account
cd freescout-telegram-alerts
cp .clasp.json.example .clasp.json   # then put your script ID in it (Project Settings → IDs)
clasp push --force                   # deploy src/ to the script in .clasp.json
```

For a brand-new script, skip the `cp` step and run
`clasp create --type standalone --title "FreeScout Telegram Alerts" --rootDir src`, then push.

## Secrets

No keys, account emails, FreeScout IDs or script IDs are stored in this repo. Secrets live only in the Apps Script **Script Properties**. Your real account details are in `LOCAL-PRIVATE.md` and `.clasp.json` on your Mac, and both are git-ignored.
