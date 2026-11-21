import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api/client';
import { BackLink, PageHeader, Select, StatusBadge, Table } from '../../../components';
import { formatDateTime } from '../../../utils/format';

export default function ExamResultsPage() {
  const { examId } = useParams();
  const { t, i18n } = useTranslation();
  const [batch, setBatch] = useState('');
  const exam = useQuery({ queryKey: ['teacher', 'exam', examId], queryFn: () => api.get(`/teacher/exams/${examId}`) });
  const courseId = exam.data?.data.courseId;
  const batches = useQuery({ queryKey: ['teacher', 'batches', courseId], queryFn: () => api.get(`/teacher/courses/${courseId}/batches`), enabled: !!courseId });
  const q = useQuery({ queryKey: ['teacher', 'results', examId, batch], queryFn: () => api.get(`/teacher/exams/${examId}/results`, { batch: batch || undefined }) });
  return (
    <>
      <p><BackLink to="/teacher/exams">{t('examBuilder.back')}</BackLink></p>
      <PageHeader title={t('results.title', { exam: exam.data?.data.title || '' })} subtitle={t('results.subtitle')} />
      <div className="filters">
        <Select label={t('nav.batches')} value={batch} onChange={(e) => setBatch(e.target.value)}
          options={[{ value: '', label: t('common.all') }, ...(batches.data?.data || []).map((b) => ({ value: String(b.id), label: b.name }))]} />
      </div>
      <Table
        loading={q.isLoading}
        error={q.error?.message}
        rows={q.data?.data}
        rowKey={(r) => r.attemptId}
        empty={t('results.empty')}
        columns={[
          { key: 'rank', header: t('results.rank'), align: 'right' },
          { key: 'studentName', header: t('common.name') },
          { key: 'studentMobile', header: t('common.mobile'), render: (r) => r.studentMobile || '—' },
          { key: 'score', header: t('results.marks'), align: 'right', render: (r) => `${r.score} / ${r.max}` },
          { key: 'pct', header: '%', align: 'right', render: (r) => `${r.pct}%` },
          { key: 'passed', header: t('examList.result'), render: (r) => <StatusBadge status={r.passed ? 'approved' : 'rejected'} /> },
          { key: 'attempts', header: t('examList.attempts'), align: 'right' },
          { key: 'late', header: t('results.late'), render: (r) => (r.late ? <span className="badge badge--pending">{t('results.late')}</span> : '—') },
          { key: 'submittedAt', header: t('common.date'), render: (r) => formatDateTime(r.submittedAt, i18n.language) },
        ]}
      />
    </>
  );
}
