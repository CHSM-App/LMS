import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api/client';
import { Button, EmptyState, PageHeader, Select, StatusBadge, Table } from '../../../components';
import { useCourseModules } from './useCourseModules';

export default function ExamsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [courseId, setCourseId] = useState('');
  const [tab, setTab] = useState('exams');
  const { courses } = useCourseModules('');
  const exams = useQuery({ queryKey: ['teacher', 'exams', courseId], queryFn: () => api.get(`/teacher/courses/${courseId}/exams`), enabled: !!courseId });
  const finals = useQuery({ queryKey: ['teacher', 'finals', courseId], queryFn: () => api.get(`/teacher/courses/${courseId}/final-results`), enabled: !!courseId && tab === 'final' });

  return (
    <>
      <PageHeader
        title={t('nav.exams')}
        subtitle={t('examList.subtitle')}
        actions={courseId && <Button onClick={() => navigate(`/teacher/exams/new?course=${courseId}`)}>{t('examList.new')}</Button>}
      />
      <div className="filters">
        <Select label={t('nav.courses')} value={courseId} placeholder={t('questions.chooseCourse')} onChange={(e) => setCourseId(e.target.value)}
          options={courses.map((c) => ({ value: String(c.id), label: c.title }))} />
      </div>
      {!courseId && <EmptyState title={t('examList.pickCourse')} />}
      {courseId && (
        <>
          <div className="tabs" role="tablist">
            <button type="button" role="tab" className="tabs__tab" aria-selected={tab === 'exams'} onClick={() => setTab('exams')}>{t('nav.exams')}</button>
            <button type="button" role="tab" className="tabs__tab" aria-selected={tab === 'final'} onClick={() => setTab('final')}>{t('examList.finalResults')}</button>
          </div>
          {tab === 'exams' && (
            <Table
              loading={exams.isLoading}
              error={exams.error?.message}
              rows={exams.data?.data}
              empty={t('examList.empty')}
              columns={[
                { key: 'title', header: t('examBuilder.title'), render: (e) => <Link to={`/teacher/exams/${e.id}`}>{e.title}</Link> },
                { key: 'category', header: t('examBuilder.categoryLabel'), render: (e) => t(`examBuilder.categories.${e.category}`) },
                { key: 'mode', header: t('examBuilder.modeLabel'), render: (e) => t(`examBuilder.modes.${e.mode}`) },
                { key: 'weightage', header: t('examBuilder.weightage'), align: 'right', render: (e) => `${e.weightage}%` },
                { key: 'status', header: t('common.status'), render: (e) => <StatusBadge status={e.status} /> },
                { key: 'attemptCount', header: t('examList.attempts'), align: 'right' },
                { key: 'r', header: t('common.actions'), render: (e) => (e.status === 'published' ? <Link to={`/teacher/exams/${e.id}/results`}>{t('examList.results')}</Link> : '—') },
              ]}
            />
          )}
          {tab === 'final' && (
            <Table
              loading={finals.isLoading}
              error={finals.error?.message}
              rows={finals.data?.data}
              rowKey={(r) => r.studentPublicId}
              empty={t('examList.noFinal')}
              columns={[
                { key: 'studentName', header: t('common.name') },
                ...(finals.data?.data[0]?.exams || []).map((x, i) => ({ key: `e${x.examId}`, header: `${t(`examBuilder.categories.${x.category}`)} (${x.weightage}%)`, align: 'right', render: (r) => (r.exams[i].attempted ? `${r.exams[i].pct}%` : '—') })),
                { key: 'weightedPct', header: t('examList.weighted'), align: 'right', render: (r) => `${r.weightedPct}%` },
                { key: 'passed', header: t('examList.result'), render: (r) => <StatusBadge status={r.passed ? 'approved' : 'rejected'} /> },
              ]}
            />
          )}
        </>
      )}
    </>
  );
}
