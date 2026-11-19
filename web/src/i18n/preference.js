// Whose language wins after login: the one the person picked on this device, or the one saved on their account.
const KEY = 'langChosen';

export function markLanguageChosen() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* storage unavailable */
  }
}

export function wasLanguageChosen() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

// chosen: picked on this device; account: saved on the account; current: shown now.
// Returns what to switch the screen to (apply) and what to save to the account (save).
export function resolveLoginLanguage({ chosen, account, current }) {
  if (chosen) return { apply: null, save: account === current ? null : current };
  if (account && account !== current) return { apply: account, save: null };
  return { apply: null, save: null };
}
