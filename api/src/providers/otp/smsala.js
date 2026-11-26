// OTP over WhatsApp through SMSALA. Enabled with OTP_PROVIDER=smsala.
// Env: WHATSAPP_API_TOKEN, WHATSAPP_TPL_OTP (the approved Authentication template id).
// Errors never include the token or the code.
const logger = require('../../utils/logger');
const { maskMobile } = require('../../utils/mobile');

module.exports = {
  name: 'smsala',
  async send(mobile, code) {
    const token = process.env.WHATSAPP_API_TOKEN;
    if (!token) throw new Error('WHATSAPP_API_TOKEN is not set');
    const res = await fetch('https://api2.smsala.com/whatsapp/SendOtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        PhoneNumber: mobile.replace(/\D/g, ''),
        OtpCode: code,
        ApiToken: token,
        TemplateId: process.env.WHATSAPP_TPL_OTP || undefined,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`SMSALA responded ${res.status}`);
    const body = await res.json().catch(() => ({}));
    // Provider reply only (no token, no code, no number) so a missing message can be traced in SMSALA's logs.
    logger.info({
      event: 'smsala_otp_reply', mobile: maskMobile(mobile), isSuccess: body.IsSuccess, errorCode: body.ErrorCode,
      description: body.ErrorDescription, campaignId: body.ReturnData,
    });
    if (body.IsSuccess !== true && body.ErrorCode !== 0) {
      throw new Error(`SMSALA OTP failed: ${body.ErrorDescription || 'unknown'}`);
    }
  },
};
