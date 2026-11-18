import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { EmptyState, PageHeader, Select, Spinner } from '../../components';
import { Pager } from '../../components/Pager';
import { CourseCard } from './CourseCard';
import { useBrowsePaths } from './browsePaths';

function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

// Public home: finding a course is the job of this page, so it opens with search + real courses.
export default function HomePage() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [language, setLanguage] = useState('');
  const [subject, setSubject] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const { inStudent } = useBrowsePaths();

  useEffect(() => {
    document.title = `${t('app.name')} — ${inStudent ? t('nav.browse') : t('home.title')}`;
  }, [t, inStudent]);
  useEffect(() => setPage(1), [search, language, subject]);

  const filters = useQuery({ queryKey: ['public', 'filters'], queryFn: () => api.get('/public/filters'), staleTime: 300000 });
  const list = useQuery({
    queryKey: ['public', 'courses', search, language, subject, page],
    queryFn: () => api.get('/public/courses', { q: search || undefined, language: language || undefined, subject: subject || undefined, page, limit: 12 }),
  });
  const filtered = search || language || subject;

  return (
    <div className={inStudent ? 'stack' : 'container stack'}>
      {inStudent && <PageHeader title={t('nav.browse')} subtitle={t('home.lead')} />}
      <section className={inStudent ? 'browse-tools' : 'home-hero'}>
        {!inStudent && <h1 className="home-hero__title">{t('home.title')}</h1>}
        {!inStudent && <p className="home-hero__lead">{t('home.lead')}</p>}
        <form role="search" className="home-search" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="course-search" className="visually-hidden">{t('common.search')}</label>
          <input id="course-search" type="search" className="input home-search__input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('home.searchPlaceholder')} />
        </form>
        <div className="filters">
          <Select label={t('courses.language')} value={language} onChange={(e) => setLanguage(e.target.value)}
            options={[{ value: '', label: t('common.all') }, ...(filters.data?.data.languages || []).map((l) => ({ value: l, label: t(`courses.lang.${l}`) }))]} />
          <Select label={t('courses.subject')} value={subject} onChange={(e) => setSubject(e.target.value)}
            options={[{ value: '', label: t('common.all') }, ...(filters.data?.data.subjects || []).map((s) => ({ value: s, label: s }))]} />
        </div>
      </section>
      {list.isLoading && <Spinner label={t('common.loading')} />}
      {list.error && <EmptyState title={list.error.message} action={{ label: t('common.retry'), onClick: list.refetch }} />}
      {list.data && list.data.data.length === 0 && (
        <EmptyState
          title={filtered ? t('home.noMatch') : t('home.empty')}
          action={filtered ? { label: t('home.clear'), onClick: () => { setQ(''); setLanguage(''); setSubject(''); } } : undefined}
        />
      )}
      {list.data && list.data.data.length > 0 && (
        <div className="course-grid">
          {list.data.data.map((c) => <CourseCard key={c.slug} course={c} />)}
        </div>
      )}
      <Pager pagination={list.data?.pagination} onPage={setPage} />
    </div>
  );
}
