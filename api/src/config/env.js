const path = require('path');

const REQUIRED = ['DB_SERVER', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'OTP_SECRET', 'WEB_ORIGIN'];

function loadConfig(env = process.env) {
  for (const key of REQUIRED) {
    if (!env[key]) throw new Error(`Missing env: ${key}`);
  }
  // Dev/demo only: every OTP becomes this code. Never allowed in production.
  const otpFixedCode = env.OTP_FIXED_CODE || null;
  if (otpFixedCode) {
    if (!/^\d{6}$/.test(otpFixedCode)) throw new Error('OTP_FIXED_CODE must be 6 digits');
    if (env.NODE_ENV === 'production') throw new Error('OTP_FIXED_CODE is not allowed in production');
  }
  return {
    // iisnode (Plesk on Windows) passes a named pipe in PORT, not a number: keep it as a string.
    port: !env.PORT ? 4000 : /^\d+$/.test(env.PORT) ? Number(env.PORT) : env.PORT,
    nodeEnv: env.NODE_ENV || 'development',
    db: {
      server: env.DB_SERVER,
      instanceName: env.DB_INSTANCE || undefined,
      port: env.DB_PORT ? Number(env.DB_PORT) : undefined,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      encrypt: env.DB_ENCRYPT === 'true',
      trustServerCertificate: env.DB_TRUST_SERVER_CERT === 'true',
    },
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessTtlSec: 15 * 60,
      refreshTtlDays: 30,
    },
    otpSecret: env.OTP_SECRET,
    otpFixedCode,
    downloadKeySecret: env.DOWNLOAD_KEY_SECRET || env.OTP_SECRET,
    fileSigningSecret: env.FILE_SIGNING_SECRET || env.OTP_SECRET,
    webOrigin: env.WEB_ORIGIN,
    providers: {
      otp: env.OTP_PROVIDER || 'console',
      whatsapp: env.WHATSAPP_PROVIDER || 'console',
      meet: env.MEET_PROVIDER || 'console',
    },
    storageDir: path.resolve(env.STORAGE_DIR || './storage'),
    supportContact: env.SUPPORT_CONTACT || '',
    policyVersion: env.POLICY_VERSION || '1.0',
  };
}

let cached;
function config() {
  if (!cached) cached = loadConfig(process.env);
  return cached;
}

module.exports = { loadConfig, config };
