import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, fileUrl } from '../../api/client';
import { BackLink, Banner, Button, Card, EmptyState, PageHeader, ProgressBar, Spinner, VideoFrame, LiveStageBadge } from '../../components';
import { LiveLessonPanel } from './LiveLessonPanel';

function Lesson({ contentId, onCompleted }) {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['student', 'content', contentId], queryFn: () => api.get(`/student/contents/${contentId}`) });
  const lastSent = useRef(0);
  const complete = useMutation({ mutationFn: () => api.post(`/student/contents/${contentId}/progress`, { completed: true }), onSuccess: onCompleted });
  if (q.isLoading) return <Spinner label={t('common.loading')} />;
  if (q.error) return <Banner kind="error" message={q.error.message} />;
  const c = q.data.data;
  // Save the playback position at most every 15 seconds.
  const onTime = (sec) => {
    if (Math.abs(sec - lastSent.current) < 15) return;
    lastSent.current = sec;
    api.post(`/student/contents/${contentId}/progress`, { positionSec: Math.floor(sec) }).catch(() => {});
  };
  return (
    <Card title={c.title}>
      {c.type === 'video' && (
        <VideoFrame source={c.videoSource} url={c.videoSource === 'upload' ? fileUrl(c.url) : c.url} title={c.title} startAt={c.lastPositionSec}
          onTimeUpdate={c.videoSource === 'upload' ? onTime : undefined} onEnded={() => complete.mutate()} />
      )}
      {c.type === 'live' && <LiveLessonPanel content={c} onTimeUpdate={onTime} onEnded={() => complete.mutate()} />}
      {(c.type === 'video' || c.type === 'live') && c.downloadable && <p className="field__hint">{t('player.downloadInApp')}</p>}
      {c.type === 'pdf' && (
        <div className="stack">
          <iframe className="pdf-frame" src={fileUrl(c.url)} title={c.title} />
          <p className="row">
            <a href={fileUrl(c.url)} target="_blank" rel="noreferrer">{t('player.openPdf')}</a>
            <a href={fileUrl(c.url)} download>{t('player.downloadPdf')}</a>
          </p>
        </div>
      )}
      {c.type === 'link' && <p><a href={c.url} target="_blank" rel="noreferrer noopener">{t('player.openLink')}</a></p>}
      <div className="row" style={{ marginTop: 'var(--space-4)' }}>
        {c.completed ? <span className="badge badge--approved">✓ {t('player.completed')}</span> : c.canComplete !== false && (
          <Button variant="compact" loading={complete.isPending} onClick={() => complete.mutate()}>{t('player.markComplete')}</Button>
        )}
      </div>
    </Card>
  );
}

export default function CoursePlayerPage() {
  const { courseId } = useParams();
  const [params] = useSearchParams();
  const { t } = useTranslation();
  const qc = useQueryClient();
  // ?lesson=<id> (from a live lesson notification) opens that lesson.
  const [current, setCurrent] = useState(() => Number(params.get('lesson')) || null);
  const q = useQuery({ queryKey: ['student', 'course', courseId], queryFn: () => api.get(`/student/courses/${courseId}`) });
  const course = q.data?.data;
  const lessons = course ? course.subjects.flatMap((s) => s.modules.flatMap((m) => m.contents)) : [];

  useEffect(() => {
    if (!current && lessons.length) {
      const next = lessons.find((l) => !l.completed && !l.locked) || lessons.find((l) => !l.locked);
      if (next) setCurrent(next.id);
    }
  }, [lessons, current]);

  if (q.isLoading) return <Spinner label={t('common.loading')} />;
  if (q.error) return <EmptyState title={q.error.message} />;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['student', 'course', courseId] });
    qc.invalidateQueries({ queryKey: ['student', 'content'] });
    qc.invalidateQueries({ queryKey: ['student', 'dashboard'] });
  };
  return (
    <div className="stack">
      <div><BackLink to="/student/courses">{t('player.back')}</BackLink></div>
      <PageHeader title={course.title} />
      <ProgressBar value={course.progressPct} label={t('player.progress')} />
      {course.readOnly && <Banner kind="warning" message={t('player.readOnly')} />}
      <div className="player">
        <nav className="player__list" aria-label={t('player.lessons')}>
          {course.subjects.map((s) => (
            <div key={s.id}>
              <p className="player__subject">{s.name}</p>
              {s.modules.map((m) => (
                <div key={m.id}>
                  <p className="player__module">{m.name}</p>
                  <ul>
                    {m.contents.map((l) => (
                      <li key={l.id}>
                        <button type="button" className={`player__lesson${current === l.id ? ' player__lesson--current' : ''}`} disabled={l.locked} onClick={() => setCurrent(l.id)} aria-current={current === l.id ? 'true' : undefined}>
                          <span aria-hidden="true">{l.completed ? '✓' : l.locked ? '🔒' : '○'}</span> {l.title}
                          {l.live && <> <LiveStageBadge stage={l.live.stage} /></>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </nav>
        <div className="player__main">{current ? <Lesson key={current} contentId={current} onCompleted={refresh} /> : <EmptyState title={t('player.noLessons')} />}</div>
      </div>
    </div>
  );
}
