import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, fileUrl } from '../../api/client';
import { useAuth } from '../../app/AuthProvider';
import { BackLink, Banner, Button, Card, EmptyState, FileUpload, Input, PageHeader, ProgressBar, Select, Spinner, StatusBadge, Table, Textarea, useToast } from '../../components';
import { formatDate, formatDateTime, formatLongDay, formatRelativeDay } from '../../utils/format';
import { LiveStageBadge } from '../../components/LiveStageBadge';
import { markLanguageChosen } from '../../i18n/preference';
import { Icon } from '../../components/Icon';
import { CourseCard } from '../public/CourseCard';

// Marks the student present when they click Join (POST /student/live-classes/:id/join).
function markJoined(liveClassId) {
  if (!liveClassId) return;
  api.post(`/student/live-classes/${liveClassId}/join`, {}).catch(() => {});
}

// Join is shown only in the join window (10 min before start until the end); the API sends meetLink only then.
function JoinOrWait({ c, className }) {
  const { t } = useTranslation();
  if (c.canJoin && c.meetLink) {
    // Clicking Join marks attendance automatically; Meet still opens even if that call fails.
    return (
      <a className={className} href={c.meetLink} target="_blank" rel="noopener noreferrer" onClick={() => markJoined(c.id)}>
        <span className="btn__label">{t('liveClasses.join')}</span>
      </a>
    );
  }
  return <span className="muted">{t(c.waitingForLink ? 'liveClasses.waitingForLink' : 'liveClasses.joinSoon')}</span>;
}

// Enrolled courses as cards; shared by the dashboard and the My courses page.
// `compact`: small horizontal cards for the dashboard side column.
function MyCourseCards({ courses, compact = false }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  if (courses.length === 0) {
    return <EmptyState title={t('studentDash.noCourses')} action={{ label: t('nav.browse'), onClick: () => navigate('/student/browse') }} />;
  }
  return (
    <div className={`my-courses${compact ? ' my-courses--compact' : ''}`}>
      {courses.map((c) => (
        <article key={c.courseId} className="my-course">
          <CourseThumb course={c} />
          <div className="my-course__body">
            <div className="row row--between">
              <h3 className="my-course__title">{c.title}</h3>
              <StatusBadge status={c.readOnly ? 'paused' : c.accessStatus} />
            </div>
            <p className="muted my-course__meta">{c.teacher}{c.batch ? ` · ${c.batch}` : ''}</p>
            {compact && c.nextLesson && <p className="my-course__next">{t('studentDash.nextLesson', { title: c.nextLesson.title })}</p>}
            <ProgressBar value={c.progressPct} label={c.title} />
            <div className="row row--between my-course__foot">
              <span className="muted">
                {compact && c.lastStudiedAt
                  ? t('studentDash.lastStudied', { when: formatRelativeDay(c.lastStudiedAt, i18n.language) })
                  : t('studentDash.until', { date: formatDate(c.endDate, i18n.language) })}
              </span>
              {compact && c.nextLesson && !c.readOnly ? (
                <Link to={courseLink(c)} aria-label={t('studentDash.continueCourse', { title: c.title })}>{t('studentDash.continue')}</Link>
              ) : (
                <Link to={`/student/courses/${c.courseId}`}>{t('studentDash.open')}</Link>
              )}
            </div>
            {c.readOnly && <p className="field__hint">{t('player.readOnly')}</p>}
          </div>
        </article>
      ))}
    </div>
  );
}

// Opens the course on its next lesson when there is one.
const courseLink = (c) => `/student/courses/${c.courseId}${c.nextLesson ? `?lesson=${c.nextLesson.id}` : ''}`;

// Course image, or the generated cover when the teacher added none.
function CourseThumb({ course, className = '' }) {
  return (
    <div className={`my-course__thumb ${className}`}>
      {course.thumbnailUrl ? <img src={fileUrl(course.thumbnailUrl)} alt="" loading="lazy" /> : (
        <div className="course-cover" aria-hidden="true"><span className="course-cover__title">{course.title}</span></div>
      )}
    </div>
  );
}

export function StudentMyCoursesPage() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['student', 'dashboard'], queryFn: () => api.get('/student/dashboard') });
  if (q.isLoading) return <Spinner label={t('common.loading')} />;
  if (q.error) return <EmptyState title={q.error.message} action={{ label: t('common.retry'), onClick: q.refetch }} />;
  return (
    <div className="stack">
      <PageHeader title={t('nav.myCourses')} subtitle={t('studentCourses.subtitle')} />
      <MyCourseCards courses={q.data.data.myCourses} />
    </div>
  );
}

const EXPLORE_COUNT = 6;

// New student, nothing enrolled yet: a few real courses right on the dashboard, the rest one click away.
function ExploreCourses() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['public', 'courses', 'explore'], queryFn: () => api.get('/public/courses', { page: 1, limit: EXPLORE_COUNT }), staleTime: 60000 });
  const courses = q.data ? q.data.data : [];
  if (q.isLoading || q.error || courses.length === 0) return null;
  return (
    <section className="stack" aria-labelledby="dash-explore">
      <div className="row row--between">
        <h2 id="dash-explore" className="card__title">{t('studentDash.exploreTitle')}</h2>
        <Link to="/student/browse" className="dash-side__all">{t('studentDash.exploreAll')}</Link>
      </div>
      <div className="course-grid">
        {courses.map((c) => <CourseCard key={c.slug} course={c} />)}
      </div>
    </section>
  );
}

// How many items the dashboard shows before pointing to the full page.
const COURSES_ON_DASH = 3;
const LIVE_ON_DASH = 4;

const EXAM_TONE = { notStarted: 'neutral', inProgress: 'pending', completed: 'approved', closed: 'rejected', notOpen: 'neutral', overdue: 'pending' };

// Newest exam of my courses: Start / Resume, or the result once done.
function LatestExamCard({ exam, t, lang }) {
  const state = exam.status === 'notStarted' || exam.status === 'completed' ? (exam.closed ? 'closed' : exam.notOpen ? 'notOpen' : exam.status === 'notStarted' && exam.overdue ? 'overdue' : exam.status) : exam.status;
  const canStart = !exam.closed && !exam.notOpen;
  const canRetry = exam.status === 'completed' && exam.attemptsLeft !== 0 && canStart;
  return (
    <section className="card" aria-labelledby="dash-exam">
      <div className="row row--between">
        <h2 id="dash-exam" className="card__title">{t('studentDash.latestExam')}</h2>
        <span className={`badge badge--${EXAM_TONE[state]}`}>{t(`studentExams.status.${state}`)}</span>
      </div>
      <p><strong>{exam.title}</strong></p>
      <p className="muted">{[exam.course, exam.timeLimitMin ? t('studentExams.minutes', { n: exam.timeLimitMin }) : null].filter(Boolean).join(' · ')}</p>
      {(exam.notOpen ? exam.startsAt : exam.endsAt) && <p className="muted">{exam.notOpen ? t('studentExams.opens', { date: formatDateTime(exam.startsAt, lang) }) : t('studentExams.due', { date: formatDateTime(exam.endsAt, lang) })}</p>}
      {exam.best && <p className="muted">{t('studentExams.best', { pct: exam.best.pct })}</p>}
      <div className="row">
        {exam.status !== 'completed' && canStart && (
          <Link className="btn btn--primary btn--sm" to={`/student/exams/${exam.id}/take`}><span className="btn__label">{t(exam.status === 'inProgress' ? 'studentExams.resume' : 'studentExams.start')}</span></Link>
        )}
        {exam.status === 'completed' && exam.lastAttemptId && (
          <Link className="btn btn--secondary btn--sm" to={`/student/attempts/${exam.lastAttemptId}/result`}><span className="btn__label">{t('studentExams.viewResult')}</span></Link>
        )}
        {canRetry && <Link className="btn btn--primary btn--sm" to={`/student/exams/${exam.id}/take`}><span className="btn__label">{t('studentExams.start')}</span></Link>}
        <Link className="dash-side__all" to="/student/exams">{t('studentDash.allExams')}</Link>
      </div>
    </section>
  );
}

export function StudentDashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['student', 'dashboard'], queryFn: () => api.get('/student/dashboard') });
  if (q.isLoading) return <Spinner label={t('common.loading')} />;
  if (q.error) return <EmptyState title={q.error.message} action={{ label: t('common.retry'), onClick: q.refetch }} />;
  const d = q.data.data;
  const next = d.myCourses.find((c) => !c.readOnly && c.accessStatus === 'active' && c.progressPct < 100);
  const active = d.myCourses.filter((c) => c.accessStatus === 'active');
  // Classes running now come first, then the rest by start time.
  const liveFirst = [...d.upcomingLiveClasses].sort((a, b) => (a.stage === 'live' ? 0 : 1) - (b.stage === 'live' ? 0 : 1) || new Date(a.startsAt) - new Date(b.startsAt));
  const avg = d.myCourses.length ? Math.round(d.myCourses.reduce((s, c) => s + c.progressPct, 0) / d.myCourses.length) : 0;
  const stats = [
    { label: t('studentDash.statCourses'), value: active.length, icon: 'book' },
    { label: t('studentDash.statProgress'), value: `${avg}%`, icon: 'chart' },
    { label: t('studentDash.statClasses'), value: d.upcomingLiveClasses.length, icon: 'video' },
  ];
  const requestsCard = d.requests.length > 0 && (
        <Card title={t('studentDash.requests')}>
          <Table rowKey={(r) => r.id} rows={d.requests} columns={[
            { key: 'course', header: t('nav.courses'), render: (r) => r.course.title },
            { key: 'requestedAt', header: t('common.date'), render: (r) => formatDate(r.requestedAt, i18n.language) },
            { key: 'status', header: t('common.status'), render: (r) => <StatusBadge status={r.status} /> },
            { key: 'reason', header: t('common.reason'), render: (r) => r.rejectReason || '—' },
          ]} />
        </Card>
  );
  // Nothing enrolled yet: no empty stat/class/course panels, just the courses to pick from.
  if (d.myCourses.length === 0 && d.upcomingLiveClasses.length === 0 && !d.latestExam) {
    return (
      <div className="stack">
        <PageHeader title={t('teacherDash.hello', { name: user ? user.name : '' })} subtitle={formatLongDay(new Date(), i18n.language)} />
        {requestsCard}
        <ExploreCourses />
      </div>
    );
  }
  return (
    <div className="stack">
      <PageHeader title={t('teacherDash.hello', { name: user ? user.name : '' })} subtitle={formatLongDay(new Date(), i18n.language)} />
      <ul className="kpis kpis--3" aria-label={t('studentDash.summary')}>
        {stats.map((s) => (
          <li key={s.label} className="kpi">
            <span className="kpi__icon"><Icon name={s.icon} size={20} /></span>
            <span className="kpi__value">{s.value}</span>
            <span className="kpi__label">{s.label}</span>
          </li>
        ))}
      </ul>
      {next && (
        <section className="next-up" aria-label={next.lastStudiedAt ? t('studentDash.leftOff') : t('studentDash.nextUp')}>
          <CourseThumb course={next} className="next-up__thumb" />
          <div className="next-up__body">
            <p className="next-up__eyebrow">{next.lastStudiedAt ? t('studentDash.leftOff') : t('studentDash.nextUp')}</p>
            <h2 className="next-up__title">{next.title}</h2>
            <p className="muted">{next.teacher}{next.batch ? ` · ${next.batch}` : ''}</p>
            {next.nextLesson && <p className="next-up__lesson">{t('studentDash.nextLesson', { title: next.nextLesson.title })}</p>}
            <ProgressBar value={next.progressPct} label={next.title} />
            <Link className="btn btn--primary" to={courseLink(next)}><span className="btn__label">{t('studentDash.continue')}</span></Link>
          </div>
        </section>
      )}
      <div className="dash-cols dash-cols--side">
        <div className="stack">
        <section className="card dash-live" aria-labelledby="dash-live">
          <div className="row row--between">
            <h2 id="dash-live" className="card__title">{t('nav.liveClasses')}</h2>
            {liveFirst.length > LIVE_ON_DASH && (
              <Link to="/student/live-classes" className="dash-side__all">{t('studentDash.allClasses', { n: liveFirst.length })}</Link>
            )}
          </div>
          {liveFirst.length === 0 ? (
            <div className="dash-empty"><Icon name="calendar" size={24} /><p className="muted">{t('studentDash.noClasses')}</p></div>
          ) : (
            <ul className="side-list">
              {liveFirst.slice(0, LIVE_ON_DASH).map((c) => (
                <li key={c.id} className={`side-list__item${c.stage === 'live' ? ' side-list__item--live' : ''}`}>
                  {c.stage === 'live' && <LiveStageBadge stage="live" />}
                  <span className="side-list__title">{c.topic}</span>
                  <span className="side-list__meta">{formatDateTime(c.startsAt, i18n.language)}</span>
                  <JoinOrWait c={c} className={c.stage === 'live' ? 'btn btn--primary btn--sm btn--block' : 'btn btn--compact btn--sm'} />
                </li>
              ))}
            </ul>
          )}
        </section>
        {d.latestExam && <LatestExamCard exam={d.latestExam} t={t} lang={i18n.language} />}
        </div>
        <section className="card dash-courses" aria-labelledby="dash-courses">
          <div className="row row--between">
            <h2 id="dash-courses" className="card__title">{t('nav.myCourses')}</h2>
            {d.myCourses.length > COURSES_ON_DASH && (
              <Link to="/student/courses" className="dash-side__all">{t('studentDash.allCourses', { n: d.myCourses.length })}</Link>
            )}
          </div>
          <MyCourseCards courses={d.myCourses.slice(0, COURSES_ON_DASH)} compact />
        </section>
      </div>
      {requestsCard}
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
      <div><BackLink to="/student/exams">{t('result.back')}</BackLink></div>
      <PageHeader title={r.exam.title} subtitle={`${formatDateTime(r.submittedAt, i18n.language)}${r.late ? ` · ${t('result.late')}` : ''}`} />
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
          {x.explanationImageUrl && <img src={fileUrl(x.explanationImageUrl)} alt={t('result.solutionImage')} className="solution-img" loading="lazy" />}
        </Card>
      ))}
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
      <div><BackLink to={`/student/courses/${courseId}`}>{t('player.backToCourse')}</BackLink></div>
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
        { key: 'j', header: '', render: (c) => <JoinOrWait c={c} className="btn btn--primary btn--sm" /> },
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

export function StudentAttendancePage() {
  const { t, i18n } = useTranslation();
  const q = useQuery({ queryKey: ['student', 'attendance'], queryFn: () => api.get('/student/attendance') });
  if (q.isLoading) return <Spinner label={t('common.loading')} />;
  if (q.error) return <EmptyState title={q.error.message} />;
  const courses = q.data.data.courses;
  return (
    <div className="stack">
      <PageHeader title={t('nav.attendance')} subtitle={t('attendancePage.subtitle')} />
      {courses.length === 0 && <EmptyState title={t('studentDash.noCourses')} />}
      {courses.map((c) => (
        <Card key={c.courseId} title={c.title}>
          {c.classes.length === 0 ? <p className="muted">{t('attendancePage.empty')}</p> : (
            <>
              <ProgressBar value={c.attendancePct} label={t('attendancePage.summary', { pct: c.attendancePct, attended: c.classesAttended, held: c.classesHeld })} />
              <Table rows={c.classes} columns={[
                { key: 'topic', header: t('attendancePage.topic') },
                { key: 'startsAt', header: t('common.date'), render: (x) => formatDateTime(x.startsAt, i18n.language) },
                { key: 'present', header: t('common.status'), render: (x) => <StatusBadge status={x.present ? 'present' : 'absent'} /> },
              ]} />
            </>
          )}
        </Card>
      ))}
    </div>
  );
}

export function StudentProfilePage() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { refreshMe } = useAuth();
  const q = useQuery({ queryKey: ['student', 'profile'], queryFn: () => api.get('/student/profile') });
  const [f, setF] = useState(null);
  if (q.data && !f) setF(q.data.data);
  const save = useMutation({
    mutationFn: () => api.put('/student/profile', f),
    onSuccess: () => {
      // The language saved here is now this device's choice too, so the next login keeps it.
      if (f.preferredLang && f.preferredLang !== i18n.language) {
        markLanguageChosen();
        i18n.changeLanguage(f.preferredLang);
      }
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
