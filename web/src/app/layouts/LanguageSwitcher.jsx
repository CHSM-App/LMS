import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../../i18n';
import { markLanguageChosen } from '../../i18n/preference';
import { api } from '../../api/client';
import { useAuth } from '../AuthProvider';
import { Icon } from '../../components/Icon';

// A native <select> styled as a quiet pill: globe + language + chevron. Keeps keyboard and screen reader support.
// The choice is remembered on this device and, when signed in, saved to the account.
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const onChange = (e) => {
    const lang = e.target.value;
    markLanguageChosen();
    i18n.changeLanguage(lang);
    if (user) api.put('/account/language', { preferredLang: lang }).catch(() => {});
  };
  return (
    <label className="lang">
      <span className="visually-hidden">{t('common.language')}</span>
      <Icon name="globe" size={16} className="lang__globe" />
      <select className="lang__select" value={i18n.language} onChange={onChange}>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
      <Icon name="chevronDown" size={14} className="lang__chevron" />
    </label>
  );
}
