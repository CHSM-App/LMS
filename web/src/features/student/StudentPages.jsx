import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, fileUrl } from '../../api/client';
import { useAuth } from '../../app/AuthProvider';
import { Banner, Button, Card, EmptyState, FileUpload, Input, PageHeader, ProgressBar, Select, Spinner, StatusBadge, Table, Textarea, useToast } from '../../components';
import { formatDate, formatDateTime } from '../../utils/format';

export function StudentDashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['student', 'dashboard'], queryFn: () => api.get('/student/dashboard') });
  if (q.isLoading) return <Spinner label={t('common.loading')} />;
  if (q.error) return <EmptyState title={q.error.message} action={{ label: t('common.retry'), onClick: q.refetch }} />;
  const d = q.data.data;
  const next = d.myCourses.find((c) => !c.readOnly && c.accessStatus === 'active' && c.progressPct < 100);
  return (
    <div className="stack">
      <PageHeader title={t('teacherDash.hello', { name: user ? user.name : '' })} subtitle={t('studentDash.subtitle')} />
      {next && (
        <Card accent className="next-up">
          <p className="muted">{t('studentDash.nextUp')}</p>
          <h2>{next.title}</h2>
          <ProgressBar value={next.progressPct} label={next.title} />
          <Link className="btn btn--primary" to={`/student/courses/${next.courseId}`}><span className="btn__label">{t('studentDash.continue')}</span></Link>
        </Card>
      )}
      <h2>{t('nav.myCourses')}</h2>
      {d.myCourses.length === 0 ? (
        <EmptyState title={t('studentDash.noCourses')} action={{ label: t('nav.browse'), onClick: () => navigate('/courses') }} />
      ) : (
        <div className="grid grid--2">
          {d.myCourses.map((c) => (
            <Card key={c.courseId} title={c.title}>
              <p className="muted">{c.teacher}{c.batch ? ` · ${c.batch}` : ''}</p>
              <ProgressBar value={c.progressPct} label={c.title} />
              <p className="row row--between">
                <span>{t('studentDash.until', { date: formatDate(c.endDate, i18n.language) })}</span>
                <StatusBadge status={c.readOnly ? 'paused' : c.accessStatus} />
              </p>
              {c.readOnly && <p className="field__hint">{t('player.readOnly')}</p>}
              <Link to={`/student/courses/${c.courseId}`}>{t('studentDash.open')}</Link>
            </Card>
          ))}
        </div>
      )}
      <Card title={t('nav.liveClasses')}>
        {d.upcomingLiveClasses.length === 0 ? <p className="muted">{t('studentDash.noClasses')}</p> : (
          <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0, gap: 'var(--space-2)' }}>
            {d.upcomingLiveClasses.map((c) => (
              <li key={c.id} className="row row--between">
                <span><strong>{c.topic}</strong> <span className="muted">· {c.course} · {formatDateTime(c.startsAt, i18n.language)}</span></span>
                <a className="btn btn--compact btn--sm" href={c.meetLink} target="_blank" rel="noreferrer"><span className="btn__label">{t('liveClasses.join')}</span></a>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {d.requests.length > 0 && (
        <Card title={t('studentDash.requests')}>
          <Table rowKey={(r) => r.id} rows={d.requests} columns={[
            { key: 'course', header: t('nav.courses'), render: (r) => r.course.title },
            { key: 'requestedAt', header: t('common.date'), render: (r) => formatDate(r.requestedAt, i18n.language) },
            { key: 'status', header: t('common.status'), render: (r) => <StatusBadge status={r.status} /> },
            { key: 'reason', header: t('common.reason'), render: (r) => r.rejectReason || '—' },
          ]} />
        </Card>
      )}
    </div>
  );
}

export function ResultPage() {
  const { attemptId } = useParams();
  const { t, i18n } = useTranslation();
  const q = useQuery({ queryKey: ['student', 'result', attemptId], queryFn: () => api.get(`/student/attempts/${attemptId}/result`) });
  if (q.isLoading) return <Spinner label={t('common.loading')} />;
  if (q.error) return <EmptyState title={q.error.message} />;
  const r = q.data.data;
  const answerText = (x, ans) => {
    if (!ans) return t('result.noAnswer');
    if (ans.text !== undefined) return ans.text || t('result.noAnswer');
    const ids = ans.optionIds || [ans.optionId];
    return x.options.filter((o) => ids.includes(o.id)).map((o) => o.text).join(', ');
  };
  const correctText = (x) => (x.correctAnswer.acceptedAnswers ? x.correctAnswer.acceptedAnswers.join(' / ') : x.options.filter((o) => x.correctAnswer.optionIds.includes(o.id)).map((o) => o.text).join(', '));
  return (
    <div className="stack">
      <PageHeader title={r.exam.title} subtitle={formatDateTime(r.submittedAt, i18n.language)} />
      <Card accent>
        <p className="stat__value">{r.score} / {r.max} ({r.pct}%)</p>
        <p className="row">
          {r.passed !== null && <StatusBadge status={r.passed ? 'approved' : 'rejected'} />}
          {r.rank && <span>{t('result.rank', { rank: r.rank, of: r.of })}</span>}
          {r.autoSubmitted && <span className="muted">{t('result.auto')}</span>}
        </p>
      </Card>
      <h2>{t('result.review')}</h2>
      {r.review.map((x, i) => (
        <Card key={x.questionId}>
          <p className="muted">{t('exam.questionOf', { n: i + 1 })} · {x.marks > 0 ? `+${x.marks}` : x.marks}</p>
          <p><strong>{x.text}</strong></p>
          <p>{x.correct ? '✓' : '✕'} {t('result.yours')}: {answerText(x, x.yourAnswer)}</p>
          {!x.correct && <p>{t('result.correctAnswer')}: {correctText(x)}</p>}
          {x.explanation && <p className="muted">{x.explanation}</p>}
        </Card>
      ))}
      <Link to="/student/exams">{t('result.back')}</Link>
    </div>
  );
}

export function FinalResultPage() {
  const { courseId } = useParams();
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['student', 'final', courseId], queryFn: () => api.get(`/student/courses/${courseId}/final-result`) });
  if (q.isLoading) return <Spinner label={t('common.loading')} />;
  if (q.error) return <EmptyState title={q.error.message} />;
  const r = q.data.data;
  return (
    <div className="stack">
      <PageHeader title={t('studentExams.finalResult')} />
      <Card accent>
        <p className="stat__value">{r.weightedPct}%</p>
        <StatusBadge status={r.passed ? 'approved' : 'rejected'} />
        <p className="muted">{t('result.passMark', { pct: r.passMark })}</p>
      </Card>
      <Table rowKey={(x) => x.examId} rows={r.exams} empty={t('studentExams.none')} columns={[
        { key: 'title', header: t('examBuilder.title'), render: (x) => x.title || t(`examBuilder.categories.${x.category}`) },
        { key: 'weightage', header: t('examBuilder.weightage'), align: 'right', render: (x) => `${x.weightage}%` },
        { key: 'pct', header: '%', align: 'right', render: (x) => (x.attempted ? `${x.pct}%` : '—') },
      ]} />
    </div>
  );
}

export function StudentDoubtsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const dash = useQuery({ queryKey: ['student', 'dashboard'], queryFn: () => api.get('/student/dashboard') });
  const list = useQuery({ queryKey: ['student', 'doubts'], queryFn: () => api.get('/student/doubts') });
  const [courseId, setCourseId] = useState('');
  const [question, setQuestion] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const ask = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('courseId', courseId);
      fd.append('question', question.trim());
      if (file) fd.append('attachment', file);
      return api.form('/student/doubts', fd);
    },
    onSuccess: () => {
      toast.show({ message: t('studentDoubts.sent') });
      setQuestion('');
      setFile(null);
      qc.invalidateQueries({ queryKey: ['student', 'doubts'] });
    },
    onError: (e) => setError(e.message),
  });
  const courses = (dash.data?.data.myCourses || []).filter((c) => !c.readOnly);
  return (
    <div className="stack">
      <PageHeader title={t('nav.doubts')} subtitle={t('studentDoubts.subtitle')} />
      <Card title={t('studentDoubts.ask')}>
        <Select label={t('nav.courses')} value={courseId} placeholder={t('questions.chooseCourse')} onChange={(e) => setCourseId(e.target.value)} options={courses.map((c) => ({ value: String(c.courseId), label: c.title }))} required />
        <Textarea label={t('studentDoubts.question')} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={2000} required />
        <FileUpload label={`${t('doubts.attachment')} (${t('common.optional')})`} accept="image/*,application/pdf" maxMb={5} onFile={setFile} />
        {error && <p className="field__error" role="alert">{error}</p>}
        <Button loading={ask.isPending} onClick={() => (courseId && question.trim() ? ask.mutate() : setError(t('validation.required')))}>{t('studentDoubts.send')}</Button>
      </Card>
      {list.data?.data.length === 0 && <EmptyState title={t('studentDoubts.none')} />}
      {list.data?.data.map((d) => (
        <Card key={d.id}>
          <div className="row row--between"><span className="muted">{d.course.title} · {formatDateTime(d.createdAt, i18n.language)}</span><StatusBadge status={d.status} /></div>
          <p>{d.question}</p>
          {d.attachmentUrl && <a href={fileUrl(d.attachmentUrl)} target="_blank" rel="noreferrer">{t('doubts.attachment')}</a>}
          {d.reply ? <blockquote className="reply">{d.reply}</blockquote> : <p className="muted">{t('studentDoubts.waiting')}</p>}
        </Card>
      ))}
    </div>
  );
}

export function StudentLiveClassesPage() {
  const { t, i18n } = useTranslation();
  const q = useQuery({ queryKey: ['student', 'live'], queryFn: () => api.get('/student/live-classes') });
  return (
    <>
      <PageHeader title={t('nav.liveClasses')} />
      <Table rows={q.data?.data} loading={q.isLoading} error={q.error?.message} empty={t('studentDash.noClasses')} columns={[
        { key: 'topic', header: t('liveClasses.topic') },
        { key: 'course', header: t('nav.courses') },
        { key: 'startsAt', header: t('requests.when'), render: (c) => formatDateTime(c.startsAt, i18n.language) },
        { key: 'j', header: '', render: (c) => <a className="btn btn--primary btn--sm" href={c.meetLink} target="_blank" rel="noreferrer"><span className="btn__label">{t('liveClasses.join')}</span></a> },
      ]} />
    </>
  );
}

export function StudentProgressPage() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['student', 'progress'], queryFn: () => api.get('/student/progress') });
  if (q.isLoading) return <Spinner label={t('common.loading')} />;
  if (q.error) return <EmptyState title={q.error.message} />;
  return (
    <div className="stack">
      <PageHeader title={t('nav.progress')} />
      {q.data.data.courses.length === 0 && <EmptyState title={t('studentDash.noCourses')} />}
      {q.data.data.courses.map((c) => (
        <Card key={c.courseId} title={c.title}>
          <ProgressBar value={c.progressPct} label={t('progressPage.lessons', { done: c.completedLessons, total: c.totalLessons })} />
          <p className="muted">{t('progressPage.lessons', { done: c.completedLessons, total: c.totalLessons })}</p>
          <p>{t('progressPage.attendance', { pct: c.attendancePct, attended: c.classesAttended, held: c.classesHeld })}</p>
          {c.exams.length > 0 && <ul>{c.exams.map((e) => <li key={e.examId}>{e.title}: {e.bestPct}%</li>)}</ul>}
        </Card>
      ))}
    </div>
  );
}

export function StudentProfilePage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { refreshMe } = useAuth();
  const q = useQuery({ queryKey: ['student', 'profile'], queryFn: () => api.get('/student/profile') });
  const [f, setF] = useState(null);
  if (q.data && !f) setF(q.data.data);
  const save = useMutation({
    mutationFn: () => api.put('/student/profile', f),
    onSuccess: () => {
      toast.show({ message: t('common.saved') });
      refreshMe();
    },
    onError: (e) => toast.show({ kind: 'error', message: e.message }),
  });
  if (!f) return <Spinner label={t('common.loading')} />;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); save.mutate(); }} noValidate>
      <PageHeader title={t('nav.profile')} actions={<Link to="/account">{t('nav.account')}</Link>} />
      <Card>
        <div className="grid grid--2">
          <Input label={t('common.name')} value={f.name} onChange={set('name')} required />
          <Input label={t('common.mobile')} value={f.mobile} disabled hint={t('studentProfile.mobileHint')} />
          <Input label={t('requests.education')} value={f.education || ''} onChange={set('education')} />
          <Input label={t('demoForm.classStandard')} value={f.classStandard || ''} onChange={set('classStandard')} />
          <Input label={t('common.city')} value={f.city || ''} onChange={set('city')} />
          <Input label={t('common.email')} type="email" value={f.email || ''} onChange={set('email')} />
          <Select label={t('account.language')} value={f.preferredLang} onChange={set('preferredLang')} options={[{ value: 'en', label: 'English' }, { value: 'mr', label: 'मराठी' }, { value: 'hi', label: 'हिन्दी' }]} />
        </div>
        {!f.whatsappOptIn && <Banner kind="info" message={t('studentProfile.whatsappOff')} />}
      </Card>
      <div className="row"><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></div>
    </form>
  );
}
