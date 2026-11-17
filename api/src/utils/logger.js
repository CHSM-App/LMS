// One-line JSON logs for provider/job events. Callers pass event names and error messages only —
// never tokens, OTPs, full mobile numbers or request bodies. Silent under tests.
const write = (level) => (fields) => {
  if (process.env.NODE_ENV === 'test') return;
  const line = JSON.stringify({ level, at: new Date().toISOString(), ...fields });
  (level === 'error' ? console.error : console.log)(line);
};

module.exports = { info: write('info'), warn: write('warn'), error: write('error') };
