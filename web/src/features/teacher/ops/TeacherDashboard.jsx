import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api/client';
import { Card, EmptyState, PageHeader, Spinner } from '../../../components';
import { formatTime } from '../../../utils/format';
import { useAuth } from '../../../app/AuthProvider';

// "Who is waiting for me?" — requests, doubts, today's classes, active students.
export default function TeacherDashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['teacher', 'dashboard'], queryFn: () => api.get('/teacher/dashboard') });
  if (q.isLoading) return <Spinner label={t('common.loading')} />;
  if (q.error) return <EmptyState title={q.error.message} action={{ label: t('common.retry'), onClick: q.refetch }} />;
  const d = q.data.data;
  const tiles = [
    { value: d.pendingDemoRequests, label: t('teacherDash.demos'), to: '/teacher/requests', accent: d.pendingDemoRequests > 0 },
    { value: d.pendingEnrollments, label: t('teacherDash.enrollments'), to: '/teacher/requests', accent: d.pendingEnrollments > 0 },
    { value: d.openDoubts, label: t('teacherDash.doubts'), to: '/teacher/doubts', accent: d.openDoubts > 0 },
    { value: d.activeStudents, label: t('teacherDash.students'), to: '/teacher/students' },
  ];
  return (
    <div className="stack">
      <PageHeader title={t('teacherDash.hello', { name: user ? user.name : '' })} subtitle={t('teacherDash.subtitle')} />
      <div className="grid grid--3">
        {tiles.map((tile) => (
          <Card key={tile.label} accent={tile.accent}>
            <Link to={tile.to} className="stat"><span className="stat__value">{tile.value}</span><span className="stat__label">{tile.label}</span></Link>
          </Card>
        ))}
      </div>
      <Card title={t('teacherDash.today')}>
        {d.todaysClasses.length === 0 ? (
          <p className="muted">{t('teacherDash.noClasses')}</p>
        ) : (
          <ul className="stack" style={{ gap: 'var(--space-2)', listStyle: 'none', padding: 0, margin: 0 }}>
            {d.todaysClasses.map((c) => (
              <li key={c.id} className="row row--between">
                <span><strong>{formatTime(c.startsAt, i18n.language)}</strong> {c.topic} <span className="muted">· {c.course}{c.batch ? ` · ${c.batch}` : ''}</span></span>
                <a className="btn btn--primary btn--sm" href={c.meetLink} target="_blank" rel="noreferrer"><span className="btn__label">{t('liveClasses.join')}</span></a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
