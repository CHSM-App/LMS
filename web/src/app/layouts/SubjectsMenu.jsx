import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { Icon } from '../../components/Icon';

// Public header "Subjects" menu: every subject with its course count, with a find box so it
// keeps working with hundreds of subjects. Choosing one opens the catalogue filtered to it (?subject=).
export function SubjectsMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [find, setFind] = useState('');
  const root = useRef(null);
  const input = useRef(null);
  const id = useId();

  const filters = useQuery({ queryKey: ['public', 'filters'], queryFn: () => api.get('/public/filters'), staleTime: 300000 });
  const data = filters.data?.data;
  const items = data?.subjectCounts || (data?.subjects || []).map((s) => ({ subject: s }));
  const shown = items.filter((i) => i.subject.toLowerCase().includes(find.trim().toLowerCase()));

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (root.current && !root.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); root.current.querySelector('button').focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    if (input.current) input.current.focus();
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (items.length === 0) return null; // nothing to browse yet

  const choose = (subject) => {
    setOpen(false);
    navigate(`/courses?subject=${encodeURIComponent(subject)}`);
  };

  return (
    <div className="subjects-menu" ref={root}>
      <button type="button" className="subjects-menu__btn" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => { setFind(''); setOpen((o) => !o); }}>
        <span>{t('nav.subjects')}</span>
        <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <div id={id} className="subjects-menu__panel" role="region" aria-label={t('nav.subjects')}>
          <input ref={input} type="search" className="subjects-menu__find" value={find} onChange={(e) => setFind(e.target.value)}
            placeholder={t('subjectsMenu.find')} aria-label={t('subjectsMenu.find')} />
          {shown.length === 0 ? (
            <p className="subjects-menu__empty">{t('subjectsMenu.none')}</p>
          ) : (
            <ul className="subjects-menu__grid">
              {shown.map((i) => (
                <li key={i.subject}>
                  <button type="button" onClick={() => choose(i.subject)}>
                    <span className="subjects-menu__name">{i.subject}</span>
                    {i.count != null && <small>{i.count}</small>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
