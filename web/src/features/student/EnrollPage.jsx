import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, fileUrl } from '../../api/client';
import { useAuth, homeFor } from '../../app/AuthProvider';
import { BackLink, Banner, Button, EmptyState, Input, Spinner, Textarea } from '../../components';
import { Icon } from '../../components/Icon';
import { useBrowsePaths } from '../public/browsePaths';
import { StudentRegisterForm } from './StudentRegisterForm';
import { AuthLayout } from '../auth/AuthLayout';

// Enroll Now (spec §3.4): register if needed, then send the enrollment request to the course's teacher.
export default function EnrollPage() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const paths = useBrowsePaths();
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [emailError, setEmailError] = useState('');
  // Enroll now always needs an email: the field is filled from the account and can be changed.
  const q = useQuery({ queryKey: ['public', 'course', slug], queryFn: () => api.get(`/public/courses/${slug}`) });
  const send = useMutation({ mutationFn: () => api.post('/student/enrollments', { courseSlug: slug, message: message.trim() || null, email: email.trim() }) });
  const submit = () => {
    if (!email.trim()) return setEmailError(t('validation.required'));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setEmailError(t('validation.email'));
    setEmailError('');
    return send.mutate();
  };

  if (q.isLoading) return <Spinner label={t('common.loading')} />;
  if (q.error) return <EmptyState title={q.error.message} />;
  const c = q.data.data;

  return (
    <div className="enroll-page">
      <BackLink to={paths.course(c.slug)}>{t('enroll.backToCourse')}</BackLink>
      <div className="demo enroll">
        <aside className="demo__aside">
          <span className="demo__pill">{t('enroll.badge')}</span>
          <div className="enroll__teacher">
            {c.teacher.photoUrl
              ? <img src={fileUrl(c.teacher.photoUrl)} alt="" className="enroll__avatar" />
              : <span className="enroll__avatar enroll__avatar--initial" aria-hidden="true">{c.teacher.name?.[0]}</span>}
            <span>{t('enroll.forCourse', { teacher: c.teacher.name })}</span>
          </div>
          <h1 className="demo__headline enroll__title">{c.title}</h1>
          <ul className="demo__perks">
            {['perk1', 'perk2', 'perk3'].map((k) => (
              <li key={k}><span className="demo__tick"><Icon name="check" size={14} /></span>{t(`enroll.${k}`)}</li>
            ))}
          </ul>
          <p className="demo__trust"><Icon name="shield" size={16} /> {t('enroll.trust')}</p>
        </aside>
        <div className="demo__main enroll__main">
          {!user && (
            <>
              <StudentRegisterForm
                heading={<h2 className="enroll__heading">{t('enroll.createAccount')}</h2>}
                intro={<p className="muted enroll__intro">{t('enroll.createIntro')} <Link to="/login" state={{ from: `/enroll/${slug}` }}>{t('enroll.haveAccount')}</Link></p>}
                onDone={() => {}}
              />
            </>
          )}
          {user && user.role !== 'student' && <Banner kind="info" message={t('enroll.notStudent')} action={<Link to={homeFor(user.role)}>{t('common.dashboard')}</Link>} />}
          {user && user.role === 'student' && (send.isSuccess ? (
            <div className="demo__done">
              <span className="demo__done-icon"><Icon name="check" size={28} /></span>
              <Banner kind="success" message={t('enroll.sent', { teacher: c.teacher.name })} action={<Link to="/student">{t('common.dashboard')}</Link>} />
            </div>
          ) : (
            <div className="stack">
              <h2 className="enroll__heading">{t('enroll.sendTitle')}</h2>
              <Input label={t('common.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={emailError} hint={t('enroll.emailHint')} required autoComplete="email" />
              <Textarea label={`${t('requests.message')} (${t('common.optional')})`} value={message} onChange={(e) => setMessage(e.target.value)} hint={t('enroll.messageHint')} maxLength={1000} />
              {send.error && <Banner kind="error" message={send.error.message} />}
              <Button size="lg" block loading={send.isPending} onClick={submit}>{t('enroll.send')}</Button>
            </div>
          ))}
        </div>
      </div>
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
