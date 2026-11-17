import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { Button, Card, Checkbox, EmptyState, PageHeader, Spinner } from '../../components';
import { Pager } from '../../components/Pager';
import { formatDateTime } from '../../utils/format';

// Shared by Admin, Teacher and Student.
export default function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [unread, setUnread] = useState(false);
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['notifications', 'list', unread, page],
    queryFn: () => api.get('/notifications', { unread: unread ? 'true' : undefined, page, limit: 20 }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  const markAll = useMutation({ mutationFn: () => api.post('/notifications/read-all'), onSuccess: refresh });
  const markOne = useMutation({ mutationFn: (id) => api.post(`/notifications/${id}/read`), onSuccess: refresh });

  return (
    <>
      <PageHeader title={t('notifications.title')} actions={<Button variant="compact" loading={markAll.isPending} onClick={() => markAll.mutate()}>{t('notifications.markAll')}</Button>} />
      <Checkbox label={t('notifications.unread')} checked={unread} onChange={(e) => { setUnread(e.target.checked); setPage(1); }} />
      {q.isLoading && <Spinner label={t('common.loading')} />}
      {q.error && <EmptyState title={q.error.message} action={{ label: t('common.retry'), onClick: q.refetch }} />}
      {q.data && q.data.data.length === 0 && <EmptyState title={t('notifications.empty')} />}
      <div className="stack">
        {q.data?.data.map((n) => (
          <Card key={n.id} accent={!n.isRead}>
            <div className="row row--between">
              <strong>{n.title}</strong>
              <span className="muted">{formatDateTime(n.createdAt, i18n.language)}</span>
            </div>
            <p>{n.message}</p>
            <div className="row">
              {n.link && <Link to={n.link} onClick={() => !n.isRead && markOne.mutate(n.id)}>{t('common.view')}</Link>}
              {!n.isRead && <Button variant="ghost" size="sm" onClick={() => markOne.mutate(n.id)}>{t('notifications.markRead')}</Button>}
            </div>
          </Card>
        ))}
      </div>
      <Pager pagination={q.data?.pagination} onPage={setPage} />
    </>
  );
}
