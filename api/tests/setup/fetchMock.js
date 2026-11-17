// Minimal fetch stub for provider tests: queue replies, record what was sent, refuse anything unexpected.
function fetchMock() {
  const replies = [];
  const calls = [];
  const original = global.fetch;
  global.fetch = async (url, init = {}) => {
    const u = String(url);
    const i = replies.findIndex((r) => u.startsWith(r.prefix));
    if (i === -1) throw new Error(`Unexpected request to ${u}`);
    const [r] = replies.splice(i, 1);
    const headers = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    let body = init.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {
        body = Object.fromEntries(new URLSearchParams(body));
      }
    }
    calls.push({ url: u, method: init.method || 'GET', headers, body });
    const json = typeof r.json === 'function' ? r.json(body) : r.json;
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => json, text: async () => JSON.stringify(json ?? '') };
  };
  return {
    reply(prefix, status, json = {}) {
      replies.push({ prefix, status, json });
      return this;
    },
    calls,
    pending: () => replies.length,
    restore() {
      global.fetch = original;
    },
  };
}

module.exports = { fetchMock };
