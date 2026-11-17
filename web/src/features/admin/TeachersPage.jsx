import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { Button, Input, Modal, PageHeader, Select, StatusBadge, Table, Textarea, useToast } from '../../components';
import { Pager } from '../../components/Pager';
import { formatDate } from '../../utils/format';

export function BlockDialog({ teacher, onClose, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const m = useMutation({
    mutationFn: () => api.post(`/admin/teachers/${teacher.publicId}/block`, { reason: reason.trim() }),
    onSuccess: () => {
      toast.show({ message: t('teachers.blockedToast', { name: teacher.name }) });
      onDone();
    },
    onError: (e) => setError(e.message),
  });
  const submit = () => {
    if (reason.trim().length < 5) {
      setError(t('validation.minReason'));
      return;
    }
    m.mutate();
  };
  return (
    <Modal
      open
      title={t('teachers.blockTitle', { name: teacher.name })}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="danger" loading={m.isPending} onClick={submit}>{t('teachers.blockConfirm')}</Button>
        </>
      }
    >
      <p>{t('teachers.blockIntro')}</p>
      <Textarea label={t('common.reason')} value={reason} onChange={(e) => setReason(e.target.value)} error={error} required maxLength={500} />
    </Modal>
  );
}

export function useActivate(onDone) {
  const { t } = useTranslation();
  const toast = useToast();
  return useMutation({
    mutationFn: (teacher) => api.post(`/admin/teachers/${teacher.publicId}/activate`),
    onSuccess: (_, teacher) => {
      toast.show({ message: t('teachers.activatedToast', { name: teacher.name }) });
      onDone();
    },
    onError: (e) => toast.show({ kind: 'error', message: e.message }),
  });
}

export default function TeachersPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [blocking, setBlocking] = useState(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'teachers'] });
  const activate = useActivate(refresh);

  const list = useQuery({
    queryKey: ['admin', 'teachers', status, q, page],
    queryFn: () => api.get('/admin/teachers', { status: status || undefined, q: q || undefined, page, limit: 20 }),
  });

  const columns = [
    { key: 'name', header: t('common.name'), render: (r) => <Link to={`/admin/teachers/${r.publicId}`}>{r.name}</Link> },
    { key: 'mobile', header: t('common.mobile') },
    { key: 'subject', header: t('teacherRequests.subject') },
    { key: 'status', header: t('common.status'), render: (r) => <StatusBadge status={r.status} /> },
    { key: 'joinedAt', header: t('teachers.joined'), render: (r) => formatDate(r.joinedAt, i18n.language) },
    { key: 'studentCount', header: t('teachers.students'), align: 'right' },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (r) =>
        r.status === 'blocked' ? (
          <Button variant="compact" size="sm" loading={activate.isPending && activate.variables?.publicId === r.publicId} onClick={() => activate.mutate(r)}>
            {t('teachers.activate')}
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setBlocking(r)}>{t('teachers.block')}</Button>
        ),
    },
  ];

  return (
    <>
      <PageHeader title={t('nav.teachers')} subtitle={t('teachers.subtitle')} />
      <form className="filters" onSubmit={(e) => e.preventDefault()} role="search">
        <Input label={t('common.search')} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder={t('teachers.searchHint')} />
        <Select
          label={t('common.status')}
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          options={[
            { value: '', label: t('common.all') },
            { value: 'approved', label: t('status.active') },
            { value: 'blocked', label: t('status.blocked') },
          ]}
        />
      </form>
      <Table columns={columns} rows={list.data?.data} loading={list.isLoading} error={list.error?.message} onRetry={list.refetch} empty={t('teachers.empty')} />
      <Pager pagination={list.data?.pagination} onPage={setPage} />
      {blocking && <BlockDialog teacher={blocking} onClose={() => setBlocking(null)} onDone={() => { setBlocking(null); refresh(); }} />}
    </>
  );
}
