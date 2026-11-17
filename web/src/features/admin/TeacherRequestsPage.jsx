import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, fileUrl } from '../../api/client';
import { Button, Modal, PageHeader, Select, StatusBadge, Table, Textarea, useToast } from '../../components';
import { formatDate } from '../../utils/format';
import { Pager } from '../../components/Pager';

export default function TeacherRequestsPage() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const q = useQuery({
    queryKey: ['admin', 'teacher-requests', status, page],
    queryFn: () => api.get('/admin/teacher-requests', { status: status || undefined, page, limit: 20 }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'teacher-requests'] });

  const accept = useMutation({
    mutationFn: (r) => api.post(`/admin/teacher-requests/${r.id}/accept`),
    onSuccess: (_, r) => {
      toast.show({ message: t('teacherRequests.accepted', { name: r.name }) });
      refresh();
    },
    onError: (e) => toast.show({ kind: 'error', message: e.message }),
  });
  const reject = useMutation({
    mutationFn: ({ id, reason: why }) => api.post(`/admin/teacher-requests/${id}/reject`, { reason: why }),
    onSuccess: () => {
      toast.show({ message: t('teacherRequests.rejected') });
      setRejecting(null);
      setReason('');
      refresh();
    },
    onError: (e) => setReasonError(e.message),
  });

  const submitReject = () => {
    if (reason.trim().length < 5) {
      setReasonError(t('validation.minReason'));
      return;
    }
    reject.mutate({ id: rejecting.id, reason: reason.trim() });
  };

  const columns = [
    { key: 'name', header: t('common.name'), render: (r) => <button type="button" className="btn btn--link" onClick={() => setViewing(r)}>{r.name}</button> },
    { key: 'mobile', header: t('common.mobile') },
    { key: 'courseName', header: t('teacherRequests.course') },
    { key: 'subject', header: t('teacherRequests.subject') },
    { key: 'experienceYears', header: t('teacherRequests.experience'), render: (r) => t('teacherRequests.years', { n: r.experienceYears }) },
    { key: 'createdAt', header: t('teacherRequests.requested'), render: (r) => formatDate(r.createdAt, i18n.language) },
    { key: 'status', header: t('common.status'), render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (r) =>
        r.status === 'pending' ? (
          <div className="row">
            <Button variant="compact" size="sm" loading={accept.isPending && accept.variables?.id === r.id} onClick={() => accept.mutate(r)}>
              {t('teacherRequests.accept')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setRejecting(r); setReason(''); setReasonError(''); }}>
              {t('teacherRequests.reject')}
            </Button>
          </div>
        ) : (
          r.rejectReason || '—'
        ),
    },
  ];

  return (
    <>
      <PageHeader title={t('teacherRequests.title')} subtitle={t('teacherRequests.subtitle')} />
      <div className="filters">
        <Select
          label={t('common.status')}
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          options={[
            { value: 'pending', label: t('status.pending') },
            { value: 'approved', label: t('status.approved') },
            { value: 'rejected', label: t('status.rejected') },
            { value: '', label: t('common.all') },
          ]}
        />
      </div>
      <Table columns={columns} rows={q.data?.data} loading={q.isLoading} error={q.error?.message} onRetry={q.refetch} empty={t('teacherRequests.empty')} />
      <Pager pagination={q.data?.pagination} onPage={setPage} />

      <Modal
        open={!!rejecting}
        title={rejecting ? t('teacherRequests.rejectTitle', { name: rejecting.name }) : ''}
        onClose={() => setRejecting(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" loading={reject.isPending} onClick={submitReject}>{t('teacherRequests.confirmReject')}</Button>
          </>
        }
      >
        <Textarea label={t('common.reason')} value={reason} onChange={(e) => setReason(e.target.value)} error={reasonError} hint={t('teacherRequests.rejectHint')} required maxLength={500} />
      </Modal>

      <Modal open={!!viewing} title={viewing ? viewing.name : ''} onClose={() => setViewing(null)} size="lg">
        {viewing && (
          <dl className="dl">
            <dt>{t('common.mobile')}</dt><dd>{viewing.mobile}</dd>
            <dt>{t('teacherRequests.course')}</dt><dd>{viewing.courseName}</dd>
            <dt>{t('teacherRequests.subject')}</dt><dd>{viewing.subject}</dd>
            <dt>{t('teacherRequests.experience')}</dt><dd>{t('teacherRequests.years', { n: viewing.experienceYears })}</dd>
            <dt>{t('common.email')}</dt><dd>{viewing.email || '—'}</dd>
            <dt>{t('common.city')}</dt><dd>{viewing.city || '—'}</dd>
            <dt>{t('teacherReg.qualification')}</dt><dd>{viewing.qualification || '—'}</dd>
            <dt>{t('teacherRequests.documents')}</dt>
            <dd className="row">
              {viewing.photoUrl ? <a href={fileUrl(viewing.photoUrl)} target="_blank" rel="noreferrer">{t('teacherRequests.photo')}</a> : null}
              {viewing.idDocumentUrl ? <a href={fileUrl(viewing.idDocumentUrl)} target="_blank" rel="noreferrer">{t('teacherRequests.idDocument')}</a> : null}
              {!viewing.photoUrl && !viewing.idDocumentUrl ? '—' : null}
            </dd>
          </dl>
        )}
      </Modal>
    </>
  );
}
