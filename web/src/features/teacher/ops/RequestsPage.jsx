import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api/client';
import { Button, Input, Modal, PageHeader, Select, StatusBadge, Table, Textarea, useToast } from '../../../components';
import { formatDateTime, todayISO } from '../../../utils/format';

const toLocalInput = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

function ScheduleDialog({ request, onClose, onDone }) {
  const { t } = useTranslation();
  const [when, setWhen] = useState(toLocalInput(request.scheduledAt));
  const [link, setLink] = useState(request.meetLink || '');
  const [error, setError] = useState('');
  const m = useMutation({
    mutationFn: () => api.post(`/teacher/demo-requests/${request.id}/schedule`, { scheduledAt: new Date(when).toISOString(), meetLink: link.trim() || null }),
    onSuccess: onDone,
    onError: (e) => setError(e.message),
  });
  const submit = () => (when ? m.mutate() : setError(t('requests.needWhen')));
  return (
    <Modal open title={t('requests.scheduleTitle', { name: request.name })} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={m.isPending} onClick={submit}>{t('requests.saveSchedule')}</Button></>}>
      <Input label={t('requests.when')} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
      <Input label={`${t('requests.meetLink')} (${t('common.optional')})`} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" hint={t('requests.meetHint')} />
      {error && <p className="field__error" role="alert">{error}</p>}
    </Modal>
  );
}

function WhatsAppCell({ request, onSent }) {
  const { t } = useTranslation();
  const [state, setState] = useState(request.whatsappSentAt ? { sent: true } : null);
  const m = useMutation({
    mutationFn: () => api.post(`/teacher/demo-requests/${request.id}/send-whatsapp`),
    onSuccess: () => {
      setState({ sent: true });
      onSent();
    },
    onError: (e) => setState({ sent: false, message: e.message, fallbackUrl: e.details && e.details.fallbackUrl }),
  });
  if (request.status !== 'scheduled') return '—';
  if (state && state.sent) return <span className="badge badge--approved">{t('requests.sent')}</span>;
  if (state && !state.sent) {
    return (
      <div className="stack" style={{ gap: 'var(--space-1)' }}>
        <span className="badge badge--rejected" title={state.message}>{t('requests.notSent')}</span>
        <div className="row">
          <Button variant="compact" size="sm" loading={m.isPending} onClick={() => m.mutate()}>{t('common.retry')}</Button>
          {state.fallbackUrl && <a href={state.fallbackUrl} target="_blank" rel="noreferrer">{t('requests.openWhatsApp')}</a>}
        </div>
      </div>
    );
  }
  return <Button variant="compact" size="sm" loading={m.isPending} onClick={() => m.mutate()}>{t('requests.sendWhatsApp')}</Button>;
}

export function ApproveDialog({ enrollment, onClose, onDone }) {
  const { t } = useTranslation();
  const batches = useQuery({ queryKey: ['teacher', 'batches', enrollment.course.id], queryFn: () => api.get(`/teacher/courses/${enrollment.course.id}/batches`) });
  const [batchId, setBatchId] = useState('');
  const [startDate, setStart] = useState(todayISO());
  const [endDate, setEnd] = useState('');
  const [error, setError] = useState('');
  const m = useMutation({
    mutationFn: () => api.post(`/teacher/enrollments/${enrollment.id}/approve`, { batchId: Number(batchId), startDate, endDate }),
    onSuccess: onDone,
    onError: (e) => setError(e.message),
  });
  const submit = () => {
    if (!batchId) return setError(t('requests.needBatch'));
    if (!startDate || !endDate) return setError(t('requests.needDates'));
    if (endDate < startDate) return setError(t('subscriptions.dateOrder'));
    return m.mutate();
  };
  const open = (batches.data?.data || []).filter((b) => b.status === 'active');
  return (
    <Modal open title={t('requests.approveTitle', { name: enrollment.student.name })} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={m.isPending} onClick={submit}>{t('requests.approveStudent')}</Button></>}>
      <p className="muted">{t('requests.approveIntro', { course: enrollment.course.title })}</p>
      <Select label={t('nav.batches')} value={batchId} placeholder={t('requests.chooseBatch')} onChange={(e) => setBatchId(e.target.value)} required
        options={open.map((b) => ({ value: String(b.id), label: b.maxStudents ? `${b.name} (${b.studentCount}/${b.maxStudents})` : b.name }))} />
      <div className="grid grid--2">
        <Input label={t('subscriptions.startDate')} type="date" value={startDate} onChange={(e) => setStart(e.target.value)} required />
        <Input label={t('subscriptions.endDate')} type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} required />
      </div>
      {error && <p className="field__error" role="alert">{error}</p>}
    </Modal>
  );
}

function RejectDialog({ title, onClose, onSubmit, saving, needsReason }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    if (needsReason && reason.trim().length < 5) return setError(t('validation.minReason'));
    return onSubmit(reason.trim());
  };
  return (
    <Modal open title={title} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button variant="danger" loading={saving} onClick={submit}>{t('teacherRequests.reject')}</Button></>}>
      {needsReason ? <Textarea label={t('common.reason')} value={reason} onChange={(e) => setReason(e.target.value)} error={error} hint={t('requests.reasonHint')} required /> : <p>{t('requests.rejectDemoIntro')}</p>}
    </Modal>
  );
}

export default function RequestsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState('demo');
  const [status, setStatus] = useState('');
  const [dialog, setDialog] = useState(null);
  const demos = useQuery({ queryKey: ['teacher', 'demos', status], queryFn: () => api.get('/teacher/demo-requests', status ? { status } : undefined), enabled: tab === 'demo' });
  const enrolls = useQuery({ queryKey: ['teacher', 'enrollments', status], queryFn: () => api.get('/teacher/enrollments', status ? { status } : undefined), enabled: tab === 'enroll' });
  const refresh = () => {
    setDialog(null);
    qc.invalidateQueries({ queryKey: ['teacher'] });
  };
  const act = useMutation({
    mutationFn: ({ path, body }) => api.post(path, body),
    onSuccess: refresh,
    onError: (e) => toast.show({ kind: 'error', message: e.message }),
  });

  const demoColumns = [
    { key: 'name', header: t('common.name') },
    { key: 'mobile', header: t('common.mobile') },
    { key: 'education', header: t('requests.education') },
    { key: 'course', header: t('nav.courses'), render: (r) => r.course.title },
    { key: 'message', header: t('requests.message'), render: (r) => r.message || '—' },
    { key: 'scheduledAt', header: t('requests.when'), render: (r) => (r.scheduledAt ? formatDateTime(r.scheduledAt, i18n.language) : '—') },
    { key: 'status', header: t('common.status'), render: (r) => <StatusBadge status={r.status} /> },
    { key: 'wa', header: 'WhatsApp', render: (r) => <WhatsAppCell request={r} onSent={() => qc.invalidateQueries({ queryKey: ['teacher', 'demos'] })} /> },
    {
      key: 'actions', header: t('common.actions'),
      render: (r) => (['pending', 'scheduled'].includes(r.status) ? (
        <div className="row">
          <Button variant="compact" size="sm" onClick={() => setDialog({ kind: 'schedule', item: r })}>{r.status === 'pending' ? t('requests.schedule') : t('requests.reschedule')}</Button>
          {r.status === 'scheduled' && <Button variant="ghost" size="sm" onClick={() => act.mutate({ path: `/teacher/demo-requests/${r.id}/complete` })}>{t('requests.markDone')}</Button>}
          <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: 'rejectDemo', item: r })}>{t('teacherRequests.reject')}</Button>
        </div>
      ) : '—'),
    },
  ];
  const enrollColumns = [
    { key: 'name', header: t('common.name'), render: (r) => r.student.name },
    { key: 'mobile', header: t('common.mobile'), render: (r) => r.student.mobile },
    { key: 'education', header: t('requests.education'), render: (r) => r.student.education || '—' },
    { key: 'course', header: t('nav.courses'), render: (r) => r.course.title },
    { key: 'message', header: t('requests.message'), render: (r) => r.message || '—' },
    { key: 'requestedAt', header: t('common.date'), render: (r) => formatDateTime(r.requestedAt, i18n.language) },
    { key: 'status', header: t('common.status'), render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions', header: t('common.actions'),
      render: (r) => (r.status === 'pending' ? (
        <div className="row">
          <Button variant="compact" size="sm" onClick={() => setDialog({ kind: 'approve', item: r })}>{t('requests.approve')}</Button>
          <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: 'rejectEnroll', item: r })}>{t('teacherRequests.reject')}</Button>
        </div>
      ) : r.batch ? r.batch.name : '—'),
    },
  ];
  const statusOptions = tab === 'demo' ? ['', 'pending', 'scheduled', 'completed', 'rejected'] : ['', 'pending', 'approved', 'rejected'];

  return (
    <>
      <PageHeader title={t('nav.requests')} subtitle={t('requests.subtitle')} />
      <div className="tabs" role="tablist">
        <button type="button" role="tab" className="tabs__tab" aria-selected={tab === 'demo'} onClick={() => { setTab('demo'); setStatus(''); }}>{t('requests.demoTab')}</button>
        <button type="button" role="tab" className="tabs__tab" aria-selected={tab === 'enroll'} onClick={() => { setTab('enroll'); setStatus(''); }}>{t('requests.enrollTab')}</button>
      </div>
      <div className="filters">
        <Select label={t('common.status')} value={status} onChange={(e) => setStatus(e.target.value)} options={statusOptions.map((s) => ({ value: s, label: s ? t(`status.${s}`) : t('common.all') }))} />
      </div>
      {tab === 'demo' ? (
        <Table columns={demoColumns} rows={demos.data?.data} loading={demos.isLoading} error={demos.error?.message} onRetry={demos.refetch} empty={t('requests.noDemos')} />
      ) : (
        <Table columns={enrollColumns} rows={enrolls.data?.data} loading={enrolls.isLoading} error={enrolls.error?.message} onRetry={enrolls.refetch} empty={t('requests.noEnrollments')} />
      )}
      {dialog?.kind === 'schedule' && <ScheduleDialog request={dialog.item} onClose={() => setDialog(null)} onDone={refresh} />}
      {dialog?.kind === 'approve' && <ApproveDialog enrollment={dialog.item} onClose={() => setDialog(null)} onDone={() => { toast.show({ message: t('requests.approved') }); refresh(); }} />}
      {dialog?.kind === 'rejectDemo' && (
        <RejectDialog title={t('requests.rejectDemoTitle', { name: dialog.item.name })} saving={act.isPending} onClose={() => setDialog(null)}
          onSubmit={() => act.mutate({ path: `/teacher/demo-requests/${dialog.item.id}/reject` })} />
      )}
      {dialog?.kind === 'rejectEnroll' && (
        <RejectDialog needsReason title={t('requests.rejectEnrollTitle', { name: dialog.item.student.name })} saving={act.isPending} onClose={() => setDialog(null)}
          onSubmit={(reason) => act.mutate({ path: `/teacher/enrollments/${dialog.item.id}/reject`, body: { reason } })} />
      )}
    </>
  );
}
