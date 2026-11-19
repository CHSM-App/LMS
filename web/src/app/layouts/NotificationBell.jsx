import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useAuth } from '../AuthProvider';
import { Icon } from '../../components/Icon';

export function NotificationBell() {
  const { t } = useTranslation();
  const { user } = useAuth();
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
