const providers = { console: require('./console'), msg91: require('./msg91'), smsala: require('./smsala') };

function otpSender() {
  const name = process.env.OTP_PROVIDER || 'console';
  // The console provider is dev-only. ALLOW_FIXED_OTP_IN_PRODUCTION=true is the same deliberate test opt-in as in config/env.js.
  if (name === 'console' && process.env.NODE_ENV === 'production' && process.env.ALLOW_FIXED_OTP_IN_PRODUCTION !== 'true') {
    throw new Error('OTP_PROVIDER=console is not allowed in production');
  }
  return providers[name] || providers.console;
}

module.exports = { otpSender };
