// WhatsApp template messages through SMSALA. Enabled with WHATSAPP_PROVIDER=smsala.
// Env: WHATSAPP_API_TOKEN, and WHATSAPP_TPL_<KEY> = the numeric id of the approved template
// (KEY is the template key upper-cased, e.g. WHATSAPP_TPL_LIVE_CLASS=959).
// SMSALA takes the template variables as ONE comma-separated "Sample" string, in template order,
// so commas inside a value are removed and empty values become "-".
const URL = 'https://api2.smsala.com/whatsapp/SendMessage';

const clean = (v) => String(v ?? '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim() || '-';

module.exports = {
  name: 'smsala',
  async send(mobile, text, { template, vars } = {}) {
    if (!template) throw new Error('SMSALA needs an approved template; plain text is not supported');
    const token = process.env.WHATSAPP_API_TOKEN;
    if (!token) throw new Error('WHATSAPP_API_TOKEN is not set');
    const envKey = `WHATSAPP_TPL_${template.toUpperCase()}`;
    const templateId = process.env[envKey];
    if (!templateId) throw new Error(`${envKey} is not set`);

    const order = require('./index').TEMPLATE_PARAMS[template] || [];
    const body = new URLSearchParams({
      ApiToken: token,
      TemplateId: templateId,
      QuickNumber: mobile.replace(/\D/g, ''),
      Sample: order.map((k) => clean((vars || {})[k])).join(','),
      CampaignName: template,
    });
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`SMSALA responded ${res.status}`);
    const reply = await res.json().catch(() => ({}));
    if (reply.IsSuccess !== true && reply.ErrorCode !== 0) {
      throw new Error(`SMSALA failed: ${reply.ErrorDescription || 'unknown'}`);
    }
    return { ok: true, campaignId: reply.ReturnData };
  },
};
