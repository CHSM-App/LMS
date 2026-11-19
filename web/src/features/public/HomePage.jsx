import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

function SubjectChips({ subjects, value, onChange }) {
  const { t } = useTranslation();
  return (
    <div className="chips" role="group" aria-label={t('home.popularSubjects')}>
      {['', ...subjects].map((s) => (
        <button key={s || 'all'} type="button" className="chip" aria-pressed={value === s} onClick={() => onChange(s)}>
          {s || t('common.all')}
        </button>
      ))}
    </div>
  );
}

const STEPS = ['step1', 'step2', 'step3'];

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
  const subjects = filters.data?.data.subjects || [];

  const searchBox = (
    <form role="search" className="home-search" onSubmit={(e) => e.preventDefault()}>
      <label htmlFor="course-search" className="visually-hidden">{t('common.search')}</label>
      <input id="course-search" type="search" className="input home-search__input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('home.searchPlaceholder')} />
    </form>
  );
  const languageSelect = (
    <Select label={t('courses.language')} value={language} onChange={(e) => setLanguage(e.target.value)}
      options={[{ value: '', label: t('common.all') }, ...(filters.data?.data.languages || []).map((l) => ({ value: l, label: t(`courses.lang.${l}`) }))]} />
  );
  const results = (
    <>
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
    </>
  );

  // Inside the student area: a plain toolbar, no marketing sections.
  if (inStudent) {
    return (
      <div className="stack">
        <PageHeader title={t('nav.browse')} subtitle={t('home.lead')} />
        <section className="browse-tools">
          {searchBox}
          <div className="filters">
            {languageSelect}
            <Select label={t('courses.subject')} value={subject} onChange={(e) => setSubject(e.target.value)}
              options={[{ value: '', label: t('common.all') }, ...subjects.map((s) => ({ value: s, label: s }))]} />
          </div>
        </section>
        {results}
      </div>
    );
  }

  return (
    <div className="home">
      <section className="home-hero">
        <div className="container home-hero__inner">
          <div className="home-hero__text">
            <h1 className="home-hero__title">{t('home.title')}</h1>
            <p className="home-hero__lead">{t('home.lead')}</p>
            {searchBox}
            <SubjectChips subjects={subjects} value={subject} onChange={setSubject} />
          </div>
          <ul className="home-hero__points" aria-label={t('home.pointsLabel')}>
            <li><strong>{t('home.point1Title')}</strong><span>{t('home.point1Body')}</span></li>
            <li><strong>{t('home.point2Title')}</strong><span>{t('home.point2Body')}</span></li>
            <li><strong>{t('home.point3Title')}</strong><span>{t('home.point3Body')}</span></li>
          </ul>
        </div>
      </section>

      <section className="container home-section">
        <h2 className="home-section__title">{t('home.stepsTitle')}</h2>
        <ol className="home-steps" aria-label={t('home.stepsTitle')}>
          {STEPS.map((s, i) => (
            <li key={s} className="home-step">
              <span className="home-step__num" aria-hidden="true">{i + 1}</span>
              <h3 className="home-step__title">{t(`home.${s}Title`)}</h3>
              <p className="home-step__body">{t(`home.${s}Body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container home-section">
        <div className="home-section__head">
          <h2 className="home-section__title">{t('home.coursesTitle')}</h2>
          <div className="home-section__tools">{languageSelect}</div>
        </div>
        {results}
      </section>

      <section className="container home-section">
        <div className="home-teach">
          <div>
            <h2 className="home-teach__title">{t('home.teachTitle')}</h2>
            <p className="home-teach__body">{t('home.teachBody')}</p>
          </div>
          <Link to="/become-teacher" className="btn btn--primary"><span className="btn__label">{t('home.teachCta')}</span></Link>
        </div>
      </section>
    </div>
  );
}
