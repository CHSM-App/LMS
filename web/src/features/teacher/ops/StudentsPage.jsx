import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api/client';
import { Button, Checkbox, Input, Modal, PageHeader, Select, StatusBadge, Table, useToast } from '../../../components';
import { formatDate } from '../../../utils/format';
import { useCourseModules } from '../exams/useCourseModules';
import { StudentAttendanceCalendar } from './StudentAttendanceCalendar';

const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

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
  const [calendarFor, setCalendarFor] = useState(null);
  const { courses } = useCourseModules('');
  const batches = useQuery({ queryKey: ['teacher', 'batches', Number(courseId)], queryFn: () => api.get(`/teacher/courses/${courseId}/batches`), enabled: !!courseId });
  const list = useQuery({
    queryKey: ['teacher', 'students', courseId, batchId, q],
    queryFn: () => api.get('/teacher/students', { course: courseId || undefined, batch: batchId || undefined, q: q || undefined }),
  });
  const columns = [
    { key: 'student', header: t('nav.students'), render: (s) => (
      <div className="person">
        <span className="person__avatar" aria-hidden="true">{initials(s.name)}</span>
        <div className="person__text">
          <span className="person__name">{s.name}</span>
          <span className="person__sub">{s.mobile}</span>
        </div>
      </div>
    ) },
    { key: 'course', header: t('nav.courses'), render: (s) => (
      <div className="person__text">
        <span className="person__name">{s.course.title}</span>
        <span className="person__sub">{s.batch ? s.batch.name : '—'}</span>
      </div>
    ) },
    { key: 'attendance', header: t('students.attendance'), render: (s) => {
      const a = s.attendance;
      if (!a || a.held === 0) return <span className="person__sub">—</span>;
      const tone = a.pct >= 75 ? 'good' : a.pct >= 50 ? 'mid' : 'low';
      return (
        <div className="attbar" title={t('students.attendanceValue', { pct: a.pct, attended: a.attended, held: a.held })}>
          <div className="attbar__top">
            <strong>{a.pct}%</strong>
            <span className="person__sub">{a.attended}/{a.held}</span>
          </div>
          <div className="attbar__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={a.pct} aria-label={t('students.attendance')}>
            <div className={`attbar__fill attbar__fill--${tone}`} style={{ width: `${a.pct}%` }} />
          </div>
        </div>
      );
    } },
    { key: 'enrolledAt', header: t('students.enrolled'), render: (s) => <span className="nowrap">{formatDate(s.enrolledAt, i18n.language)}</span> },
    { key: 'endDate', header: t('subscriptions.endDate'), render: (s) => <span className="nowrap">{formatDate(s.endDate, i18n.language)}</span> },
    { key: 'subscriptionStatus', header: t('students.access'), render: (s) => <StatusBadge status={s.subscriptionStatus} /> },
    { key: 'a', header: t('common.actions'), render: (s) => (
      <div className="row-actions">
        <Button variant="secondary" size="sm" onClick={() => setCalendarFor(s)}>{t('students.calendar')}</Button>
        <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>{t('students.manage')}</Button>
      </div>
    ) },
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
      {calendarFor && <StudentAttendanceCalendar student={calendarFor} onClose={() => setCalendarFor(null)} />}
      {editing && <AccessDialog student={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['teacher'] }); }} />}
    </>
  );
}
