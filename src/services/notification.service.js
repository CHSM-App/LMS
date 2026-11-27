const { query, one, T } = require('../db/query');
const { msg } = require('../i18n/messages');
const whatsapp = require('../providers/whatsapp');
const push = require('../providers/push');
const logger = require('../utils/logger');

// notify(userId, { key, vars, link, whatsapp? }, tx?)
// - The in-app message is always written, in the user's preferred language.
// - WhatsApp ({ key, vars?, template }) is sent only to users who opted in and are not blocked or deleted.
//   Inside a transaction it is sent after the commit, so a rolled-back change never messages anyone.
// Returns { whatsapp: 'sent' | 'skipped' | 'failed' | 'queued' }.
async function notify(userId, { key, vars, title, message, link, whatsapp: wa }, tx) {
  const u = await one(
    'SELECT preferred_lang, mobile, whatsapp_opt_in, status, deleted_at FROM dbo.users WHERE user_id = @id',
    { id: T.int(userId) },
    tx,
  );
  const lang = (u && u.preferred_lang) || 'en';
  const t = key ? msg(lang, `${key}.title`, vars) : title;
  const m = key ? msg(lang, `${key}.body`, vars) : message;
  await query(
    'INSERT INTO dbo.notifications (user_id, title, message, link) VALUES (@u, @t, @m, @l)',
    { u: T.int(userId), t: T.nvarchar(t.slice(0, 160), 160), m: T.nvarchar(m.slice(0, 1000), 1000), l: T.varchar(link || null, 300) },
    tx,
  );

  // Push to the user's phones. Never throws, and inside a transaction it waits for the commit.
  if (u && u.status !== 'blocked' && !u.deleted_at) {
    const sendPush = async () => {
      try {
        const tokens = await query('SELECT token FROM dbo.push_tokens WHERE user_id = @id', { id: T.int(userId) });
        for (const { token } of tokens) {
          const r = await push.send({ token, title: t, body: m, link: link || '' });
          if (r.invalidToken) await query('DELETE FROM dbo.push_tokens WHERE token = @tok', { tok: T.varchar(token, 512) });
        }
      } catch (err) {
        logger.warn({ event: 'push_failed', err: err.message });
      }
    };
    if (tx && tx.afterCommit) tx.afterCommit(sendPush);
    else await sendPush();
  }

  if (!wa) return { whatsapp: 'skipped' };
  if (!u || !u.whatsapp_opt_in || u.status === 'blocked' || u.deleted_at) return { whatsapp: 'skipped' };
  const waVars = wa.vars || vars || {};
  const send = async () => {
    try {
      await whatsapp.send(u.mobile, msg(lang, wa.key, waVars), { template: wa.template, lang, vars: waVars });
      return { whatsapp: 'sent' };
    } catch (err) {
      logger.warn({ event: 'whatsapp_failed', template: wa.template, err: err.message });
      return { whatsapp: 'failed' };
    }
  };
  if (tx && tx.afterCommit) {
    tx.afterCommit(send);
    return { whatsapp: 'queued' };
  }
  return send();
}

async function notifyMany(userIds, payload, tx) {
  for (const id of [...new Set(userIds)]) await notify(id, payload, tx);
}

async function notifyAdmins(payload, tx) {
  const admins = await query("SELECT user_id FROM dbo.users WHERE role = 'admin' AND status = 'approved' AND deleted_at IS NULL", {}, tx);
  await notifyMany(admins.map((a) => a.user_id), payload, tx);
}

module.exports = { notify, notifyMany, notifyAdmins };
