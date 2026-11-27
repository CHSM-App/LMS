const { maskMobile } = require('../../utils/mobile');

// Development/test OTP sender: logs the code (never in production) and remembers it for tests.
const last = new Map();

module.exports = {
  name: 'console',
  async send(mobile, code, purpose) {
    last.set(`${mobile}|${purpose}`, code);
    if (process.env.NODE_ENV === 'development') console.log(`[otp] ${purpose} OTP for ${maskMobile(mobile)}: ${code}`);
  },
  lastCode(mobile, purpose) {
    return last.get(`${mobile}|${purpose}`);
  },
  clear() {
    last.clear();
  },
};
