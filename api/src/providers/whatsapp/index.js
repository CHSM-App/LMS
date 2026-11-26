const { maskMobile } = require('../../utils/mobile');

// WhatsApp sender, switched by WHATSAPP_PROVIDER:
//   console - dev/test: logs and records messages
//   smsala  - SMSALA (WhatsApp BSP): WHATSAPP_API_TOKEN and WHATSAPP_TPL_<KEY> numeric template ids (see ./smsala.js)
//   meta    - WhatsApp Cloud API (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID). Business-initiated messages
//             must use approved templates; each template's name can be overridden with
//             WHATSAPP_TEMPLATE_<KEY> (e.g. WHATSAPP_TEMPLATE_LIVE_CLASS=lms_live_class_v2).
const sent = [];

// Body parameters ({{1}}, {{2}}, ...) of each approved template, in order. Keep in sync with docs/BACKEND_NEEDS.md.
const TEMPLATE_PARAMS = {
  demo_scheduled: ['name', 'course', 'date', 'time', 'link'],
  live_class: ['topic', 'course', 'date', 'time', 'link'],
  enrollment_approved: ['course', 'batch'],
  subscription_reminder: ['name', 'end'],
};
const LANGS = { en: 'en', mr: 'mr', hi: 'hi' };

const consoleProvider = {
  name: 'console',
  async send(mobile, text, meta = {}) {
    const { vars, ...rest } = meta;
    sent.push({ mobile, text, ...rest });
    if (process.env.NODE_ENV === 'development') console.log(`[whatsapp] to ${maskMobile(mobile)}: ${text}`);
    return { ok: true };
  },
};

function templateBody(template, lang, vars = {}) {
  const name = process.env[`WHATSAPP_TEMPLATE_${template.toUpperCase()}`] || template;
  const params = (TEMPLATE_PARAMS[template] || []).map((k) => ({ type: 'text', text: String(vars[k] ?? '') }));
  return { name, language: { code: LANGS[lang] || 'en' }, components: [{ type: 'body', parameters: params }] };
}

const metaProvider = {
  name: 'meta',
  async send(mobile, text, { template, lang, vars } = {}) {
    const to = mobile.replace(/\D/g, '');
    const payload = template
      ? { messaging_product: 'whatsapp', to, type: 'template', template: templateBody(template, lang, vars) }
      : { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } };
    const res = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`WhatsApp API responded ${res.status}`);
    return { ok: true };
  },
};

function provider() {
  const name = process.env.WHATSAPP_PROVIDER || 'console';
  if (name === 'meta') return metaProvider;
  if (name === 'smsala') return require('./smsala');
  return consoleProvider;
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
  TEMPLATE_PARAMS,
};
