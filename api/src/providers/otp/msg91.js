// MSG91 OTP (India, DLT-registered template). Enabled with OTP_PROVIDER=msg91.
// Env: MSG91_AUTH_KEY, MSG91_TEMPLATE_ID.
module.exports = {
  name: 'msg91',
  async send(mobile, code) {
    const res = await fetch('https://control.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authkey: process.env.MSG91_AUTH_KEY },
      body: JSON.stringify({ template_id: process.env.MSG91_TEMPLATE_ID, mobile: mobile.replace('+', ''), otp: code }),
    });
    if (!res.ok) throw new Error(`MSG91 responded ${res.status}`);
    const body = await res.json().catch(() => ({}));
    if (body.type && body.type !== 'success') throw new Error(`MSG91 error: ${body.message || 'unknown'}`);
  },
};
