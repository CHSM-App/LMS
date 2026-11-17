import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { Button, Modal, PageHeader, Select, StatusBadge, Table, useToast } from '../../components';
import { Pager } from '../../components/Pager';
import { formatDate } from '../../utils/format';
import { SubscriptionForm } from './SubscriptionForm';

export function useSaveSubscription(editing, onDone) {
  const { t } = useTranslation();
  const toast = useToast();
  return useMutation({
    mutationFn: (body) => (editing ? api.put(`/admin/subscriptions/${editing.id}`, body) : api.post('/admin/subscriptions', body)),
    onSuccess: () => {
      toast.show({ message: t('subscriptions.saved') });
      onDone();
    },
  });
}

export default function SubscriptionsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);

  const list = useQuery({
    queryKey: ['admin', 'subscriptions', status, page],
    queryFn: () => api.get('/admin/subscriptions', { status: status || undefined, page, limit: 20 }),
  });
  const teachers = useQuery({
    queryKey: ['admin', 'teachers', 'all-active'],
    queryFn: () => api.get('/admin/teachers', { status: 'approved', limit: 100 }),
    enabled: adding,
  });
  const close = () => {
    setEditing(null);
    setAdding(false);
  };
  const save = useSaveSubscription(editing, () => {
    close();
    qc.invalidateQueries({ queryKey: ['admin', 'subscriptions'] });
  });

  const columns = [
    { key: 'teacher', header: t('subscriptions.teacher'), render: (r) => r.teacher.name },
    { key: 'planType', header: t('subscriptions.plan'), render: (r) => t(`subscriptions.plans.${r.planType}`) },
    { key: 'startDate', header: t('subscriptions.startDate'), render: (r) => formatDate(r.startDate, i18n.language) },
    { key: 'endDate', header: t('subscriptions.endDate'), render: (r) => formatDate(r.endDate, i18n.language) },
    { key: 'status', header: t('common.status'), render: (r) => <StatusBadge status={r.status} /> },
    { key: 'studentCount', header: t('teachers.students'), align: 'right' },
    { key: 'actions', header: t('common.actions'), render: (r) => <Button variant="compact" size="sm" onClick={() => setEditing(r)}>{t('common.edit')}</Button> },
  ];

  return (
    <>
      <PageHeader title={t('nav.subscriptions')} subtitle={t('subscriptions.subtitle')} actions={<Button onClick={() => setAdding(true)}>{t('subscriptions.add')}</Button>} />
      <div className="filters">
        <Select
          label={t('common.status')}
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          options={['', 'active', 'upcoming', 'expired', 'blocked'].map((s) => ({ value: s, label: s ? t(`status.${s}`) : t('common.all') }))}
        />
      </div>
      <Table columns={columns} rows={list.data?.data} loading={list.isLoading} error={list.error?.message} onRetry={list.refetch} empty={t('subscriptions.empty')} />
      <Pager pagination={list.data?.pagination} onPage={setPage} />
      <Modal open={adding || !!editing} title={editing ? t('subscriptions.editTitle', { name: editing.teacher.name }) : t('subscriptions.add')} onClose={close}>
        {(adding || editing) && (
          <SubscriptionForm
            key={editing ? editing.id : 'new'}
            teachers={teachers.data?.data || []}
            initial={editing}
            saving={save.isPending}
            serverError={save.error?.message}
            onSubmit={(body) => save.mutate(body)}
            onCancel={close}
          />
        )}
      </Modal>
    </>
  );
}
