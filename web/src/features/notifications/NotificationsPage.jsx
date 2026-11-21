import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { Button, EmptyState, PageHeader, Spinner } from '../../components';
import { Icon } from '../../components/Icon';
import { Pager } from '../../components/Pager';
import { formatDateTime } from '../../utils/format';

const DAY = 86400000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// today | yesterday | earlier, by the viewer's local calendar day.
function dayGroup(value) {
  const diff = Math.round((startOfDay(new Date()) - startOfDay(new Date(value))) / DAY);
  return diff <= 0 ? 'today' : diff === 1 ? 'yesterday' : 'earlier';
}

function timeAgo(value, lang) {
  const secs = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const abs = Math.abs(secs);
  if (abs < 60) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(secs / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(secs / 3600), 'hour');
  if (abs < 7 * 86400) return rtf.format(Math.round(secs / 86400), 'day');
  return null;
}

function NotificationItem({ n, onRead }) {
  const { t, i18n } = useTranslation();
  const full = formatDateTime(n.createdAt, i18n.language);
  const body = (
    <>
      <span className="notif__icon" aria-hidden="true"><Icon name="bell" size={20} /></span>
      <span className="notif__text">
        <span className="notif__title">{n.title}</span>
        <span className="notif__message">{n.message}</span>
      </span>
    </>
  );
  return (
    <li className={`notif${n.isRead ? '' : ' notif--unread'}`}>
      {n.link
        ? <Link to={n.link} className="notif__main" onClick={() => !n.isRead && onRead(n.id)}>{body}</Link>
        : <div className="notif__main">{body}</div>}
      <div className="notif__side">
        <time className="notif__time" dateTime={n.createdAt} title={full}>{timeAgo(n.createdAt, i18n.language) || full}</time>
        {!n.isRead && (
          <button type="button" className="notif__read" onClick={() => onRead(n.id)} aria-label={`${t('notifications.markRead')}: ${n.title}`}>
            <span className="notif__dot" aria-hidden="true" />
            {t('notifications.markRead')}
          </button>
        )}
      </div>
    </li>
  );
}

// Shared by Admin, Teacher and Student.
export default function NotificationsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [unread, setUnread] = useState(false);
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['notifications', 'list', unread, page],
    queryFn: () => api.get('/notifications', { unread: unread ? 'true' : undefined, page, limit: 20 }),
  });
  const countQ = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get('/notifications', { unread: 'true', limit: 1 }),
    retry: false,
  });
  const count = countQ.data?.pagination?.total || 0;
  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  const markAll = useMutation({ mutationFn: () => api.post('/notifications/read-all'), onSuccess: refresh });
  const markOne = useMutation({ mutationFn: (id) => api.post(`/notifications/${id}/read`), onSuccess: refresh });
  const pick = (v) => { setUnread(v); setPage(1); };

  const items = q.data?.data || [];
  const groups = ['today', 'yesterday', 'earlier']
    .map((k) => ({ key: k, rows: items.filter((n) => dayGroup(n.createdAt) === k) }))
    .filter((g) => g.rows.length);

  return (
    <>
      <PageHeader
        title={t('notifications.title')}
        subtitle={t('notifications.subtitle')}
        actions={<Button variant="compact" loading={markAll.isPending} onClick={() => markAll.mutate()}>{t('notifications.markAll')}</Button>}
      />
      <section className="notif-panel">
        <div className="notif-panel__bar" role="group" aria-label={t('notifications.title')}>
          <button type="button" className="notif-tab" aria-pressed={!unread} onClick={() => pick(false)}>{t('common.all')}</button>
          <button type="button" className="notif-tab" aria-pressed={unread} onClick={() => pick(true)}>
            {t('notifications.unread')}
            {count > 0 && <span className="notif-tab__count">{count > 99 ? '99+' : count}</span>}
          </button>
        </div>
        {q.isLoading && <Spinner label={t('common.loading')} />}
        {q.error && <EmptyState title={q.error.message} action={{ label: t('common.retry'), onClick: q.refetch }} />}
        {q.data && items.length === 0 && <EmptyState title={t('notifications.empty')} body={t('notifications.emptyHint')} />}
        {groups.map((g) => (
          <div key={g.key} className="notif-group">
            <h2 className="notif-group__title">{t(`notifications.group.${g.key}`)}</h2>
            <ul className="notif-list">
              {g.rows.map((n) => <NotificationItem key={n.id} n={n} onRead={(id) => markOne.mutate(id)} />)}
            </ul>
          </div>
        ))}
      </section>
      <Pager pagination={q.data?.pagination} onPage={setPage} />
    </>
  );
}
