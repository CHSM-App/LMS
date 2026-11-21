import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../../i18n';
import { markLanguageChosen } from '../../i18n/preference';
import { api } from '../../api/client';
import { useAuth } from '../AuthProvider';
import { Icon } from '../../components/Icon';

// The quiet pill (globe + language + chevron) opens a styled list with a tick on the current language,
// instead of the browser's own list. Keyboard: Arrow keys, Home/End, Enter/Space, Escape.
// The choice is remembered on this device and, when signed in, saved to the account.
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef(null);
  const list = useRef(null);
  const id = useId();
  const currentIndex = Math.max(0, LANGUAGES.findIndex((l) => l.code === i18n.language));

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (root.current && !root.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  useEffect(() => { if (open && list.current) list.current.focus(); }, [open]);

  const focusButton = () => root.current.querySelector('button').focus();
  const choose = (i) => {
    const lang = LANGUAGES[i].code;
    setOpen(false);
    focusButton();
    if (lang === i18n.language) return;
    markLanguageChosen();
    i18n.changeLanguage(lang);
    if (user) api.put('/account/language', { preferredLang: lang }).catch(() => {});
  };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); focusButton(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, LANGUAGES.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(LANGUAGES.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div className="lang" ref={root}>
      <button type="button" className="lang__select" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => { setActive(currentIndex); setOpen((o) => !o); }}>
        <span className="visually-hidden">{t('common.language')}: </span>
        {LANGUAGES[currentIndex].label}
      </button>
      <Icon name="globe" size={16} className="lang__globe" />
      <Icon name="chevronDown" size={14} className="lang__chevron" />
      {open && (
        <ul id={id} ref={list} className="lang__list" role="listbox" tabIndex={-1} aria-label={t('common.language')}
          aria-activedescendant={`${id}-${active}`} onKeyDown={onKeyDown}>
          {LANGUAGES.map((l, i) => (
            <li key={l.code} id={`${id}-${i}`} role="option" lang={l.code} aria-selected={i === currentIndex}
              className={`lang__opt${i === active ? ' lang__opt--active' : ''}`}
              onMouseEnter={() => setActive(i)} onClick={() => choose(i)}>
              <span>{l.label}</span>
              {i === currentIndex && <Icon name="check" size={16} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
