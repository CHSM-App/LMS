import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { Input, PageHeader, Select, Table } from '../../components';
import { Pager } from '../../components/Pager';
import { formatDateTime } from '../../utils/format';

const ACTIONS = ['teacher_request.accept', 'teacher_request.reject', 'teacher.block', 'teacher.activate', 'subscription.create', 'subscription.update', 'user.change_mobile'];

const summary = (obj) => (obj ? Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join(', ') : '—');

export default function AuditLogPage() {
  const { t, i18n } = useTranslation();
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['admin', 'audit', action, from, to, page],
    queryFn: () => api.get('/admin/audit-log', { action: action || undefined, from: from || undefined, to: to || undefined, page, limit: 30 }),
  });
  const columns = [
    { key: 'createdAt', header: t('common.date'), render: (r) => formatDateTime(r.createdAt, i18n.language) },
    { key: 'adminName', header: t('audit.admin') },
    { key: 'action', header: t('audit.action'), render: (r) => t(`audit.actions.${r.action}`, { defaultValue: r.action }) },
    { key: 'before', header: t('audit.before'), render: (r) => summary(r.before) },
    { key: 'after', header: t('audit.after'), render: (r) => summary(r.after) },
    { key: 'ip', header: 'IP' },
  ];
  return (
    <>
      <PageHeader title={t('nav.auditLog')} subtitle={t('audit.subtitle')} />
      <div className="filters">
        <Select label={t('audit.action')} value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}
          options={[{ value: '', label: t('common.all') }, ...ACTIONS.map((a) => ({ value: a, label: t(`audit.actions.${a}`) }))]} />
        <Input label={t('audit.from')} type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <Input label={t('audit.to')} type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
      </div>
      <Table columns={columns} rows={q.data?.data} loading={q.isLoading} error={q.error?.message} onRetry={q.refetch} empty={t('audit.empty')} />
      <Pager pagination={q.data?.pagination} onPage={setPage} />
    </>
  );
}
