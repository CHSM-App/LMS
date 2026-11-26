import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useAuth } from '../AuthProvider';
import { Icon } from '../../components/Icon';
import { enableWebPush } from '../../utils/webPush';

export function NotificationBell() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  // Register this browser for push once logged in, and refresh the bell when the service worker
  // reports a push (so the count updates at once instead of waiting for the 60s poll).
  useEffect(() => {
    if (!user) return undefined;
    enableWebPush();
    if (!('serviceWorker' in navigator)) return undefined;
    const onMessage = (e) => {
      if (e.data && e.data.type === 'lms-push') qc.invalidateQueries({ queryKey: ['notifications'] });
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [user, qc]);
  const { data } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get('/notifications', { unread: 'true', limit: 1 }),
    enabled: !!user,
    refetchInterval: 60000,
    retry: false,
  });
  const count = data?.pagination?.total || 0;
  return (
    <Link to="/notifications" className="bell" aria-label={t('notifications.bell', { count })}>
      <Icon name="bell" size={22} />
      {count > 0 && <span className="bell__count">{count > 99 ? '99+' : count}</span>}
    </Link>
  );
}
