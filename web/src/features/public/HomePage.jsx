import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { EmptyState, PageHeader, Spinner } from '../../components';
import { FilterMenu } from './FilterMenu';
import { CourseCard } from './CourseCard';
import { useBrowsePaths } from './browsePaths';
import { useMyEnrollments } from './useMyEnrollments';

function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

// Hero shortcut row: "Popular: Maths · Science · …". The full list lives in the header's Subjects menu.
// The chosen subject shows as a removable chip so the active filter is always visible.
const POPULAR = 5;
function PopularSubjects({ subjects, value, onChange }) {
  const { t } = useTranslation();
  if (value) {
    return (
      <div className="hero-subjects">
        <span>{t('home.showingSubject')}</span>
        <button type="button" className="hero-subjects__active" onClick={() => onChange('')} aria-label={t('home.clearSubject', { subject: value })}>
          {value}<span aria-hidden="true"> ✕</span>
        </button>
      </div>
    );
  }
  if (subjects.length === 0) return null;
  return (
    <div className="hero-subjects" role="group" aria-label={t('home.popularSubjects')}>
      <span>{t('home.popular')}</span>
      {subjects.slice(0, POPULAR).map((s) => (
        <button key={s} type="button" className="hero-subjects__link" onClick={() => onChange(s)}>{s}</button>
      ))}
    </div>
  );
}

const STEPS = ['step1', 'step2', 'step3'];
const PAGE_SIZE = 8;

// Public home: finding a course is the job of this page, so it opens with search + real courses.
export default function HomePage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const { inStudent } = useBrowsePaths();
  // The search box lives in the header (public and student); the query lives in the URL.
  const q = params.get('q') || '';
  const setParam = (key, v) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (v) next.set(key, v); else next.delete(key);
    return next;
  });
  const setQ = (v) => setParam('q', v);
  const [language, setLanguage] = useState('');
  // The subject is in the URL too (?subject=), so the header's Subjects menu and shared links work.
  const subject = params.get('subject') || '';
  const setSubject = (v) => setParam('subject', v);
  const search = useDebounced(q);
  const mine = useMyEnrollments().bySlug;

  useEffect(() => {
    document.title = `${t('app.name')} — ${inStudent ? t('nav.browse') : t('home.title')}`;
  }, [t, inStudent]);

  const filters = useQuery({ queryKey: ['public', 'filters'], queryFn: () => api.get('/public/filters'), staleTime: 300000 });
  // 8 courses at a time; "Show N more" adds the next page under the cards.
  const list = useInfiniteQuery({
    queryKey: ['public', 'courses', search, language, subject],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.get('/public/courses', { q: search || undefined, language: language || undefined, subject: subject || undefined, page: pageParam, limit: PAGE_SIZE }),
    getNextPageParam: (last) => {
      const p = last.pagination;
      return p && p.page * p.limit < p.total ? p.page + 1 : undefined;
    },
  });
  const courses = list.data ? list.data.pages.flatMap((p) => p.data) : [];
  const total = list.data ? list.data.pages[list.data.pages.length - 1].pagination?.total ?? courses.length : 0;
  const remaining = Math.max(0, total - courses.length);
  const filtered = search || language || subject;
  const subjects = filters.data?.data.subjects || [];

  const languageSelect = (
    <FilterMenu label={t('courses.language')} value={language} onChange={setLanguage}
      options={(filters.data?.data.languages || []).map((l) => ({ value: l, label: t(`courses.lang.${l}`) }))} />
  );
  const results = (
    <>
      {list.isLoading && <Spinner label={t('common.loading')} />}
      {list.error && <EmptyState title={list.error.message} action={{ label: t('common.retry'), onClick: list.refetch }} />}
      {list.data && courses.length === 0 && (
        <EmptyState
          title={filtered ? t('home.noMatch') : t('home.empty')}
          action={filtered ? { label: t('home.clear'), onClick: () => { setQ(''); setLanguage(''); setSubject(''); } } : undefined}
        />
      )}
      {courses.length > 0 && (
        <div className="course-grid">
          {courses.map((c) => <CourseCard key={c.slug} course={c} status={mine[c.slug]?.status} />)}
        </div>
      )}
      {list.hasNextPage && (
        <div className="show-more">
          <button type="button" className="btn btn--secondary" disabled={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
            <span className="btn__label">{t('home.showMore', { count: Math.min(PAGE_SIZE, remaining) })}</span>
          </button>
        </div>
      )}
    </>
  );

  // Inside the student area: a plain toolbar, no marketing sections.
  if (inStudent) {
    return (
      <div className="stack">
        <PageHeader
          title={t('nav.browse')}
          subtitle={t('home.lead')}
          actions={(
            <>
              <FilterMenu label={t('courses.language')} value={language} onChange={setLanguage}
                options={(filters.data?.data.languages || []).map((l) => ({ value: l, label: t(`courses.lang.${l}`) }))} />
              <FilterMenu label={t('courses.subject')} value={subject} onChange={setSubject}
                options={subjects.map((s) => ({ value: s, label: s }))} />
            </>
          )}
        />
        <section className="browse-tools">
          <div className="browse-tools__bar">
            <span className="browse-tools__count" aria-live="polite">
              {list.data ? t('home.resultCount', { count: total }) : ''}
            </span>
            {(language || subject || search) && (
              <button type="button" className="link-btn" onClick={() => { setQ(''); setLanguage(''); setSubject(''); }}>{t('home.clear')}</button>
            )}
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
            <PopularSubjects subjects={subjects} value={subject} onChange={setSubject} />
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
