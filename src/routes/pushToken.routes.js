const router = require('express').Router();
const { h } = require('../utils/http');
const { authenticate } = require('../middlewares/authenticate');
const { query, T } = require('../db/query');
const { text } = require('../utils/validate');
const { badRequest } = require('../utils/APIError');

router.use('/push-tokens', authenticate);

// The app registers its Firebase token after login. A token belongs to one user: if a phone is
// shared, the latest login takes it over.
router.post('/push-tokens', h(async (req) => {
  const token = text(req.body.token, 'token', { min: 20, max: 512 });
  const platform = String(req.body.platform || '');
  if (!['android', 'ios', 'web'].includes(platform)) throw badRequest('platform must be android, ios or web', 'VALIDATION_ERROR', { field: 'platform' });
  await query(
    `MERGE dbo.push_tokens AS t USING (SELECT @tok AS token) AS s ON t.token = s.token
     WHEN MATCHED THEN UPDATE SET user_id = @u, platform = @p, updated_at = SYSUTCDATETIME()
     WHEN NOT MATCHED THEN INSERT (user_id, token, platform) VALUES (@u, @tok, @p);`,
    { tok: T.varchar(token, 512), u: T.int(req.user.id), p: T.varchar(platform, 10) },
  );
  return { registered: true };
}));

// Called on logout so the phone stops getting this user's messages.
router.delete('/push-tokens', h(async (req) => {
  const token = text(req.body.token, 'token', { min: 20, max: 512 });
  await query('DELETE FROM dbo.push_tokens WHERE token = @tok AND user_id = @u', { tok: T.varchar(token, 512), u: T.int(req.user.id) });
  return { removed: true };
}));

module.exports = router;
