# Complete Setup Guide: FreeScout → Telegram Alerts

A step-by-step guide to setting this up from scratch, by hand, with or without Claude Code.
Plan for **45–60 minutes** the first time.

All keys and tokens below are **made-up examples**. Never paste your real ones into chat, code files or GitHub.

---

## Contents

1. [How it works](#1-how-it-works)
2. [What you need](#2-what-you-need)
3. [Step 1: Google account and Apps Script API](#step-1-google-account-and-apps-script-api)
4. [Step 2: Create the Apps Script project](#step-2-create-the-apps-script-project)
5. [Step 3: FreeScout API key](#step-3-freescout-api-key)
6. [Step 4: Telegram bot](#step-4-telegram-bot)
7. [Step 5: Script Properties (your settings)](#step-5-script-properties-your-settings)
8. [Step 6: First run and Google permission](#step-6-first-run-and-google-permission)
9. [Step 7: Find your FreeScout IDs](#step-7-find-your-freescout-ids)
10. [Step 8: Connect Telegram](#step-8-connect-telegram)
11. [Step 9: Go live](#step-9-go-live)
12. [Step 10: Real test with a phone ticket](#step-10-real-test-with-a-phone-ticket)
13. [Optional: Cut FreeScout email noise](#optional-cut-freescout-email-noise)
14. [Everyday use](#everyday-use)
15. [Troubleshooting](#troubleshooting)
16. [Moving to a new account or replacing keys](#moving-to-a-new-account-or-replacing-keys)
17. [Limits and costs](#limits-and-costs)

---

## 1. How it works

```
 every 5 minutes (Google runs this for free, PC can be off)
 ┌──────────────────────────┐   1. "Which Active tickets are     ┌─────────────────────┐
 │  Google Apps Script      │ ──────── assigned to me?" ───────▶ │  FreeScout API      │
 │  "FreeScout Telegram     │ ◀──────── tickets + threads ────── │  support.buddyboss  │
 │   Alerts"  (checkTickets)│                                    └─────────────────────┘
 │                          │   2. compares with what it saw last time
 │                          │      (saved in Script Properties)
 │                          │   3. sends a message for anything new  ┌──────────────────┐
 │                          │ ──────────────────────────────────────▶│  Telegram bot    │──▶ your phone
 └──────────────────────────┘                                        └──────────────────┘
```

**You get an alert when:**
- a ticket becomes **Active** and is **assigned to you**: new ticket, assigned by a manager or auto-assign, or a customer reply that reopens a Pending or Closed ticket
- a customer **replies again** on a ticket that is already Active and yours

**You never get an alert for:** agent replies, notes, workflow actions, other people's tickets, or deleted and merged tickets.

**What an alert looks like:**
```
New ticket #123456
TEST - FreeScout alert check, please ignore
https://support.buddyboss.com/conversation/123456
```
```
Customer replied on #123457
bp_core_set_uri_globals() leaves use_verbose_page_rules = false
https://support.buddyboss.com/conversation/123457
```
Only the ticket number, title and link. No customer names, emails or message text.

---

## 2. What you need

| Item | Notes |
|---|---|
| A **personal** Google account (Gmail) | Not the company Workspace account. The script lives and runs here. Your real one is listed in `LOCAL-PRIVATE.md` (local only) |
| FreeScout agent login | To create a personal API key |
| Telegram on your phone | Free. For the bot and the alerts |
| A computer with Chrome | |
| *(Optional)* Node.js + clasp | Only for deploying the code from the terminal (Option B). Not needed if you copy and paste (Option A) |

> **Tip: several Google accounts in one Chrome.** Google often opens the wrong one, and you get
> errors like *"Sorry, the file can't be opened"* or *"This project requires access to your Google Account"*.
> Add `?authuser=YOUR_PERSONAL_GMAIL` to the end of Apps Script links, or do the whole setup in an
> **Incognito window** signed in to only the personal Gmail.

---

## Step 1: Google account and Apps Script API

1. Sign in to your personal Gmail in Chrome.
2. Open https://script.google.com/home/usersettings?authuser=YOUR_PERSONAL_GMAIL
3. Check the profile picture in the top right. It must be the personal account.
4. Turn **Google Apps Script API** to **On**.

> This switch is needed only for **clasp** (Option B). If you copy and paste the code (Option A), it doesn't hurt to turn it on anyway.
> If clasp later says *"User has not enabled the Apps Script API"*, the switch was turned on in a different
> Google account, or it needs 2–5 minutes to take effect. Turn it off and on again on the right account, then wait.

---

## Step 2: Create the Apps Script project

Choose **one** option.

### Option A: Copy and paste (no terminal, easiest)

1. Open https://script.google.com/home?authuser=YOUR_PERSONAL_GMAIL and click **New project**.
2. Click **Untitled project** at the top and rename it to `FreeScout Telegram Alerts`.
3. In the editor you'll see `Code.gs`. Delete everything in it.
4. Open [`freescout-telegram-alerts/src/Code.js`](freescout-telegram-alerts/src/Code.js) from this repo, copy **all** of it and paste it into `Code.gs`.
5. Click **💾 Save** (or Ctrl/Cmd+S).
6. Set the manifest (timezone and permissions):
   1. Click **⚙️ Project Settings** on the left.
   2. Tick **"Show "appsscript.json" manifest file in editor"**.
   3. Go back to **Editor**, open `appsscript.json` and replace its content with [`freescout-telegram-alerts/src/appsscript.json`](freescout-telegram-alerts/src/appsscript.json):
      ```json
      {
        "timeZone": "Asia/Dhaka",
        "dependencies": {},
        "exceptionLogging": "STACKDRIVER",
        "runtimeVersion": "V8",
        "oauthScopes": [
          "https://www.googleapis.com/auth/script.external_request",
          "https://www.googleapis.com/auth/script.scriptapp"
        ]
      }
      ```
   4. Click **Save**.

### Option B: clasp (from the terminal)

```bash
# one time
npm install -g @google/clasp
clasp login            # a browser opens: pick the PERSONAL Gmail, tick every box, Allow
                       # success message: "You are logged in as you@gmail.com"

# use an existing project
cd freescout-telegram-alerts
cp .clasp.json.example .clasp.json   # put your script ID in it (Apps Script: Project Settings → IDs)
clasp push --force                   # uploads src/Code.js and src/appsscript.json

# OR start a brand-new project (clasp writes .clasp.json for you)
clasp create --type standalone --title "FreeScout Telegram Alerts" --rootDir src
clasp push --force
```

To open the project after creating it, run `clasp open-script` or use the link in [README.md](README.md).

---

## Step 3: FreeScout API key

1. Log in to https://support.buddyboss.com.
2. Click your **avatar** in the top right, then **Profile**, then **My API Keys** on the left.
3. Fill in:
   - **Name:** `Telegram alerts`
   - **Ability:** **Read only**. The script never changes anything in FreeScout.
   - **Mailboxes:** **BuddyBoss Support**
4. Click **Create API Key**.
5. Copy the key. It starts with `fs_` followed by a long random string (for example `fs_****************`). Keep the tab open for Step 5.

> ⚠️ Don't screenshot or paste the key anywhere. If it's ever exposed, delete it and create a new one.

---

## Step 4: Telegram bot

You create **your own private bot**. Only you will talk to it.

1. Install **Telegram** on your phone and sign in.
2. In the search bar, type **@BotFather** and open the one with the **blue ✓ tick**.
3. Tap **Start**, then send `/newbot`. The chat goes like this:

   ```
   You:        /newbot
   BotFather:  Alright, a new bot. How are we going to call it? Please choose a name for your bot.
   You:        FreeScout Alerts
   BotFather:  Good. Now let's choose a username for your bot. It must end in `bot`.
               Like this, for example: TetrisBot or tetris_bot.
   You:        yourname_freescout_alerts_bot
   BotFather:  Done! Congratulations on your new bot. You will find it at t.me/yourname_freescout_alerts_bot.
               ...
               Use this token to access the HTTP API:
               <bot-id>:****************************
               Keep your token secure and store it safely...
   ```
   - The **name** can be anything. It's shown in the chat header.
   - The **username** must be unique and end in `bot`. If it's taken, try another.
   - The **token** is the secret you'll need in Step 5.
4. **Important:** tap the `t.me/your_bot_name` link in BotFather's message to open **your new bot**, tap **Start** and send `hi`.
   - A Telegram bot can't message you until you've messaged it first.
   - Send this to **your bot**, not to BotFather. That's the most common mistake.
5. *(Optional)* Give the bot a picture: in BotFather send `/setuserpic`, pick your bot and send an image.

---

## Step 5: Script Properties (your settings)

All settings and secrets go here, never in the code.

1. Open the script: `https://script.google.com/d/SCRIPT_ID/edit?authuser=YOUR_PERSONAL_GMAIL`
2. Click **⚙️ Project Settings** on the left, scroll to **Script Properties** and click **Edit script properties**.
3. Click **+ Add script property** once per row. **Each property is its own row.** Don't replace an existing row.

| Property | Example value | Where it comes from |
|---|---|---|
| `FREESCOUT_URL` | `https://support.buddyboss.com` | FreeScout address, **no `/` at the end**, no `/mailbox/...` |
| `FREESCOUT_API_KEY` | `fs_****************` | Step 3 |
| `TELEGRAM_BOT_TOKEN` | `<bot-id>:****************` | Step 4 |
| `FREESCOUT_MAILBOX_ID` | *(leave out for now)* | Found in Step 7 |
| `FREESCOUT_USER_ID` | *(leave out for now)* | Found in Step 7 |
| `TELEGRAM_CHAT_ID` | *(leave out)* | Saved **automatically** in Step 8 |

4. Click **Save script properties**. The button is at the bottom and easy to miss.

> **Check the names letter by letter:** all capitals, underscores, no spaces before or after.
> `FREESCOUT_API_KEY ` with a trailing space, or `FREESCOUT-API-KEY`, won't be found.

---

## Step 6: First run and Google permission

Every function is run the same way:

1. Click **Editor** (`< >`) on the left.
2. In the toolbar, pick the function name from the dropdown next to **▶ Run** and **Debug**.
3. Click **▶ Run**. The **Execution log** opens at the bottom.

The **first time** you run anything, Google asks for permission:

1. **Review permissions**, then choose your **personal Gmail**.
2. You'll see *"Google hasn't verified this app"*. That's normal: the "developer" is you.
3. Click **Advanced**, then **Go to FreeScout Telegram Alerts (unsafe)**.
4. Check that it asks for only these 2 permissions, then click **Allow**:
   - *Connect to an external service* (to call FreeScout and Telegram)
   - *Allow this application to run when you are not present* (for the schedule)

> If the log says *"This project requires access to your Google Account to run"*, the popup was closed
> before **Allow**, or you approved with the wrong account. Run again, or use Incognito.

---

## Step 7: Find your FreeScout IDs

1. Run **`testFreeScout`**. With the IDs still empty, the log lists them:
   ```
   FREESCOUT_MAILBOX_ID is empty. Mailboxes this key can see:
     mailbox id <M> = BuddyBoss Support
   FREESCOUT_USER_ID is empty. Looking up users:
     user id <N> = Another Agent
     ...
     user id <U> = Your Name
     ...
   Add FREESCOUT_MAILBOX_ID and FREESCOUT_USER_ID to Script Properties, then run testFreeScout again.
   ```
   The user list can be long. Scroll the log to find your name.
   *Another way to find your user id:* in FreeScout open **Your Profile**. The address ends in `/users/profile/<U>`, and that number is your user id.
2. Add `FREESCOUT_MAILBOX_ID` = `<M>` and `FREESCOUT_USER_ID` = `<U>` (your numbers) in Script Properties, then **Save**.
3. Run **`testFreeScout`** again. A healthy result:
   ```
   User id: <U>, mailbox id: <M>
   Active tickets assigned to you: 0 (fetched in 422 ms; deleted/merged conversations ignored)
   Sample (pending): conversation id 123458, ticket number #123458
   Sample link: https://support.buddyboss.com/conversation/123458
   Field check: number=true, subject=true, state=published, assignee.id=<U>, threads embedded=true, ...
   Thread types on sample: {"message":6,"customer":5,"lineitem":3,"note":2}, latest customer reply: ..., has your reply: true
   ```
   - "0 Active" is fine when all your tickets are Pending.
   - Open the **Sample link** in your browser. It should open that ticket.

> If you see **`FreeScout HTTP 401`**, the key is wrong or deleted. **`403`** means the key isn't allowed for that mailbox.
> A **connection error** means Google's servers can't reach FreeScout (firewall). Ask the server admin to allow it.

---

## Step 8: Connect Telegram

1. Make sure you sent `hi` to **your bot** in Step 4.
2. Run **`findTelegramChatId`**:
   ```
   TELEGRAM_CHAT_ID = ********* (private)   <- your chat id (example, masked)
   Saved TELEGRAM_CHAT_ID to Script Properties.
   ```
   - *"No messages yet..."* means you messaged BotFather instead of your bot, or haven't pressed Start. Do that, then run it again.
   - *"Telegram error 401"* means the token is wrong. Copy it again from BotFather.
3. Run **`testTelegram`**. Your phone should get **"Test alert from FreeScout Alerts"** from your bot.

---

## Step 9: Go live

1. Run **`checkTickets`** once by hand. The first run **saves your current tickets silently**, so you aren't flooded:
   ```
   First run: saved 0 active ticket(s) silently.
   ```
2. Run **`checkTickets`** again. A normal run looks like:
   ```
   OK: 0 active, 0 alert(s), 1113 ms
   ```
3. Run **`installTrigger`**:
   ```
   Removed 0 checkTickets trigger(s).
   Trigger installed: checkTickets every 5 minute(s).
   ```
4. After 10–15 minutes, open **Executions** (▶≡ icon on the left). You should see `checkTickets` · **Time-Driven** · **Completed** every 5 minutes.

From now on it runs by itself, around the clock, with your computer off.

---

## Step 10: Real test with a phone ticket

This tests the whole chain without emailing any customer.

1. In FreeScout click **New Conversation**, then switch to the **📞 Phone** tab. Phone conversations **don't send any email**.
2. Fill in:
   - **Customer Name:** `Test Customer`
   - **Email:** your own work email, so nothing can reach a real customer (choose your existing record if it's suggested)
   - **Subject:** `TEST - FreeScout alert check, please ignore`
   - **Body:** `Test ticket for the alert script. Please ignore, it will be deleted.`
   - **Status:** **Active**
   - **Assign to:** **Me**
3. Click **Create**.
4. In Apps Script run **`checkTickets`**, or wait up to 5 minutes. The log shows `OK: 1 active, 1 alert(s)` and Telegram shows:
   ```
   New ticket #123456
   TEST - FreeScout alert check, please ignore
   https://support.buddyboss.com/conversation/123456
   ```
5. Tap the link. It should open the test ticket.
6. Delete the test ticket: in the ticket, open **⋯**, choose **Delete** and confirm. The script ignores deleted tickets.

> FreeScout's own notification emails, or the Support AI auto-closing the ticket, may also show up. That's FreeScout's behaviour, not this script.

---

## Optional: Cut FreeScout email noise

The Telegram alerts don't depend on FreeScout's email notifications. To get **email only about your own tickets**:

FreeScout → **avatar** → **Profile** → **Notifications**, **Email** column:

| Row | Email |
|---|---|
| There is a new conversation | ☐ off |
| A conversation is assigned to me | ☑ on |
| A conversation is assigned to someone else | ☐ off |
| A conversation I'm following is updated | ☑ on |
| I'm @mentioned in a conversation | ☑ on |
| Customer replies → to an unassigned conversation | ☐ off |
| Customer replies → to one of my conversations | ☑ on |
| Customer replies → to a conversation owned by someone else | ☐ off |
| Another user replies/notes → to an unassigned conversation | ☐ off |
| Another user replies/notes → to one of my conversations | ☑ on |
| Another user replies/notes → to a conversation owned by someone else | ☐ off |

Click **Save Notifications**.

---

## Everyday use

Open the editor, pick the function and click **▶ Run**.

| I want to... | Run |
|---|---|
| Pause alerts (holiday, etc.) | `removeTrigger` |
| Resume alerts | `installTrigger` |
| Start fresh, with no alerts for tickets already open | `resetState`, then the next run saves silently |
| Check that FreeScout works | `testFreeScout` |
| Check that Telegram works | `testTelegram` |
| See whether runs are working | **Executions** page (left menu) |

**Change how often it checks:** in `Code.gs` change `var TRIGGER_MINUTES = 5;` to `1`, `5`, `10`, `15` or `30`.
Google allows only those values; 2 minutes isn't possible. Save, then run `installTrigger`.
With clasp, edit `src/Code.js`, run `clasp push --force`, then run `installTrigger`.

**Alerts the script sends about itself:**
- `FreeScout check failing / Reason: ... / Alerts are paused until it recovers.` comes after 3 failed checks in a row, and is sent only once.
- `FreeScout check working again` comes when it recovers.

---

## Troubleshooting

| What you see | Cause | Fix |
|---|---|---|
| "Sorry, the file can't be opened" (Google Drive page) | Wrong Google account | Use the link with `?authuser=YOUR_PERSONAL_GMAIL`, or Incognito |
| clasp: "User has not enabled the Apps Script API" | Switch is off on *that* account, or not active yet | Step 1 on the right account, wait 2–5 min |
| "This project requires access to your Google Account" | Permission popup not finished | Run again and click Allow at the end (Step 6) |
| `Missing Script Properties: FREESCOUT_API_KEY` | Name typo, empty value, not saved, or a row was overwritten | Check the exact names, one row each, Save (Step 5) |
| `FreeScout HTTP 401` | Bad or deleted API key | New key (Step 3), update `FREESCOUT_API_KEY` |
| `FreeScout HTTP 403` | Key not allowed for that mailbox | Recreate the key with BuddyBoss Support ticked |
| User list doesn't show your name | Long list, scroll the log | Or read the id from your FreeScout profile URL |
| "Active tickets: 25" but they're old or odd | Deleted and merged tickets look "active" in the API | Already handled: the script keeps only `state = published`. Don't remove that filter |
| `findTelegramChatId`: "No messages yet" | You messaged BotFather, not your bot | Open your bot, Start, send `hi`, run again |
| `Telegram HTTP 401` | Wrong or revoked bot token | Copy the token again (`/token` in BotFather) |
| `Telegram HTTP 403: bot was blocked by the user` | You blocked or deleted the bot chat | Unblock the bot, press Start |
| Got "FreeScout check failing" | FreeScout down, key revoked, or network | Run `testFreeScout` to see the reason. Recovery is automatic |
| No alerts at all | Trigger missing | **Triggers** page: there should be one `checkTickets`, time-based. Run `installTrigger` |
| Runs show **Failed** in Executions | Click the row to see the error | Match it against this table |
| Playwright or automation clicks do nothing | Apps Script shows a "You're signed in as..." popup | Click **OK** on it first |

---

## Moving to a new account or replacing keys

**New FreeScout key:** delete the old one in **My API Keys**, create a new one (Step 3) and update `FREESCOUT_API_KEY`. Nothing else changes.

**New Telegram token:** in BotFather send `/revoke` (or `/token`), choose your bot and update `TELEGRAM_BOT_TOKEN`. The chat id stays the same.

**New Telegram bot:** do Step 4 again, update the token, **delete** `TELEGRAM_CHAT_ID` and run `findTelegramChatId` again.

**Different Google account:** do Steps 1, 2, 5, 6, 7, 8 and 9 on the new account, then run `removeTrigger` on the old project (or delete it at script.google.com) so you don't get double alerts.

**Someone else using it:** they need their own FreeScout key, Telegram bot and Google account, and their own `FREESCOUT_USER_ID`.

**Remove everything:** run `removeTrigger`, delete the project at https://script.google.com/home, delete the API key in FreeScout and send `/deletebot` to BotFather.

---

## Limits and costs

Everything is free.

| Limit (free Gmail account) | Our use at 5 min |
|---|---|
| Trigger runtime: **90 min/day** | 288 runs × ~2.5 s ≈ **12 min/day** |
| URL fetches: 20,000/day | ~300–600/day |
| Script Properties: 500 KB | a few KB |
| Telegram Bot API | free, no message limit at this volume |

At **1 minute** it would be about 60 min/day. That fits, but if a day goes over 90 min, Google pauses the checks until the next day without telling you.

---

## Security checklist

- [ ] Keys and tokens only in **Script Properties**, never in code, chat, screenshots or GitHub
- [ ] FreeScout key is **Read only** and limited to **BuddyBoss Support**
- [ ] Alerts carry only the ticket number, title and link
- [ ] The GitHub repo stays **private**
- [ ] Revoke the keys if a laptop or phone is lost (see above)
