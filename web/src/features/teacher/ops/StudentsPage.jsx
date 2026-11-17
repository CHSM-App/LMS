import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api/client';
import { Button, Checkbox, Input, Modal, PageHeader, Select, StatusBadge, Table, useToast } from '../../../components';
import { formatDate } from '../../../utils/format';
import { useCourseModules } from '../exams/useCourseModules';

function AccessDialog({ student, onClose, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [startDate, setStart] = useState(student.startDate || '');
  const [endDate, setEnd] = useState(student.endDate || '');
  const [accessEnabled, setEnabled] = useState(student.accessEnabled !== false);
  const [batchId, setBatchId] = useState(student.batch ? String(student.batch.id) : '');
  const [error, setError] = useState('');
  const batches = useQuery({ queryKey: ['teacher', 'batches', student.course.id], queryFn: () => api.get(`/teacher/courses/${student.course.id}/batches`) });
  const m = useMutation({
    mutationFn: async () => {
      await api.put(`/teacher/students/${student.publicId}/access/${student.course.id}`, { startDate, endDate, accessEnabled });
      if (batchId && (!student.batch || String(student.batch.id) !== batchId)) await api.put(`/teacher/enrollments/${student.enrollmentId}/batch`, { batchId: Number(batchId) });
    },
    onSuccess: () => {
      toast.show({ message: t('common.saved') });
      onDone();
    },
    onError: (e) => setError(e.message),
  });
  const submit = () => {
    if (!startDate || !endDate) return setError(t('requests.needDates'));
    if (endDate < startDate) return setError(t('subscriptions.dateOrder'));
    return m.mutate();
  };
  return (
    <Modal open title={t('students.accessTitle', { name: student.name, course: student.course.title })} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={m.isPending} onClick={submit}>{t('common.save')}</Button></>}>
      <div className="grid grid--2">
        <Input label={t('subscriptions.startDate')} type="date" value={startDate} onChange={(e) => setStart(e.target.value)} required />
        <Input label={t('subscriptions.endDate')} type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} required />
      </div>
      <Select label={t('nav.batches')} value={batchId} onChange={(e) => setBatchId(e.target.value)}
        options={(batches.data?.data || []).map((b) => ({ value: String(b.id), label: b.name }))} />
      <Checkbox label={t('students.accessOn')} checked={accessEnabled} onChange={(e) => setEnabled(e.target.checked)} />
      <p className="field__hint">{t('students.accessHint')}</p>
      {error && <p className="field__error" role="alert">{error}</p>}
    </Modal>
  );
}

export default function StudentsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const { courses } = useCourseModules('');
  const batches = useQuery({ queryKey: ['teacher', 'batches', Number(courseId)], queryFn: () => api.get(`/teacher/courses/${courseId}/batches`), enabled: !!courseId });
  const list = useQuery({
    queryKey: ['teacher', 'students', courseId, batchId, q],
    queryFn: () => api.get('/teacher/students', { course: courseId || undefined, batch: batchId || undefined, q: q || undefined }),
  });
  const columns = [
    { key: 'name', header: t('common.name') },
    { key: 'mobile', header: t('common.mobile') },
    { key: 'course', header: t('nav.courses'), render: (s) => s.course.title },
    { key: 'batch', header: t('nav.batches'), render: (s) => (s.batch ? s.batch.name : '—') },
    { key: 'enrolledAt', header: t('students.enrolled'), render: (s) => formatDate(s.enrolledAt, i18n.language) },
    { key: 'endDate', header: t('subscriptions.endDate'), render: (s) => formatDate(s.endDate, i18n.language) },
    { key: 'subscriptionStatus', header: t('students.access'), render: (s) => <StatusBadge status={s.subscriptionStatus} /> },
    { key: 'a', header: t('common.actions'), render: (s) => <Button variant="compact" size="sm" onClick={() => setEditing(s)}>{t('students.manage')}</Button> },
  ];
  return (
    <>
      <PageHeader title={t('nav.students')} subtitle={t('students.subtitle')} />
      <div className="filters">
        <Input label={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('students.searchHint')} />
        <Select label={t('nav.courses')} value={courseId} onChange={(e) => { setCourseId(e.target.value); setBatchId(''); }}
          options={[{ value: '', label: t('common.all') }, ...courses.map((c) => ({ value: String(c.id), label: c.title }))]} />
        <Select label={t('nav.batches')} value={batchId} onChange={(e) => setBatchId(e.target.value)} disabled={!courseId}
          options={[{ value: '', label: t('common.all') }, ...(batches.data?.data || []).map((b) => ({ value: String(b.id), label: b.name }))]} />
      </div>
      <Table columns={columns} rows={list.data?.data} loading={list.isLoading} error={list.error?.message} onRetry={list.refetch} rowKey={(s) => s.enrollmentId} empty={t('students.empty')} />
      {editing && <AccessDialog student={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['teacher'] }); }} />}
    </>
  );
}
