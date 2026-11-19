import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../../i18n';
import { Icon } from '../../components/Icon';

// A native <select> styled as a quiet pill: globe + language + chevron. Keeps keyboard and screen reader support.
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  return (
    <label className="lang">
      <span className="visually-hidden">{t('common.language')}</span>
      <Icon name="globe" size={16} className="lang__globe" />
      <select className="lang__select" value={i18n.language} onChange={(e) => i18n.changeLanguage(e.target.value)}>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
      <Icon name="chevronDown" size={14} className="lang__chevron" />
    </label>
  );
}
