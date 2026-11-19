import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthContext } from './AuthProvider';
import { LanguageSwitcher } from './layouts/LanguageSwitcher';
import { resolveLoginLanguage } from '../i18n/preference';
import i18n from '../i18n';
import * as client from '../api/client';

afterEach(async () => {
  vi.restoreAllMocks();
  localStorage.clear();
  await i18n.changeLanguage('en');
});

test('after login: a language picked on this device wins and is saved to the account', () => {
  expect(resolveLoginLanguage({ chosen: true, account: 'mr', current: 'en' })).toEqual({ apply: null, save: 'en' });
  expect(resolveLoginLanguage({ chosen: true, account: 'en', current: 'en' })).toEqual({ apply: null, save: null });
});

test('after login: with no choice on this device, the account language is used', () => {
  expect(resolveLoginLanguage({ chosen: false, account: 'mr', current: 'en' })).toEqual({ apply: 'mr', save: null });
  expect(resolveLoginLanguage({ chosen: false, account: null, current: 'en' })).toEqual({ apply: null, save: null });
});

test('switching language while signed in saves it to the account', async () => {
  const put = vi.spyOn(client.api, 'put').mockResolvedValue({ data: { preferredLang: 'mr' } });
  render(<AuthContext.Provider value={{ user: { role: 'teacher', name: 'Priya' } }}><LanguageSwitcher /></AuthContext.Provider>);
  await userEvent.selectOptions(screen.getByLabelText('Language'), 'mr');
  expect(put).toHaveBeenCalledWith('/account/language', { preferredLang: 'mr' });
  expect(localStorage.getItem('langChosen')).toBe('1');
});

test('switching language when signed out only remembers it on this device', async () => {
  const put = vi.spyOn(client.api, 'put');
  render(<AuthContext.Provider value={{ user: null }}><LanguageSwitcher /></AuthContext.Provider>);
  await userEvent.selectOptions(screen.getByLabelText('Language'), 'hi');
  expect(put).not.toHaveBeenCalled();
  expect(localStorage.getItem('langChosen')).toBe('1');
});
