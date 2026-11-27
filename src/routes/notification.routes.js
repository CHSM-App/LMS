const router = require('express').Router();
const { h, page } = require('../utils/http');
const { authenticate } = require('../middlewares/authenticate');
const { paginate } = require('../utils/paginate');
const { query, one, T } = require('../db/query');
const { notFound } = require('../utils/APIError');

router.use('/notifications', authenticate);

router.get('/notifications', h(async (req) => {
  const p = paginate(req.query);
  const unread = req.query.unread === 'true';
  const params = { u: T.int(req.user.id), unread: T.bit(unread), off: T.int(p.offset), lim: T.int(p.limit) };
  const where = 'WHERE user_id = @u AND (@unread = 0 OR is_read = 0)';
  const rows = await query(
    `SELECT notification_id, title, message, link, is_read, created_at FROM dbo.notifications ${where}
     ORDER BY created_at DESC, notification_id DESC OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY`,
    params,
  );
  const { n } = await one(`SELECT COUNT(*) n FROM dbo.notifications ${where}`, params);
  return page(rows.map((r) => ({ id: r.notification_id, title: r.title, message: r.message, link: r.link, isRead: r.is_read, createdAt: r.created_at })), n, p);
}));

router.post('/notifications/read-all', h(async (req) => {
  await query('UPDATE dbo.notifications SET is_read = 1 WHERE user_id = @u AND is_read = 0', { u: T.int(req.user.id) });
  return { done: true };
}));

router.post('/notifications/:id/read', h(async (req) => {
  const rows = await query(
    'UPDATE dbo.notifications SET is_read = 1 OUTPUT INSERTED.notification_id WHERE notification_id = @id AND user_id = @u',
    { id: T.int(Number(req.params.id)), u: T.int(req.user.id) },
  );
  if (!rows.length) throw notFound('Notification not found');
  return { id: rows[0].notification_id, isRead: true };
}));

module.exports = router;
