const { maskMobile } = require('../../utils/mobile');

// WhatsApp sender. 'console' (dev) logs and records messages; 'meta' uses the WhatsApp Cloud API
// (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID). Real sending is completed in Phase 7/10.
const sent = [];

const consoleProvider = {
  name: 'console',
  async send(mobile, text, meta = {}) {
    sent.push({ mobile, text, ...meta });
    if (process.env.NODE_ENV === 'development') console.log(`[whatsapp] to ${maskMobile(mobile)}: ${text}`);
    return { ok: true };
  },
};

const metaProvider = {
  name: 'meta',
  async send(mobile, text) {
    const res = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: mobile.replace('+', ''), type: 'text', text: { body: text } }),
    });
    if (!res.ok) throw new Error(`WhatsApp API responded ${res.status}`);
    return { ok: true };
  },
};

function provider() {
  return (process.env.WHATSAPP_PROVIDER || 'console') === 'meta' ? metaProvider : consoleProvider;
}

// wa.me link with the message typed, used as the fallback when the API is not configured or fails.
function fallbackUrl(mobile, text) {
  return `https://wa.me/${mobile.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

module.exports = {
  send: (mobile, text, meta) => provider().send(mobile, text, meta),
  fallbackUrl,
  sentMessages: () => sent,
  clearSent: () => sent.splice(0, sent.length),
};
