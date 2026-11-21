import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/Icon';

// Student top-bar search: the query lives in the URL (?q=) so Browse courses can read it.
export function CourseSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const base = pathname.startsWith('/student/') ? '/student/browse' : '/courses';
  const onBrowse = pathname === base;
  const urlQ = onBrowse ? params.get('q') || '' : '';
  const [value, setValue] = useState(urlQ);
  const pushed = useRef(urlQ); // the query the URL already holds because of this box

  // Keep the box in step with the URL (e.g. after "Clear filters" or Back), without fighting typing.
  useEffect(() => {
    if (urlQ !== pushed.current) {
      pushed.current = urlQ;
      setValue(urlQ);
    }
  }, [urlQ]);

  const go = (q) => {
    if (q === pushed.current || (!onBrowse && !q)) return;
    pushed.current = q;
    navigate(q ? `${base}?q=${encodeURIComponent(q)}` : base, { replace: onBrowse });
  };

  // Search as you type: wait until typing pauses, then update the URL.
  useEffect(() => {
    const id = setTimeout(() => go(value.trim()), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const submit = (e) => {
    e.preventDefault();
    go(value.trim());
  };

  return (
    <form role="search" className="shell__search" onSubmit={submit}>
      <Icon name="search" size={18} />
      <label htmlFor="shell-course-search" className="visually-hidden">{t('common.search')}</label>
      <input id="shell-course-search" type="search" className="shell__search-input" value={value}
        onChange={(e) => setValue(e.target.value)} placeholder={t('home.searchPlaceholder')} />
    </form>
  );
}
