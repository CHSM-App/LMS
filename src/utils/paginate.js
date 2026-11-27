function paginate({ page, limit } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  return { page: p, limit: l, offset: (p - 1) * l };
}

function pageResult(rows, total, { page, limit }) {
  return { rows, pagination: { page, limit, total } };
}

module.exports = { paginate, pageResult };
