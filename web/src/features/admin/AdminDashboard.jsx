import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { Card, EmptyState, PageHeader, Spinner } from '../../components';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => api.get('/admin/dashboard') });
  if (q.isLoading) return <Spinner label={t('common.loading')} />;
  if (q.error) return <EmptyState title={q.error.message} action={{ label: t('common.retry'), onClick: q.refetch }} />;
  const d = q.data.data;
  const tiles = [
    { value: d.pendingRequests, label: t('adminDash.pendingRequests'), to: '/admin/teacher-requests', accent: d.pendingRequests > 0 },
    { value: d.activeTeachers, label: t('adminDash.activeTeachers'), to: '/admin/teachers' },
    { value: d.blockedTeachers, label: t('adminDash.blockedTeachers'), to: '/admin/teachers' },
    { value: d.totalStudents, label: t('adminDash.totalStudents'), to: '/admin/teachers' },
    { value: d.expiringSubscriptions7d, label: t('adminDash.expiring'), to: '/admin/subscriptions', accent: d.expiringSubscriptions7d > 0 },
  ];
  return (
    <>
      <PageHeader title={t('common.dashboard')} subtitle={t('adminDash.subtitle')} />
      <div className="grid grid--3">
        {tiles.map((tile) => (
          <Card key={tile.label} accent={tile.accent}>
            <Link to={tile.to} className="stat">
              <span className="stat__value">{tile.value}</span>
              <span className="stat__label">{tile.label}</span>
            </Link>
          </Card>
        ))}
      </div>
    </>
  );
}
