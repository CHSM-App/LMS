import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/Icon';

// A filter dropdown: a pill showing "Label  Value", opening a styled list with a tick on the chosen option.
// Replaces the browser's own <select> list so it matches the rest of the app. Keyboard: Arrow keys, Enter, Escape.
export function FilterMenu({ label, value, options, onChange }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef(null);
  const list = useRef(null);
  const id = useId();
  const all = [{ value: '', label: t('common.all') }, ...options];
  const selectedIndex = Math.max(0, all.findIndex((o) => o.value === value));
  const selected = all[selectedIndex];

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (root.current && !root.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => { if (open && list.current) list.current.focus(); }, [open]);

  const toggle = () => { setActive(selectedIndex); setOpen((o) => !o); };
  const choose = (i) => { onChange(all[i].value); setOpen(false); root.current.querySelector('button').focus(); };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); root.current.querySelector('button').focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, all.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(all.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div className="filter-menu" ref={root}>
      <button type="button" className={`filter-menu__btn${value ? ' filter-menu__btn--on' : ''}`}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined} onClick={toggle}>
        <span className="filter-menu__label">{label}</span>
        <span className="filter-menu__value">{selected.label}</span>
        <Icon name="chevronDown" size={14} className="filter-menu__chevron" />
      </button>
      {open && (
        <ul id={id} ref={list} className="filter-menu__list" role="listbox" tabIndex={-1} aria-label={label}
          aria-activedescendant={`${id}-${active}`} onKeyDown={onKeyDown}>
          {all.map((o, i) => (
            <li key={o.value || 'all'} id={`${id}-${i}`} role="option" aria-selected={i === selectedIndex}
              className={`filter-menu__opt${i === active ? ' filter-menu__opt--active' : ''}`}
              onMouseEnter={() => setActive(i)} onClick={() => choose(i)}>
              <span>{o.label}</span>
              {i === selectedIndex && <Icon name="check" size={16} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
