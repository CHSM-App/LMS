import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api/client';
import { Button, Input, Modal, Select, StatusBadge, Table, useToast } from '../../../components';
import { formatDate, todayISO } from '../../../utils/format';
import { LiveScheduleDialog } from './LiveScheduleDialog';

function BatchDialog({ courseId, batch, onClose, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [f, setF] = useState(() => ({
    name: batch?.name || '',
    startDate: batch?.startDate || todayISO(),
    endDate: batch?.endDate || '',
    timingText: batch?.timingText || '',
    maxStudents: batch?.maxStudents ?? '',
    status: batch?.status || 'active',
  }));
  const [error, setError] = useState('');
  const m = useMutation({
    mutationFn: (body) => (batch ? api.put(`/teacher/batches/${batch.id}`, body) : api.post(`/teacher/courses/${courseId}/batches`, body)),
    onSuccess: () => {
      toast.show({ message: t('common.saved') });
      onDone();
    },
    onError: (e) => setError(e.message),
  });
  const submit = () => {
    if (!f.name.trim() || !f.startDate) return setError(t('validation.required'));
    if (f.endDate && f.endDate < f.startDate) return setError(t('subscriptions.dateOrder'));
    return m.mutate({
      name: f.name.trim(),
      startDate: f.startDate,
      endDate: f.endDate || null,
      timingText: f.timingText.trim() || null,
      maxStudents: f.maxStudents === '' ? null : Number(f.maxStudents),
      status: f.status,
    });
  };
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal open title={batch ? t('batches.edit', { name: batch.name }) : t('batches.add')} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={m.isPending} onClick={submit}>{t('batches.save')}</Button></>}>
      <Input label={t('batches.name')} value={f.name} onChange={set('name')} hint={t('batches.nameHint')} required autoFocus />
      <div className="grid grid--2">
        <Input label={t('subscriptions.startDate')} type="date" value={f.startDate} onChange={set('startDate')} required />
        <Input label={`${t('subscriptions.endDate')} (${t('common.optional')})`} type="date" value={f.endDate} onChange={set('endDate')} />
      </div>
      <Input label={`${t('batches.timing')} (${t('common.optional')})`} value={f.timingText} onChange={set('timingText')} hint={t('batches.timingHint')} />
      <Input label={`${t('batches.max')} (${t('common.optional')})`} type="number" min="1" value={f.maxStudents} onChange={set('maxStudents')} />
      {batch && <Select label={t('common.status')} value={f.status} onChange={set('status')} options={[{ value: 'active', label: t('status.active') }, { value: 'closed', label: t('status.closed') }]} />}
      {error && <p className="field__error" role="alert">{error}</p>}
    </Modal>
  );
}

export function BatchesTab({ courseId }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const q = useQuery({ queryKey: ['teacher', 'batches', courseId], queryFn: () => api.get(`/teacher/courses/${courseId}/batches`) });
  const columns = [
    { key: 'name', header: t('batches.name') },
    { key: 'startDate', header: t('subscriptions.startDate'), render: (b) => formatDate(b.startDate, i18n.language) },
    { key: 'timingText', header: t('batches.timing'), render: (b) => b.timingText || '—' },
    { key: 'students', header: t('teachers.students'), align: 'right', render: (b) => (b.maxStudents ? `${b.studentCount} / ${b.maxStudents}` : b.studentCount) },
    { key: 'status', header: t('common.status'), render: (b) => <StatusBadge status={b.status} /> },
    {
      key: 'a',
      header: t('common.actions'),
      render: (b) => (
        <span className="row">
          <Button variant="compact" size="sm" onClick={() => setDialog({ batch: b })}>{t('common.edit')}</Button>
          {b.status !== 'closed' && <Button variant="compact" size="sm" onClick={() => setSchedule(b)}>{t('batches.liveSchedule')}</Button>}
        </span>
      ),
    },
  ];
  return (
    <div className="stack">
      <p className="muted">{t('batches.intro')}</p>
      <div className="row"><Button variant="compact" onClick={() => setDialog({})}>{t('batches.add')}</Button></div>
      <Table columns={columns} rows={q.data?.data} loading={q.isLoading} error={q.error?.message} onRetry={q.refetch} empty={t('batches.empty')} />
      {dialog && (
        <BatchDialog courseId={courseId} batch={dialog.batch} onClose={() => setDialog(null)} onDone={() => { setDialog(null); qc.invalidateQueries({ queryKey: ['teacher', 'batches', courseId] }); }} />
      )}
      {schedule && <LiveScheduleDialog courseId={courseId} batch={schedule} onClose={() => setSchedule(null)} />}
    </div>
  );
}
