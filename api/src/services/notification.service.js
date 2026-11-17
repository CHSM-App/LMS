const { query, one, T } = require('../db/query');
const { msg } = require('../i18n/messages');

// notify(userId, { key, vars, link }) renders the message in the user's language.
// Plain { title, message } is also accepted.
async function notify(userId, { key, vars, title, message, link }, tx) {
  let t = title;
  let m = message;
  if (key) {
    const u = await one('SELECT preferred_lang FROM dbo.users WHERE user_id = @id', { id: T.int(userId) }, tx);
    const lang = (u && u.preferred_lang) || 'en';
    t = msg(lang, `${key}.title`, vars);
    m = msg(lang, `${key}.body`, vars);
  }
  await query(
    'INSERT INTO dbo.notifications (user_id, title, message, link) VALUES (@u, @t, @m, @l)',
    { u: T.int(userId), t: T.nvarchar(t.slice(0, 160), 160), m: T.nvarchar(m.slice(0, 1000), 1000), l: T.varchar(link || null, 300) },
    tx,
  );
}

async function notifyMany(userIds, payload, tx) {
  for (const id of [...new Set(userIds)]) await notify(id, payload, tx);
}

async function notifyAdmins(payload, tx) {
  const admins = await query("SELECT user_id FROM dbo.users WHERE role = 'admin' AND status = 'approved' AND deleted_at IS NULL", {}, tx);
  await notifyMany(admins.map((a) => a.user_id), payload, tx);
}

module.exports = { notify, notifyMany, notifyAdmins };
