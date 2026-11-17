import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { Card, EmptyState, PageHeader, Select, Spinner } from '../../components';

export default function StudentExamsPage() {
  const { t } = useTranslation();
  const dash = useQuery({ queryKey: ['student', 'dashboard'], queryFn: () => api.get('/student/dashboard') });
  const courses = (dash.data?.data.myCourses || []).filter((c) => !c.readOnly);
  const [courseId, setCourseId] = useState('');
  useEffect(() => {
    if (!courseId && courses.length) setCourseId(String(courses[0].courseId));
  }, [courses, courseId]);
  const exams = useQuery({ queryKey: ['student', 'exams', courseId], queryFn: () => api.get(`/student/courses/${courseId}/exams`), enabled: !!courseId });

  if (dash.isLoading) return <Spinner label={t('common.loading')} />;
  if (!courses.length) return <><PageHeader title={t('nav.exams')} /><EmptyState title={t('studentExams.noCourses')} /></>;
  return (
    <>
      <PageHeader title={t('nav.exams')} subtitle={t('studentExams.subtitle')} />
      <div className="filters">
        <Select label={t('nav.courses')} value={courseId} onChange={(e) => setCourseId(e.target.value)} options={courses.map((c) => ({ value: String(c.courseId), label: c.title }))} />
        {courseId && <Link to={`/student/courses/${courseId}/final-result`}>{t('studentExams.finalResult')}</Link>}
      </div>
      {exams.isLoading && <Spinner label={t('common.loading')} />}
      {exams.data && exams.data.data.length === 0 && <EmptyState title={t('studentExams.none')} />}
      <div className="grid grid--2">
        {exams.data?.data.map((e) => (
          <Card key={e.id} title={e.title} accent={!e.locked && !e.best}>
            <p className="muted">
              {t(`examBuilder.categories.${e.category}`)} · {t(`examBuilder.modes.${e.mode}`)}
              {e.timeLimitMin ? ` · ${t('studentExams.minutes', { n: e.timeLimitMin })}` : ''}
            </p>
            {e.best && <p>{t('studentExams.best', { pct: e.best.pct })}</p>}
            {e.locked ? (
              <p className="field__hint">{t('studentExams.locked')}</p>
            ) : e.openAttemptId ? (
              <Link className="btn btn--primary btn--sm" to={`/student/exams/${e.id}/take`}><span className="btn__label">{t('studentExams.resume')}</span></Link>
            ) : e.attemptsLeft === 0 ? (
              <p className="muted">{t('studentExams.noneLeft')}</p>
            ) : (
              <Link className="btn btn--primary btn--sm" to={`/student/exams/${e.id}/take`}><span className="btn__label">{t('studentExams.start')}</span></Link>
            )}
            {e.attemptsLeft !== null && !e.locked && <p className="field__hint">{t('studentExams.attemptsLeft', { n: e.attemptsLeft })}</p>}
            {e.lastAttemptId && <p><Link to={`/student/attempts/${e.lastAttemptId}/result`}>{t('studentExams.viewResult')}</Link></p>}
          </Card>
        ))}
      </div>
    </>
  );
}
