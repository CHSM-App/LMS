import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api/client';
import { Button, Input, Modal, PageHeader, Select, StatusBadge, Table, useToast } from '../../../components';
import { formatDateTime } from '../../../utils/format';
import { useCourseModules } from '../exams/useCourseModules';
import { AttendanceSheet } from './AttendanceSheet';
import { MeetLinkAction } from './MeetLinkAction';

const toLocalInput = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

function ClassDialog({ item, courses, onClose, onDone }) {
  const { t } = useTranslation();
  const [f, setF] = useState(() => ({
    courseId: item ? String(item.course.id) : '',
    batchId: item && item.batch ? String(item.batch.id) : '',
    topic: item ? item.topic : '',
    startsAt: item ? toLocalInput(item.startsAt) : '',
    durationMin: item ? item.durationMin : 60,
    meetLink: item ? item.meetLink : '',
  }));
  const [error, setError] = useState('');
  const batches = useQuery({ queryKey: ['teacher', 'batches', Number(f.courseId)], queryFn: () => api.get(`/teacher/courses/${f.courseId}/batches`), enabled: !!f.courseId });
  const m = useMutation({
    mutationFn: () => {
      const body = { courseId: Number(f.courseId), batchId: f.batchId ? Number(f.batchId) : null, topic: f.topic.trim(), startsAt: new Date(f.startsAt).toISOString(), durationMin: Number(f.durationMin), meetLink: f.meetLink.trim() || null };
      return item ? api.put(`/teacher/live-classes/${item.id}`, { ...body, status: item.status }) : api.post('/teacher/live-classes', body);
    },
    onSuccess: onDone,
    onError: (e) => setError(e.message),
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = () => {
    if (!f.courseId || !f.topic.trim() || !f.startsAt) return setError(t('validation.required'));
    return m.mutate();
  };
  return (
    <Modal open title={item ? t('liveClasses.edit') : t('liveClasses.add')} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={m.isPending} onClick={submit}>{t('liveClasses.save')}</Button></>}>
      <Select label={t('nav.courses')} value={f.courseId} placeholder={t('questions.chooseCourse')} onChange={(e) => setF((x) => ({ ...x, courseId: e.target.value, batchId: '' }))} required
        options={courses.map((c) => ({ value: String(c.id), label: c.title }))} />
      <Select label={t('nav.batches')} value={f.batchId} onChange={set('batchId')} disabled={!f.courseId}
        options={[{ value: '', label: t('liveClasses.allBatches') }, ...(batches.data?.data || []).map((b) => ({ value: String(b.id), label: b.name }))]} />
      <Input label={t('liveClasses.topic')} value={f.topic} onChange={set('topic')} required />
      <div className="grid grid--2">
        <Input label={t('requests.when')} type="datetime-local" value={f.startsAt} onChange={set('startsAt')} required />
        <Input label={t('liveClasses.duration')} type="number" min="5" max="600" value={f.durationMin} onChange={set('durationMin')} />
      </div>
      <Input label={`${t('requests.meetLink')} (${t('common.optional')})`} value={f.meetLink} onChange={set('meetLink')} placeholder="https://meet.google.com/abc-defg-hij" hint={t('requests.meetHint')} />
      {error && <p className="field__error" role="alert">{error}</p>}
    </Modal>
  );
}

export default function LiveClassesPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [courseId, setCourseId] = useState('');
  const [dialog, setDialog] = useState(null);
  const { courses } = useCourseModules('');
  const list = useQuery({ queryKey: ['teacher', 'live', courseId], queryFn: () => api.get('/teacher/live-classes', { course: courseId || undefined }) });
  const refresh = () => {
    setDialog(null);
    qc.invalidateQueries({ queryKey: ['teacher'] });
  };
  const cancel = useMutation({ mutationFn: (id) => api.del(`/teacher/live-classes/${id}`), onSuccess: refresh, onError: (e) => toast.show({ kind: 'error', message: e.message }) });
  const columns = [
    { key: 'topic', header: t('liveClasses.topic') },
    { key: 'course', header: t('nav.courses'), render: (r) => r.course.title },
    { key: 'batch', header: t('nav.batches'), render: (r) => (r.batch ? r.batch.name : t('liveClasses.allBatches')) },
    { key: 'startsAt', header: t('requests.when'), render: (r) => formatDateTime(r.startsAt, i18n.language) },
    { key: 'status', header: t('common.status'), render: (r) => <StatusBadge status={r.status} /> },
    { key: 'meet', header: 'Meet', render: (r) => <MeetLinkAction liveClass={r} onSaved={refresh} /> },
    {
      key: 'a', header: t('common.actions'),
      render: (r) => (
        <div className="row">
          <Button variant="compact" size="sm" onClick={() => setDialog({ kind: 'attendance', item: r })}>{t('nav.attendance')}</Button>
          {r.status !== 'cancelled' && <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: 'edit', item: r })}>{t('common.edit')}</Button>}
          {r.status === 'scheduled' && <Button variant="ghost" size="sm" onClick={() => cancel.mutate(r.id)}>{t('liveClasses.cancel')}</Button>}
        </div>
      ),
    },
  ];
  return (
    <>
      <PageHeader title={t('nav.liveClasses')} subtitle={t('liveClasses.subtitle')} actions={<Button onClick={() => setDialog({ kind: 'edit' })}>{t('liveClasses.add')}</Button>} />
      <div className="filters">
        <Select label={t('nav.courses')} value={courseId} onChange={(e) => setCourseId(e.target.value)} options={[{ value: '', label: t('common.all') }, ...courses.map((c) => ({ value: String(c.id), label: c.title }))]} />
      </div>
      <Table columns={columns} rows={list.data?.data} loading={list.isLoading} error={list.error?.message} onRetry={list.refetch} empty={t('liveClasses.empty')} />
      {dialog?.kind === 'edit' && <ClassDialog item={dialog.item} courses={courses} onClose={() => setDialog(null)} onDone={refresh} />}
      <Modal open={dialog?.kind === 'attendance'} size="lg" title={dialog?.item ? t('attendance.title', { topic: dialog.item.topic }) : ''} onClose={() => setDialog(null)}>
        {dialog?.kind === 'attendance' && <AttendanceSheet liveClassId={dialog.item.id} onDone={refresh} />}
      </Modal>
    </>
  );
}
