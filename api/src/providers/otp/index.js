const providers = { console: require('./console'), msg91: require('./msg91'), smsala: require('./smsala') };

function otpSender() {
  const name = process.env.OTP_PROVIDER || 'console';
  if (name === 'console' && process.env.NODE_ENV === 'production') {
    throw new Error('OTP_PROVIDER=console is not allowed in production');
  }
  return providers[name] || providers.console;
}

module.exports = { otpSender };
