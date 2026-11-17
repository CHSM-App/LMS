// Wraps an async handler: returned value becomes { success: true, data }.
// Return { __page: true, rows, pagination } for lists, or call res yourself and return undefined.
function h(fn, status = 200) {
  return async (req, res, next) => {
    try {
      const out = await fn(req, res);
      if (res.headersSent || out === undefined) return;
      if (out && out.__page) {
        res.status(status).json({ success: true, data: out.rows, pagination: out.pagination });
      } else {
        res.status(status).json({ success: true, data: out });
      }
    } catch (err) {
      next(err);
    }
  };
}

const page = (rows, total, { page: p, limit }) => ({ __page: true, rows, pagination: { page: p, limit, total } });

const clientIp = (req) => (req.ip || '').replace('::ffff:', '').slice(0, 45);

module.exports = { h, page, clientIp };
