# Progress: FreeScout to Telegram Alerts

Status legend: DONE / IN PROGRESS / BLOCKED / NOT STARTED

## Phase 1: Environment check — DONE (2026-11-19)
- Node.js v26.7.0, npm 11.19.0
- clasp 3.4.1 installed globally
- Project folder `freescout-telegram-alerts` created with .gitignore (excludes .clasprc.json and secret files)

## Phase 2: Google account — DONE (2026-11-19)
- Using an existing personal Gmail account (not the company Workspace account)
- Rezwan signed in and turned on Google Apps Script API in user settings

## Phase 3: clasp login — DONE (2026-11-19)
- `clasp login` succeeded with the personal Gmail account

## Phase 4: Build the script — DONE (2026-11-19)
- First `clasp create` failed ("Apps Script API not enabled"); fixed after Rezwan re-toggled the API on the personal account
- Project created: "FreeScout Telegram Alerts" (standalone), code lives in `src/`
- appsscript.json: timezone Asia/Dhaka, runtime V8, minimal scopes (external_request, scriptapp)
- src/Code.js: checkTickets, testFreeScout, testTelegram, findTelegramChatId, installTrigger, removeTrigger, resetState
- Local mock test (14 scenarios) passed: silent seed, new ticket, reply, reopen with earlier own reply,
  ticket leaving Active, other assignee ignored, combined alert (>5), failure alert after 3, recovery alert,
  alert send failure retry, secrets masked in error logs, FreeScout key only in header
- `clasp push` done
- To verify against live API in Phase 6: field names (number, subject, status, assignee.id, embedded threads,
  thread.type/createdAt/createdBy), query params (status=active, assignedTo, embed=threads), link format

## Phase 5: Keys and settings — DONE (2026-11-19)
- A. FreeScout API key: DONE
- B. Alert channel: Telegram Bot API (official, free, instant) — decided by Rezwan 2026-11-19
- B2. Telegram bot: DONE — bot created via @BotFather, Rezwan pressed Start
- C. Script Properties: FREESCOUT_URL, FREESCOUT_API_KEY, FREESCOUT_MAILBOX_ID, FREESCOUT_USER_ID added (DONE);
  TELEGRAM_BOT_TOKEN added by Rezwan; TELEGRAM_CHAT_ID saved automatically by findTelegramChatId (DONE)
  (note: script must be opened with ?authuser=<personal gmail>, other accounts get "file can't be opened")

## Phase 6: Tests — DONE (2026-11-19)
- testFreeScout: PASS (run via Playwright in Rezwan's Chrome)
  - FreeScout reachable from Google; key sends in header; mailbox id and user id found
  - Fetch time ~420-840 ms per run
  - Field names confirmed against live API: number, subject, status, state, assignee.id, _embedded.threads,
    thread.type (customer/message/note/lineitem), thread.createdAt, thread.createdBy.id
- ISSUE FOUND + FIXED: `status=active` also returns deleted/merged conversations (25 "active/deleted" for Rezwan).
  Script now keeps only `state === "published"`. Local mock test updated (15 scenarios, all pass), pushed.
- Right now Rezwan has 0 Active tickets (all 13 in Mine are Pending) — correct, nothing to alert.
- Sample pending ticket #123458: full threads visible (customer 5, message 6, note 2, lineitem 3),
  latest customer reply detected, "has your reply" = true
- Link format: CONFIRMED. FreeScout UI uses /conversation/{id} (e.g. /conversation/123458); id = ticket number on samples
- Temporary diagnostics removed from code
- Code switched to Telegram: sendAlert_ (POST JSON to sendMessage, token masked in errors), testTelegram,
  findTelegramChatId (logs chat id from getUpdates). Alert texts unchanged. Mock test 15/15 pass. Pushed.
- findTelegramChatId: found 1 private chat, saved TELEGRAM_CHAT_ID (value never shown in chat/logs read by Claude)
- testTelegram: PASS — Rezwan confirmed "Test alert from FreeScout Alerts" arrived on Telegram (3:22 AM)
- checkTickets manual run: 1st run seeded state silently; 2nd run "OK: 0 active, 0 alert(s), 1113 ms"
  -> ~1.1 s per run, under the 3 s limit, keep 1-minute schedule (~27 min/day of the 90 min free quota)

## Phase 7: Go live — DONE (2026-11-19)
- installTrigger run at 3:26 AM: "Trigger installed: checkTickets every 1 minute(s)"
- Scheduled runs (Executions): 3:27:30 9.97 s (cold start), 3:27:51 2.87 s, 3:28:30 2.11 s — all Completed
- Average after cold start ~2.5 s (< 3 s rule) -> keep 1-minute schedule (~60 of 90 free min/day)
  Re-check Executions after a day; if the average goes above 3 s, set TRIGGER_MINUTES = 5 and run installTrigger
- CHANGE (Rezwan, 3:38 AM): interval set to every 5 minutes (TRIGGER_MINUTES = 5, trigger reinstalled:
  "Removed 1 checkTickets trigger(s). Trigger installed: checkTickets every 5 minute(s)"). ~12 of 90 free min/day.
  (2 minutes isn't an option: Apps Script only allows 1, 5, 10, 15 or 30.)
- REAL TEST (3:44 AM): created phone conversation #123456 "TEST - FreeScout alert check, please ignore"
  (customer = Rezwan's own work email, Active, assigned to Rezwan; phone type = no email sent), ran checkTickets:
  "OK: 1 active, 1 alert(s), 1515 ms". Rezwan confirmed on phone: "New ticket #123456", correct title,
  working link, push notification shown. PASS. Test ticket deleted afterwards ("Conversation deleted").
- Customer-reply path not tested live (can't simulate a customer email reply from the UI); verified via real
  ticket #123458 thread data + local mock tests
## Phase 8: Wrap up — DONE (2026-11-19)
- README.md written (pause/resume/reset/interval/revoke keys, settings table)
- Secret scan of all project files: clean (keys only in Script Properties)
- Deleted local Playwright output folder (.playwright-mcp) — it held page snapshots with customer emails

## Final setup
- Google Apps Script "FreeScout Telegram Alerts" on personal Gmail, trigger checkTickets every 5 min
- Source: FreeScout API (support.buddyboss.com, Read-only personal key)
- Channel: Telegram bot

## Extra: FreeScout email notifications trimmed (2026-11-19, 3:53 AM)
- Rezwan asked for email only about his own tickets. Saved in FreeScout > Profile > Notifications ("Notifications saved successfully").
- Email ON: assigned to me, following updated, @mentioned, customer replies to my conversations, other user replies/notes on my conversations
- Email OFF: new conversation, assigned to someone else, customer replies to unassigned / others', other user replies/notes on unassigned / others'
- Browser column left unchanged (all on). Unrelated to the Telegram script, which reads the API directly.

## Extra: Backed up to GitHub (2026-11-19)
- Repo: https://github.com/rezwan2024/freescout-telegram-alerts (branch main, public; personal details kept out, see LOCAL-PRIVATE.md locally)
- Contains setup brief, top-level README with lessons for re-setup, script source, this log. No secrets.
