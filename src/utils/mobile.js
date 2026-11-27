// Indian mobile numbers only, stored as +91XXXXXXXXXX (10 digits starting 6-9).
function normalizeMobile(input) {
  if (typeof input !== 'string') return null;
  let digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return `+91${digits}`;
}

function maskMobile(mobile) {
  if (!mobile) return '';
  const d = mobile.replace(/^\+91/, '');
  if (d.length !== 10) return 'XXXXXXXXXX';
  return `${d.slice(0, 2)}XXXXXX${d.slice(-2)}`;
}

module.exports = { normalizeMobile, maskMobile };
