// Same rule as the API: 10-digit Indian mobile starting 6-9 (+91 / 0 prefixes allowed).
export function isValidMobile(input) {
  let d = String(input || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d);
}

const locale = (lang) => (lang === 'en' || !lang ? 'en-IN' : `${lang}-IN`);

export function formatDate(value, lang = 'en') {
  if (!value) return '';
  const d = new Date(String(value).length === 10 ? `${value}T00:00:00` : value);
  return d.toLocaleDateString(locale(lang), { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(value, lang = 'en') {
  if (!value) return '';
  return new Date(value).toLocaleString(locale(lang), { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function formatTime(value, lang = 'en') {
  if (!value) return '';
  return new Date(value).toLocaleTimeString(locale(lang), { hour: 'numeric', minute: '2-digit' });
}

// "Thursday, 19 November" for dashboard headers.
export function formatLongDay(value, lang = 'en') {
  return new Date(value).toLocaleDateString(locale(lang), { weekday: 'long', day: 'numeric', month: 'long' });
}

// "today", "yesterday", "3 days ago" (calendar days, in the viewer's language).
export function formatRelativeDay(value, lang = 'en', now = new Date()) {
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(new Date(value))) / 86400000);
  return new Intl.RelativeTimeFormat(locale(lang), { numeric: 'auto' }).format(-days, 'day');
}

export const todayISO = () => new Date().toISOString().slice(0, 10);
