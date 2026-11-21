import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { Icon } from '../../components/Icon';
import { formatDateTime } from '../../utils/format';
import { EmptyState, PageHeader, Select, Spinner } from '../../components';

const GROUPS = [
  { key: 'unit', icon: 'list', categories: ['unit_test_1', 'unit_test_2'] },
  { key: 'final', icon: 'clipboard', categories: ['final'] },
  { key: 'practice', icon: 'book', categories: ['practice'] },
];

function statusOf(e) {
  if (e.locked) return { key: 'locked', tone: 'neutral' };
  if (e.openAttemptId) return { key: 'inProgress', tone: 'pending' };
  if (e.best) return { key: 'completed', tone: 'approved' };
  if (e.closed) return { key: 'closed', tone: 'rejected' };
  if (e.notOpen) return { key: 'notOpen', tone: 'neutral' };
  if (e.overdue) return { key: 'overdue', tone: 'pending' };
  return { key: 'notStarted', tone: 'neutral' };
}

function ScoreRing({ pct, label }) {
  return (
    <div className="score-ring" role="img" aria-label={label} style={{ '--pct': `${pct}%` }}>
      <span className="score-ring__value">{pct}%</span>
    </div>
  );
}

function ExamRow({ e, t, lang }) {
  const status = statusOf(e);
  const meta = [t(`examBuilder.modes.${e.mode}`)];
  if (e.timeLimitMin) meta.push(t('studentExams.minutes', { n: e.timeLimitMin }));
  if (e.attemptsLeft !== null && !e.locked) meta.push(t('studentExams.attemptsLeft', { n: e.attemptsLeft }));
  if (e.notOpen && e.startsAt) meta.push(t('studentExams.opens', { date: formatDateTime(e.startsAt, lang) }));
  else if (e.endsAt) meta.push(t('studentExams.due', { date: formatDateTime(e.endsAt, lang) }));

  let action = null;
  if (!e.locked) {
    if (e.openAttemptId) {
      action = <Link className="btn btn--primary btn--sm" to={`/student/exams/${e.id}/take`}><span className="btn__label">{t('studentExams.resume')}</span></Link>;
    } else if (e.attemptsLeft !== 0 && !e.closed && !e.notOpen) {
      action = <Link className="btn btn--primary btn--sm" to={`/student/exams/${e.id}/take`}><span className="btn__label">{t('studentExams.start')}</span></Link>;
    }
  }

  return (
    <li className={`exam-row${e.locked ? ' exam-row--locked' : ''}`}>
      <div className="exam-row__main">
        <div className="exam-row__title-line">
          <h3 className="exam-row__title">{e.title}</h3>
          <span className={`badge badge--${status.tone}`}>{t(`studentExams.status.${status.key}`)}</span>
          {e.lastAttemptLate && <span className="badge badge--pending">{t('studentExams.late')}</span>}
        </div>
        <p className="exam-row__meta">{meta.join(' · ')}</p>
        {e.locked && <p className="field__hint">{t('studentExams.locked')}</p>}
        {!e.locked && e.attemptsLeft === 0 && !e.openAttemptId && <p className="field__hint">{t('studentExams.noneLeft')}</p>}
      </div>
      {e.best && <ScoreRing pct={e.best.pct} label={t('studentExams.bestScore', { pct: e.best.pct })} />}
      <div className="exam-row__actions">
        {action}
        {e.lastAttemptId && (
          <Link className="btn btn--secondary btn--sm" to={`/student/attempts/${e.lastAttemptId}/result`}><span className="btn__label">{t('studentExams.viewResult')}</span></Link>
        )}
      </div>
    </li>
  );
}

export default function StudentExamsPage() {
  const { t, i18n } = useTranslation();
  const dash = useQuery({ queryKey: ['student', 'dashboard'], queryFn: () => api.get('/student/dashboard') });
  const courses = (dash.data?.data.myCourses || []).filter((c) => !c.readOnly);
  const [courseId, setCourseId] = useState('');
  useEffect(() => {
    if (!courseId && courses.length) setCourseId(String(courses[0].courseId));
  }, [courses, courseId]);
  const exams = useQuery({ queryKey: ['student', 'exams', courseId], queryFn: () => api.get(`/student/courses/${courseId}/exams`), enabled: !!courseId });

  if (dash.isLoading) return <Spinner label={t('common.loading')} />;
  if (!courses.length) return <><PageHeader title={t('nav.exams')} /><EmptyState title={t('studentExams.noCourses')} /></>;

  const list = exams.data?.data || [];
  const graded = list.filter((e) => e.best);
  const avg = graded.length ? Math.round(graded.reduce((s, e) => s + Number(e.best.pct), 0) / graded.length) : null;
  const attemptsLeft = list.filter((e) => !e.locked && e.attemptsLeft !== null).reduce((s, e) => s + e.attemptsLeft, 0);

  return (
    <>
      <PageHeader title={t('nav.exams')} subtitle={t('studentExams.subtitle')} />
      <div className="exams-toolbar">
        <Select label={t('nav.courses')} value={courseId} onChange={(e) => setCourseId(e.target.value)} options={courses.map((c) => ({ value: String(c.courseId), label: c.title }))} />
        {courseId && (
          <Link className="btn btn--secondary btn--sm" to={`/student/courses/${courseId}/final-result`}>
            <span className="btn__label">{t('studentExams.finalResult')}</span>
          </Link>
        )}
      </div>
      {exams.isLoading && <Spinner label={t('common.loading')} />}
      {exams.data && list.length === 0 && <EmptyState title={t('studentExams.none')} />}
      {list.length > 0 && (
        <>
          <div className="stat-row">
            <div className="stat-tile"><span className="stat-tile__value">{graded.length}/{list.length}</span><span className="stat-tile__label">{t('studentExams.summary.done')}</span></div>
            <div className="stat-tile"><span className="stat-tile__value">{avg === null ? '—' : `${avg}%`}</span><span className="stat-tile__label">{t('studentExams.summary.average')}</span></div>
            <div className="stat-tile"><span className="stat-tile__value">{attemptsLeft}</span><span className="stat-tile__label">{t('studentExams.summary.attemptsLeft')}</span></div>
          </div>
          {GROUPS.map((g) => {
            const items = list.filter((e) => g.categories.includes(e.category));
            if (!items.length) return null;
            return (
              <section key={g.key} className="exam-group">
                <h2 className="exam-group__title"><Icon name={g.icon} size={18} />{t(`studentExams.groups.${g.key}`)}</h2>
                <ul className="exam-list">{items.map((e) => <ExamRow key={e.id} e={e} t={t} lang={i18n.language} />)}</ul>
              </section>
            );
          })}
        </>
      )}
    </>
  );
}
