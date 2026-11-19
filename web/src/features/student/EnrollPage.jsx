import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useAuth, homeFor } from '../../app/AuthProvider';
import { Banner, Button, Card, EmptyState, Spinner, Textarea } from '../../components';
import { StudentRegisterForm } from './StudentRegisterForm';
import { AuthLayout } from '../auth/AuthLayout';

// Enroll Now (spec §3.4): register if needed, then send the enrollment request to the course's teacher.
export default function EnrollPage() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const q = useQuery({ queryKey: ['public', 'course', slug], queryFn: () => api.get(`/public/courses/${slug}`) });
  const send = useMutation({ mutationFn: () => api.post('/student/enrollments', { courseSlug: slug, message: message.trim() || null }) });

  if (q.isLoading) return <Spinner label={t('common.loading')} />;
  if (q.error) return <EmptyState title={q.error.message} />;
  const c = q.data.data;

  return (
    <div className="auth-card" style={{ maxWidth: 720 }}>
      <Card>
        <p className="muted">{t('enroll.forCourse', { teacher: c.teacher.name })}</p>
        <h1>{c.title}</h1>
        {!user && (
          <>
            <h2>{t('enroll.createAccount')}</h2>
            <p className="muted">{t('enroll.createIntro')} <Link to="/login" state={{ from: `/enroll/${slug}` }}>{t('enroll.haveAccount')}</Link></p>
            <StudentRegisterForm onDone={() => {}} />
          </>
        )}
        {user && user.role !== 'student' && <Banner kind="info" message={t('enroll.notStudent')} action={<Link to={homeFor(user.role)}>{t('common.dashboard')}</Link>} />}
        {user && user.role === 'student' && (send.isSuccess ? (
          <Banner kind="success" message={t('enroll.sent', { teacher: c.teacher.name })} action={<Link to="/student">{t('common.dashboard')}</Link>} />
        ) : (
          <div className="stack">
            <Textarea label={`${t('requests.message')} (${t('common.optional')})`} value={message} onChange={(e) => setMessage(e.target.value)} hint={t('enroll.messageHint')} maxLength={1000} />
            {send.error && <Banner kind="error" message={send.error.message} />}
            <div className="row"><Button loading={send.isPending} onClick={() => send.mutate()}>{t('enroll.send')}</Button></div>
          </div>
        ))}
      </Card>
    </div>
  );
}

export function StudentRegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <AuthLayout panel="auth.panelStudent" wide>
      <StudentRegisterForm
        heading={<h1 className="auth-split__heading">{t('enroll.createAccount')}</h1>}
        intro={<p className="muted">{t('enroll.createIntro')}</p>}
        footer={<p className="auth-split__switch"><Link to="/login">{t('enroll.haveAccount')}</Link></p>}
        onDone={() => navigate('/student', { replace: true })}
      />
    </AuthLayout>
  );
}
