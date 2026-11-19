# FreeScout Alerts (Telegram)

A Google Apps Script that checks FreeScout every 5 minutes and sends you a Telegram message when:

- a ticket becomes **Active** and is assigned to you (new ticket, assignment, or a customer reply that reopens a Pending or Closed ticket)
- a customer replies again on a ticket that is already Active and yours

It runs on Google's servers 24/7 at no cost, even with your PC off.

Script editor (open with your personal Gmail):
https://script.google.com/d/YOUR_SCRIPT_ID/edit

> If Google says the file can't be opened, you're on the wrong account. Add
> `?authuser=<your personal gmail>` to the link, or use an Incognito window.

## Everyday controls

In the editor, pick a function from the dropdown next to **Run**, then click **Run**.

| I want to... | Run this |
|---|---|
| Pause alerts | `removeTrigger` |
| Resume alerts | `installTrigger` |
| Start fresh, with no alerts for tickets already open | `resetState` (the next run saves current tickets silently) |
| Check that FreeScout works | `testFreeScout` |
| Check that Telegram works | `testTelegram` |

## Change how often it checks

Currently set to **every 5 minutes**, which uses about 12 minutes a day of Google's 90-minute free daily limit
(each check takes about 2.5 seconds).

1. In `Code.gs`, change `var TRIGGER_MINUTES = 5;` to `1`, `5`, `10`, `15` or `30`. Google allows only these values.
2. Save, then run `installTrigger` again.

Every 1 minute would use about 60 of the 90 free minutes a day. If the 90 minutes run out, checks stop until the next day.

## Alerts you can get

```
New ticket #123456
<title>
https://support.buddyboss.com/conversation/<id>
```

```
Customer replied on #123457
<title>
https://support.buddyboss.com/conversation/<id>
```

- More than 5 updates at once: one combined message with a link to the mailbox.
- `FreeScout check failing` after 3 failed checks in a row. You get one message, then nothing until it recovers.
- `FreeScout check working again` once it recovers.

Alerts contain only the ticket number, title and link. They never include customer names, emails or message text.

## Settings (Project Settings, then Script Properties)

| Property | What it is |
|---|---|
| `FREESCOUT_URL` | `https://support.buddyboss.com` (no `/` at the end) |
| `FREESCOUT_API_KEY` | Your personal FreeScout API key (Read only, BuddyBoss Support) |
| `FREESCOUT_MAILBOX_ID` | Your mailbox id (see `testFreeScout` or `LOCAL-PRIVATE.md`) |
| `FREESCOUT_USER_ID` | Your FreeScout user id (see `testFreeScout` or `LOCAL-PRIVATE.md`) |
| `TELEGRAM_BOT_TOKEN` | Token from @BotFather |
| `TELEGRAM_CHAT_ID` | Saved automatically by `findTelegramChatId` |

Secrets live only in Script Properties, never in code files.

## Revoke or replace keys

- **FreeScout key:** in FreeScout go to Profile, then My API Keys, and delete the key used for these alerts. Create a new one (Read only, BuddyBoss Support) if needed and paste it into `FREESCOUT_API_KEY`.
- **Telegram bot:** in @BotFather send `/revoke` to get a new token, or `/deletebot` to remove the bot. Put the new token into `TELEGRAM_BOT_TOKEN`.
- **Stop everything:** run `removeTrigger`. To remove it completely, delete the project from https://script.google.com/home.

## Good to know

- FreeScout also returns **deleted and merged** tickets as "active". The script ignores them by checking `state = published`.
- Notes, agent replies, workflow actions and tickets assigned to others never trigger alerts.
- A ticket that leaves Active is dropped from memory quietly, so the next customer reply alerts again.

## Developer notes

- Code is in `src/` and deployed with `clasp push` (clasp is logged in to the personal Gmail).
