const router = require('express').Router();

router.get('/health', async (req, res) => {
  try {
    const pool = await req.app.locals.getPool();
    await pool.request().query('SELECT 1 AS ok');
    res.json({ success: true, data: { db: 'up' } });
  } catch {
    res.status(503).json({ success: false, error: 'Database unavailable' });
  }
});

module.exports = router;
