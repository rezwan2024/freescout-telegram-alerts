# FreeScout to Telegram Alerts: Setup Instructions for Claude Code

## Goal

Build a Google Apps Script that checks FreeScout on a schedule and sends a Telegram alert to Rezwan through his own Telegram bot when:

1. A ticket becomes Active and assigned to Rezwan (new ticket, auto-assign, manager assign, ticket Rezwan created, or a customer reply that reopens a Pending or Closed ticket).
2. A customer sends another reply on a ticket that is already Active and assigned to Rezwan.

It must run 24/7 on Google's servers, with the PC off, at no cost.

## How to work with the human

- Work phase by phase.
- When a step needs Rezwan, stop, show a clearly marked HUMAN STEP block with numbered instructions, and wait for him to confirm before continuing.
- Never ask Rezwan to paste API keys or bot tokens into the chat or terminal. He enters secrets himself in the Apps Script Script Properties screen (Phase 5). Secrets never go into code files, clasp files, logs or git.
- Keep messages to Rezwan short and clear.
- Keep a progress.md file in the project folder. Update it whenever a phase starts, gets blocked or finishes.
- Playwright (CLI or MCP, connected to Rezwan's Chrome) may be used to run functions in the Apps Script editor and to check FreeScout pages. Never open or read the Script Properties page with it, because secrets are visible there.

## Fixed decisions

- Google account: Rezwan's personal Google account, not the company Workspace account.
- FreeScout access: personal API key, Read only, limited to the BuddyBoss Support mailbox.
- Alert channel: Telegram Bot API (official, free). A bot created with @BotFather sends only to Rezwan's own private chat.
- Schedule: every 5 minutes, 24/7. Apps Script time triggers allow only 1, 5, 10, 15 or 30 minutes. A run takes about 2.5 s, so 1 minute would use about 60 of the 90 free trigger minutes a day, and 5 minutes uses about 12.
- No customer names, emails or reply content in alerts. Only ticket number, title and link.

## Alert formats

Use exactly these formats. Line breaks are real newlines.

New ticket:

```
New ticket #123456
Zoom in-browser meetings broken
https://FREESCOUT_URL/conversation/CONVERSATION_ID
```

Customer reply, both first reply and later replies:

```
Customer replied on #123457
bp_core_set_uri_globals() leaves use_verbose_page_rules = false
https://FREESCOUT_URL/conversation/CONVERSATION_ID
```

Failure alert, sent once after 3 failed checks in a row:

```
FreeScout check failing
Reason: SHORT_ERROR
Alerts are paused until it recovers.
```

Recovery alert, sent once when checks work again:

```
FreeScout check working again
```

Note: the number after # is the ticket number shown in FreeScout. The link uses the conversation id. On BuddyBoss Support the two have matched, and the link format `/conversation/{id}` is confirmed.

## Alert logic

On each run:

1. Fetch all conversations with status Active, assigned to Rezwan's FreeScout user id, in the BuddyBoss Support mailbox, with `embed=threads`. Handle pagination.
2. **Keep only `state === "published"`.** The FreeScout API also returns deleted and merged conversations with `status=active`. Without this filter they look like real tickets with no customer threads.
3. Load saved state from Script Properties: a map of conversation id to the time of its latest customer thread.
4. For each Active conversation:
   - Find the latest thread of type `customer` and its `createdAt`.
   - If the conversation id is not in saved state:
     - If the conversation has an earlier thread of type `message` written by Rezwan's user id, send "Customer replied on".
     - Otherwise send "New ticket".
   - If the conversation id is in saved state and the latest customer thread is newer than the saved time, send "Customer replied on".
5. Save the new state with only the current Active conversations. Tickets that left Active are removed quietly, so a later customer reply alerts again.
6. First run: save the current state silently with no alerts, so existing tickets don't flood Telegram.

Ignore agent replies, notes, workflow actions (`lineitem`) and tickets assigned to others. They never trigger alerts.

Field names confirmed against the live API: `id`, `number`, `subject`, `status`, `state`, `assignee.id`, `_embedded.threads[]` with `type` (customer, message, note, lineitem), `createdAt`, `createdBy.id`, `createdBy.type`; pagination in `page.totalPages`. Reference: https://api-docs.freescout.net

## Phase 1: Environment check (Claude Code)

1. Confirm Node.js and npm are installed.
2. Install clasp globally: `npm install -g @google/clasp`
3. Create a project folder named freescout-telegram-alerts with a .gitignore that excludes .clasprc.json and any local secret files.

## Phase 2: Google account (HUMAN STEP)

Ask Rezwan to:

1. Choose his personal Google account.
2. Open https://script.google.com/home/usersettings?authuser=PERSONAL_GMAIL and turn on Google Apps Script API. It must be done while signed in as the same account clasp will use. With several Google accounts in one browser, use `?authuser=` or an Incognito window.
3. Confirm when done. If `clasp create` later says the API is not enabled, wait 2 minutes or toggle it off and on again.

## Phase 3: clasp login (Claude Code, then HUMAN STEP)

1. Run `clasp login` in the background and give Rezwan the authorization URL it prints.
2. Tell Rezwan to pick his personal Google account, not his work account, then allow access.
3. Check the login worked ("You are logged in as ...").

## Phase 4: Build the script (Claude Code)

1. Run `clasp create --type standalone --title "FreeScout Telegram Alerts" --rootDir src`.
2. Set appsscript.json timezone to Asia/Dhaka, runtime V8, and scopes `script.external_request` and `script.scriptapp`.
3. Write the code with these functions:
   - `checkTickets`: the main function the trigger runs, following the Alert logic above. Use LockService so runs never overlap.
   - `testFreeScout`: logs Rezwan's user id, the count of Active tickets assigned to him, and one sample conversation id, number and link. If FREESCOUT_USER_ID or FREESCOUT_MAILBOX_ID is empty, it lists mailboxes and all users (paginated) so he can pick. No customer data in logs.
   - `findTelegramChatId`: reads the bot's `getUpdates` and saves TELEGRAM_CHAT_ID to Script Properties when exactly one chat is found.
   - `testTelegram`: sends one test alert.
   - `installTrigger`: removes old triggers for checkTickets, then adds one every TRIGGER_MINUTES.
   - `removeTrigger`: removes the checkTickets trigger.
   - `resetState`: clears saved state so the next run seeds silently again.
4. Read all settings from Script Properties: FREESCOUT_URL, FREESCOUT_API_KEY, FREESCOUT_MAILBOX_ID, FREESCOUT_USER_ID, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.
5. Send the FreeScout key in the X-FreeScout-API-Key header, never in the URL.
6. Send Telegram messages with a POST JSON body to `https://api.telegram.org/bot<TOKEN>/sendMessage`. Mask the token in any logged error. If several alerts are due in one run, send them about 1.5 seconds apart. If more than 5 are due, send one combined alert instead.
7. Wrap API calls in error handling. Count failures in Script Properties and send the failure and recovery alerts as described. If an alert fails to send, roll back that ticket's state so it retries next run.
8. Keep each run fast: one FreeScout request per page, no extra calls per ticket unless the threads are missing from the list response.
9. Test the logic locally with a mock harness (silent seed, new ticket, reply, reopen, ticket leaving Active, other assignee, deleted ticket, combined alert, failure and recovery, send failure retry), then run `clasp push`.

## Phase 5: Keys and settings (HUMAN STEP)

Ask Rezwan to:

1. Create the FreeScout API key: Profile, My API Keys, Name "Telegram alerts", Ability Read only, Mailboxes BuddyBoss Support, then Create API Key.
2. Create the Telegram bot: in Telegram, message @BotFather (blue tick), send `/newbot`, choose a name and a username ending in `bot`, and keep the token. Then open the new bot, press Start and send `hi`. The message must go to the new bot, not to BotFather.
3. Open the script with `?authuser=PERSONAL_GMAIL`, go to Project Settings, Script Properties, and add each property as a separate row:
   - FREESCOUT_URL: the FreeScout address with no trailing slash, for example https://support.buddyboss.com
   - FREESCOUT_API_KEY: the key from step 1
   - TELEGRAM_BOT_TOKEN: the token from step 2
   - FREESCOUT_MAILBOX_ID, FREESCOUT_USER_ID, TELEGRAM_CHAT_ID: leave empty for now
4. Confirm when done. Remind him not to share screenshots of the Value column.

## Phase 6: Tests (Claude Code via Playwright, or HUMAN STEP)

1. `testFreeScout`. On the first run Google shows an unverified app warning. That's normal for his own script: Advanced, then Go to FreeScout Telegram Alerts, then Allow.
   - If it fails with a connection error, FreeScout isn't reachable from Google's servers. Stop and discuss options.
   - Add the logged FREESCOUT_MAILBOX_ID and FREESCOUT_USER_ID to Script Properties and run it again.
   - Confirm the sample link matches the browser link of the same ticket.
2. `findTelegramChatId`. It should log one private chat and save TELEGRAM_CHAT_ID.
3. `testTelegram`. Ask Rezwan to confirm the test alert arrived.

## Phase 7: Go live

1. Run `checkTickets` once by hand. The first run seeds silently. Run it again and note the duration.
2. Run `installTrigger`.
3. Check Executions after a few runs. Every run should succeed. Confirm the daily total stays well under 90 minutes.
4. Real test without emailing anyone: in FreeScout create a New Phone Conversation (no email is sent), with customer email set to his own work email, status Active, assigned to Rezwan. Run `checkTickets` and confirm the "New ticket" alert arrived with the right number, title and working link. Then delete the test ticket.

## Phase 8: Wrap up (Claude Code)

1. Update progress.md with the final setup.
2. Write a short README.md covering how to pause alerts (removeTrigger), resume (installTrigger), reset (resetState), change the interval, and revoke the FreeScout key or Telegram bot token.
3. Confirm no secrets exist in any project file.
