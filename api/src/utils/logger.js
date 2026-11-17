// One-line JSON logs for security, provider and job events. Callers pass event names, ids and masked
// mobiles only — never tokens, OTPs, full mobile numbers or request bodies. Silent under tests unless a
// test installs a sink to assert on what would be logged.
let sink = null;

const write = (level) => (fields) => {
  const entry = { level, at: new Date().toISOString(), ...fields };
  if (sink) return sink(entry);
  if (process.env.NODE_ENV === 'test') return undefined;
  const line = JSON.stringify(entry);
  return (level === 'error' ? console.error : console.log)(line);
};

module.exports = {
  info: write('info'),
  warn: write('warn'),
  error: write('error'),
  /** Tests only: route log entries to fn (null restores normal output). */
  setSink: (fn) => {
    sink = fn;
  },
};
