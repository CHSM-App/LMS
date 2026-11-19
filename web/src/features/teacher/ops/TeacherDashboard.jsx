import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api/client';
import { Card, EmptyState, PageHeader, Spinner } from '../../../components';
import { Icon } from '../../../components/Icon';
import { formatLongDay, formatTime } from '../../../utils/format';
import { useAuth } from '../../../app/AuthProvider';

const SHORTCUTS = [
  { to: '/teacher/question-bank', label: 'teacherDash.shortcutQuestions', icon: 'list' },
  { to: '/teacher/exams', label: 'teacherDash.shortcutExam', icon: 'clipboard' },
  { to: '/teacher/live-classes', label: 'teacherDash.shortcutAttendance', icon: 'users' },
  { to: '/teacher/profile', label: 'teacherDash.shortcutProfile', icon: 'user' },
];

// "Who is waiting for me?" — requests, doubts, today's classes, active students.
export default function TeacherDashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['teacher', 'dashboard'], queryFn: () => api.get('/teacher/dashboard') });
  if (q.isLoading) return <Spinner label={t('common.loading')} />;
  if (q.error) return <EmptyState title={q.error.message} action={{ label: t('common.retry'), onClick: q.refetch }} />;
  const d = q.data.data;
  const tiles = [
    { value: d.pendingDemoRequests, label: t('teacherDash.demos'), to: '/teacher/requests', icon: 'video', action: true },
    { value: d.pendingEnrollments, label: t('teacherDash.enrollments'), to: '/teacher/requests', icon: 'inbox', action: true },
    { value: d.openDoubts, label: t('teacherDash.doubts'), to: '/teacher/doubts', icon: 'help', action: true },
    { value: d.activeStudents, label: t('teacherDash.students'), to: '/teacher/students', icon: 'users', action: false },
  ];
  return (
    <div className="stack">
      <PageHeader
        title={t('teacherDash.hello', { name: user ? user.name : '' })}
        subtitle={formatLongDay(new Date(), i18n.language)}
        actions={(
          <>
            <Link to="/teacher/courses" className="btn btn--secondary"><Icon name="plus" size={18} /><span className="btn__label">{t('teacherDash.newCourse')}</span></Link>
            <Link to="/teacher/live-classes" className="btn btn--primary"><Icon name="video" size={18} /><span className="btn__label">{t('teacherDash.scheduleClass')}</span></Link>
          </>
        )}
      />
      <div className="kpis">
        {tiles.map((tile) => {
          const flag = tile.action && tile.value > 0;
          return (
            <Link key={tile.label} to={tile.to} className={`kpi${flag ? ' kpi--flag' : ''}`}>
              <span className="kpi__icon"><Icon name={tile.icon} size={20} /></span>
              <span className="kpi__value">{tile.value}</span>
              <span className="kpi__label">{tile.label}</span>
              <span className="kpi__foot">{flag ? <span className="kpi__flag">{t('teacherDash.needsAction')}</span> : <span className="muted">{t('teacherDash.view')}</span>}</span>
            </Link>
          );
        })}
      </div>
      <div className="dash-cols">
        <Card title={t('teacherDash.today')}>
          {d.todaysClasses.length === 0 ? (
            <div className="dash-empty"><Icon name="calendar" size={28} /><p className="muted">{t('teacherDash.noClasses')}</p></div>
          ) : (
            <ul className="agenda">
              {d.todaysClasses.map((c) => (
                <li key={c.id} className="agenda__row">
                  <span className="agenda__time">{formatTime(c.startsAt, i18n.language)}</span>
                  <span className="agenda__body">
                    <span className="agenda__title">{c.topic}</span>
                    <span className="agenda__meta">{c.course}{c.batch ? ` · ${c.batch}` : ''}</span>
                  </span>
                  {c.meetLink ? (
                    <a className="btn btn--compact btn--sm" href={c.meetLink} target="_blank" rel="noopener noreferrer"><span className="btn__label">{t('liveClasses.join')}</span></a>
                  ) : (
                    <Link className="btn btn--secondary btn--sm" to="/teacher/live-classes"><span className="btn__label">{t('liveClasses.addLink')}</span></Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={t('teacherDash.shortcuts')}>
          <ul className="shortcuts">
            {SHORTCUTS.map((s) => (
              <li key={s.to}>
                <Link to={s.to} className="shortcut">
                  <span className="shortcut__icon"><Icon name={s.icon} size={18} /></span>
                  <span>{t(s.label)}</span>
                  <Icon name="arrow" size={16} className="shortcut__arrow" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
