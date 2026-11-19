/**
 * FreeScout -> Telegram alerts (official Telegram Bot API).
 *
 * All settings live in Script Properties (Project Settings > Script Properties):
 *   FREESCOUT_URL, FREESCOUT_API_KEY, FREESCOUT_MAILBOX_ID, FREESCOUT_USER_ID,
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 * No secrets in this file.
 */

var TRIGGER_MINUTES = 5;          // allowed: 1, 5, 10, 15, 30
var FAILS_BEFORE_ALERT = 3;
var MAX_SEPARATE_ALERTS = 5;      // more than this -> one combined alert
var SEND_GAP_MS = 1500;           // gap between alert messages
var PAGE_SIZE = 50;
var MAX_PAGES = 20;

var KEY_STATE = 'ALERT_STATE';            // JSON {conversationId: latestCustomerThreadMs}
var KEY_FAIL_COUNT = 'FAIL_COUNT';
var KEY_FAIL_ALERT_SENT = 'FAIL_ALERT_SENT';

/* ------------------------------------------------------------------ */
/* Main trigger function                                               */
/* ------------------------------------------------------------------ */

function checkTickets() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('Previous run still active, skipping.');
    return;
  }
  var started = Date.now();
  var props = PropertiesService.getScriptProperties();
  var cfg = null;
  try {
    cfg = getConfig_(true);
    var convs = fetchActiveConversations_(cfg);

    var stateRaw = props.getProperty(KEY_STATE);
    var seeding = (stateRaw === null);
    var oldState = seeding ? {} : JSON.parse(stateRaw);
    var newState = {};
    var alerts = [];

    convs.forEach(function (conv) {
      var id = String(conv.id);
      var threads = getThreads_(cfg, conv);
      var latest = latestCustomerTime_(threads);
      newState[id] = latest;
      if (seeding) return;

      if (!(id in oldState)) {
        alerts.push({
          kind: hasAgentReplyBy_(threads, cfg.userId) ? 'reply' : 'new',
          conv: conv, id: id, prev: undefined
        });
      } else if (latest > oldState[id]) {
        alerts.push({ kind: 'reply', conv: conv, id: id, prev: oldState[id] });
      }
    });

    if (seeding) {
      props.setProperty(KEY_STATE, JSON.stringify(newState));
      Logger.log('First run: saved ' + convs.length + ' active ticket(s) silently.');
      onSuccess_(cfg);
      return;
    }

    var sendError = sendAlerts_(cfg, alerts, newState);
    props.setProperty(KEY_STATE, JSON.stringify(newState));
    if (sendError) throw sendError;

    onSuccess_(cfg);
    Logger.log('OK: ' + convs.length + ' active, ' + alerts.length + ' alert(s), ' +
      (Date.now() - started) + ' ms');
  } catch (e) {
    onFailure_(cfg || (e && e.cfg), e);
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Manual helpers (run from the Apps Script editor)                    */
/* ------------------------------------------------------------------ */

function testFreeScout() {
  var cfg = getConfig_(false, true);   // Telegram settings not needed for this test

  if (!cfg.mailboxId) {
    var mb = fsGet_(cfg, '/mailboxes', {});
    var list = (mb._embedded && mb._embedded.mailboxes) || [];
    Logger.log('FREESCOUT_MAILBOX_ID is empty. Mailboxes this key can see:');
    list.forEach(function (m) { Logger.log('  mailbox id ' + m.id + ' = ' + m.name); });
  }

  if (!cfg.userId) {
    Logger.log('FREESCOUT_USER_ID is empty. Looking up users:');
    try {
      var uPage = 1, uTotal = 1;
      do {
        var us = fsGet_(cfg, '/users', { pageSize: PAGE_SIZE, page: uPage });
        ((us._embedded && us._embedded.users) || []).forEach(function (u) {
          Logger.log('  user id ' + u.id + ' = ' + [u.firstName, u.lastName].join(' ').trim());
        });
        uTotal = (us.page && us.page.totalPages) || 1;
        uPage++;
      } while (uPage <= uTotal && uPage <= MAX_PAGES);
    } catch (e) {
      Logger.log('  /users not allowed (' + shortError_(e, cfg) + '). Assignees seen on recent tickets:');
      var params = { pageSize: PAGE_SIZE };
      if (cfg.mailboxId) params.mailboxId = cfg.mailboxId;
      var cs = fsGet_(cfg, '/conversations', params);
      var seen = {};
      ((cs._embedded && cs._embedded.conversations) || []).forEach(function (c) {
        if (c.assignee && !seen[c.assignee.id]) {
          seen[c.assignee.id] = true;
          Logger.log('  user id ' + c.assignee.id + ' = ' +
            [c.assignee.firstName, c.assignee.lastName].join(' ').trim());
        }
      });
    }
  }

  if (!cfg.mailboxId || !cfg.userId) {
    Logger.log('Add FREESCOUT_MAILBOX_ID and FREESCOUT_USER_ID to Script Properties, then run testFreeScout again.');
    return;
  }

  var t0 = Date.now();
  var convs = fetchActiveConversations_(cfg);
  Logger.log('User id: ' + cfg.userId + ', mailbox id: ' + cfg.mailboxId);
  Logger.log('Active tickets assigned to you: ' + convs.length + ' (fetched in ' + (Date.now() - t0) +
    ' ms; deleted/merged conversations ignored)');

  // Sample: an Active ticket if there is one, else your most recent Pending one.
  var c = convs[0];
  if (!c) {
    var p = fsGet_(cfg, '/conversations', { mailboxId: cfg.mailboxId, status: 'pending', assignedTo: cfg.userId,
      embed: 'threads', pageSize: 5, sortField: 'updatedAt', sortOrder: 'desc' });
    c = ((p._embedded && p._embedded.conversations) || []).filter(function (x) { return x.state === 'published'; })[0];
  }
  if (!c) { Logger.log('No sample ticket found.'); return; }
  var threads = getThreads_(cfg, c);
  var th = threads.filter(function (t) { return t.type === 'customer'; })[0] || threads[0] || {};
  Logger.log('Sample (' + c.status + '): conversation id ' + c.id + ', ticket number #' + c.number);
  Logger.log('Sample link: ' + cfg.url + '/conversation/' + c.id);
  Logger.log('Field check: number=' + (c.number !== undefined) + ', subject=' + (c.subject !== undefined) +
    ', state=' + c.state + ', assignee.id=' + (c.assignee ? c.assignee.id : 'missing') +
    ', threads embedded=' + Array.isArray(c._embedded && c._embedded.threads) +
    ', thread.createdAt=' + (th.createdAt !== undefined) +
    ', thread.createdBy.id=' + (th.createdBy ? th.createdBy.id !== undefined : 'missing'));
  Logger.log('Thread types on sample: ' + JSON.stringify(countTypes_(threads)) +
    ', latest customer reply: ' + new Date(latestCustomerTime_(threads)).toISOString() +
    ', has your reply: ' + hasAgentReplyBy_(threads, cfg.userId));
}

function testTelegram() {
  var cfg = getConfig_(false);
  sendAlert_(cfg, 'Test alert from FreeScout Alerts');
  Logger.log('Test alert sent. Check Telegram.');
}

/** Run once after sending any message to your bot. Logs your chat id. */
function findTelegramChatId() {
  var token = (PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN') || '').trim();
  if (!token) { Logger.log('Add TELEGRAM_BOT_TOKEN to Script Properties first.'); return; }
  var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getUpdates', { muteHttpExceptions: true });
  var data = {};
  try { data = JSON.parse(res.getContentText()); } catch (e) {}
  if (!data.ok) { Logger.log('Telegram error ' + res.getResponseCode() + ': ' + (data.description || 'bad token?')); return; }
  var seen = {};
  (data.result || []).forEach(function (u) {
    var m = u.message || u.edited_message || u.channel_post;
    if (m && m.chat && !seen[m.chat.id]) {
      seen[m.chat.id] = true;
      Logger.log('TELEGRAM_CHAT_ID = ' + m.chat.id + ' (' + (m.chat.type) + ')');
    }
  });
  var ids = Object.keys(seen);
  if (!ids.length) {
    Logger.log('No messages yet. Open your bot in Telegram, press Start or send "hi", then run this again.');
  } else if (ids.length === 1) {
    PropertiesService.getScriptProperties().setProperty('TELEGRAM_CHAT_ID', ids[0]);
    Logger.log('Saved TELEGRAM_CHAT_ID to Script Properties.');
  } else {
    Logger.log('Several chats found. Add the right TELEGRAM_CHAT_ID to Script Properties by hand.');
  }
}

function installTrigger() {
  removeTrigger();
  ScriptApp.newTrigger('checkTickets').timeBased().everyMinutes(TRIGGER_MINUTES).create();
  Logger.log('Trigger installed: checkTickets every ' + TRIGGER_MINUTES + ' minute(s).');
}

function removeTrigger() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'checkTickets') { ScriptApp.deleteTrigger(t); n++; }
  });
  Logger.log('Removed ' + n + ' checkTickets trigger(s).');
}

function resetState() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty(KEY_STATE);
  props.deleteProperty(KEY_FAIL_COUNT);
  props.deleteProperty(KEY_FAIL_ALERT_SENT);
  Logger.log('State cleared. Next run saves current tickets silently.');
}

/* ------------------------------------------------------------------ */
/* FreeScout                                                           */
/* ------------------------------------------------------------------ */

function fetchActiveConversations_(cfg) {
  var all = [];
  var page = 1, totalPages = 1;
  do {
    var data = fsGet_(cfg, '/conversations', {
      mailboxId: cfg.mailboxId,
      status: 'active',
      assignedTo: cfg.userId,
      embed: 'threads',
      pageSize: PAGE_SIZE,
      page: page
    });
    var list = (data._embedded && data._embedded.conversations) || [];
    all = all.concat(list);
    totalPages = (data.page && data.page.totalPages) || 1;
    page++;
  } while (page <= totalPages && page <= MAX_PAGES);

  // Keep only live (state=published) Active tickets assigned to this user.
  // FreeScout returns deleted/merged conversations with status=active too.
  return all.filter(function (c) {
    return c.status === 'active' && c.state === 'published' &&
      c.assignee && String(c.assignee.id) === String(cfg.userId);
  });
}

function getThreads_(cfg, conv) {
  var t = conv._embedded && conv._embedded.threads;
  if (Array.isArray(t)) return t;
  var full = fsGet_(cfg, '/conversations/' + conv.id, { embed: 'threads' });
  return (full._embedded && full._embedded.threads) || [];
}

function latestCustomerTime_(threads) {
  var max = 0;
  threads.forEach(function (t) {
    if (t.type === 'customer') {
      var ms = Date.parse(t.createdAt);
      if (ms > max) max = ms;
    }
  });
  return max;
}

function hasAgentReplyBy_(threads, userId) {
  return threads.some(function (t) {
    return t.type === 'message' && t.createdBy &&
      String(t.createdBy.id) === String(userId) && t.createdBy.type !== 'customer';
  });
}

function fsGet_(cfg, path, params) {
  var qs = Object.keys(params).map(function (k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');
  var res = UrlFetchApp.fetch(cfg.url + '/api' + path + (qs ? '?' + qs : ''), {
    method: 'get',
    headers: { 'X-FreeScout-API-Key': cfg.fsKey, 'Accept': 'application/json' },
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code !== 200) throw new Error('FreeScout HTTP ' + code);
  try {
    return JSON.parse(res.getContentText());
  } catch (e) {
    throw new Error('FreeScout returned non-JSON');
  }
}

/* ------------------------------------------------------------------ */
/* Alerts                                                              */
/* ------------------------------------------------------------------ */

function formatAlert_(cfg, a) {
  var head = a.kind === 'new' ? 'New ticket #' : 'Customer replied on #';
  return head + a.conv.number + '\n' + cleanTitle_(a.conv.subject) + '\n' +
    cfg.url + '/conversation/' + a.conv.id;
}

/** Sends alerts. On failure, rolls back unsent ones in newState so they retry. Returns error or null. */
function sendAlerts_(cfg, alerts, newState) {
  if (!alerts.length) return null;

  if (alerts.length > MAX_SEPARATE_ALERTS) {
    var lines = [alerts.length + ' ticket updates'];
    alerts.forEach(function (a) {
      lines.push((a.kind === 'new' ? 'New #' : 'Reply #') + a.conv.number + ' ' + cleanTitle_(a.conv.subject, 60));
    });
    lines.push(cfg.url + '/mailbox/' + cfg.mailboxId);
    try {
      sendAlert_(cfg, lines.join('\n'));
      return null;
    } catch (e) {
      alerts.forEach(function (a) { rollback_(newState, a); });
      return e;
    }
  }

  for (var i = 0; i < alerts.length; i++) {
    if (i > 0) Utilities.sleep(SEND_GAP_MS);
    try {
      sendAlert_(cfg, formatAlert_(cfg, alerts[i]));
    } catch (e) {
      for (var j = i; j < alerts.length; j++) rollback_(newState, alerts[j]);
      return e;
    }
  }
  return null;
}

function rollback_(newState, a) {
  if (a.prev === undefined) delete newState[a.id];
  else newState[a.id] = a.prev;
}

function sendAlert_(cfg, text) {
  var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + cfg.tgToken + '/sendMessage', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ chat_id: cfg.tgChat, text: text, disable_web_page_preview: true }),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  var data = {};
  try { data = JSON.parse(res.getContentText()); } catch (e) {}
  if (code !== 200 || !data.ok) {
    throw new Error('Telegram HTTP ' + code + ': ' + String(data.description || 'unknown error').slice(0, 100));
  }
}

function onSuccess_(cfg) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(KEY_FAIL_ALERT_SENT) === 'yes') {
    try {
      sendAlert_(cfg, 'FreeScout check working again');
      props.deleteProperty(KEY_FAIL_ALERT_SENT);
    } catch (e) {
      Logger.log('Recovery alert failed: ' + shortError_(e, cfg));
    }
  }
  props.setProperty(KEY_FAIL_COUNT, '0');
}

function onFailure_(cfg, e) {
  var props = PropertiesService.getScriptProperties();
  var count = Number(props.getProperty(KEY_FAIL_COUNT) || 0) + 1;
  props.setProperty(KEY_FAIL_COUNT, String(count));
  var reason = shortError_(e, cfg);
  Logger.log('Check failed (' + count + ' in a row): ' + reason);

  if (count >= FAILS_BEFORE_ALERT && props.getProperty(KEY_FAIL_ALERT_SENT) !== 'yes' && cfg && cfg.tgToken && cfg.tgChat) {
    try {
      sendAlert_(cfg, 'FreeScout check failing\nReason: ' + reason + '\nAlerts are paused until it recovers.');
      props.setProperty(KEY_FAIL_ALERT_SENT, 'yes');
    } catch (e2) {
      Logger.log('Failure alert could not be sent: ' + shortError_(e2, cfg));
    }
  }
}

/* ------------------------------------------------------------------ */
/* Utils                                                               */
/* ------------------------------------------------------------------ */

function getConfig_(requireIds, skipTelegram) {
  var p = PropertiesService.getScriptProperties();
  var cfg = {
    url: (p.getProperty('FREESCOUT_URL') || '').trim().replace(/\/+$/, ''),
    fsKey: (p.getProperty('FREESCOUT_API_KEY') || '').trim(),
    mailboxId: (p.getProperty('FREESCOUT_MAILBOX_ID') || '').trim(),
    userId: (p.getProperty('FREESCOUT_USER_ID') || '').trim(),
    tgToken: (p.getProperty('TELEGRAM_BOT_TOKEN') || '').trim(),
    tgChat: (p.getProperty('TELEGRAM_CHAT_ID') || '').trim()
  };
  var missing = [];
  if (!cfg.url) missing.push('FREESCOUT_URL');
  if (!cfg.fsKey) missing.push('FREESCOUT_API_KEY');
  if (!skipTelegram && !cfg.tgToken) missing.push('TELEGRAM_BOT_TOKEN');
  if (!skipTelegram && !cfg.tgChat) missing.push('TELEGRAM_CHAT_ID');
  if (requireIds && !cfg.mailboxId) missing.push('FREESCOUT_MAILBOX_ID');
  if (requireIds && !cfg.userId) missing.push('FREESCOUT_USER_ID');
  if (missing.length) {
    var err = new Error('Missing Script Properties: ' + missing.join(', '));
    err.cfg = cfg;
    throw err;
  }
  return cfg;
}

function cleanTitle_(s, max) {
  max = max || 150;
  s = String(s || '(no subject)').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** Short error text with any secrets masked (UrlFetchApp errors can include the URL). */
function shortError_(e, cfg) {
  var msg = String((e && e.message) || e);
  var c = cfg || (e && e.cfg) || {};
  [c.fsKey, c.tgToken].forEach(function (s) {
    if (s) msg = msg.split(s).join('***');
  });
  msg = msg.replace(/\/bot[^\/\s]+/g, '/bot***');
  return msg.replace(/\s+/g, ' ').slice(0, 120);
}

function countTypes_(threads) {
  var types = {};
  threads.forEach(function (t) { types[t.type] = (types[t.type] || 0) + 1; });
  return types;
}
