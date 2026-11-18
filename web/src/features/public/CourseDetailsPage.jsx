import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, fileUrl } from '../../api/client';
import { Button, Card, EmptyState, Modal, Spinner, VideoFrame } from '../../components';
import { Markdown } from '../../components/Markdown';
import { formatDate } from '../../utils/format';
import { LiveDemoForm } from './LiveDemoForm';
import { useBrowsePaths } from './browsePaths';

export default function CourseDetailsPage() {
  const { slug } = useParams();
  const { t, i18n } = useTranslation();
  const [demoOpen, setDemoOpen] = useState(false);
  const paths = useBrowsePaths();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['public', 'course', slug], queryFn: () => api.get(`/public/courses/${slug}`) });
  const c = q.data?.data;

  useEffect(() => {
    if (!c) return;
    document.title = `${c.title} — ${c.teacher.name}`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', String(c.description).slice(0, 155));
  }, [c]);

  if (q.isLoading) return <Spinner label={t('common.loading')} />;
  if (q.error) return <EmptyState title={q.error.status === 404 ? t('courseDetails.notFound') : q.error.message} action={{ label: t('courseDetails.browse'), onClick: () => navigate(paths.list) }} />;

  return (
    <div className={paths.inStudent ? 'course-details' : 'container course-details'}>
      <div className="course-details__main stack">
        <p className="muted">{c.subject} · {t(`courses.lang.${c.language}`)}{c.durationText ? ` · ${c.durationText}` : ''}</p>
        <h1>{c.title}</h1>
        <div className="grid grid--2">
          {c.demoVideos.map((v, i) => (
            <figure key={v.url} className="demo-video">
              <VideoFrame source={v.source} url={v.source === 'upload' ? fileUrl(v.url) : v.url} title={t('courseDetails.demo', { n: i + 1 })} />
              <figcaption className="muted">{t('courseDetails.demo', { n: i + 1 })}</figcaption>
            </figure>
          ))}
        </div>
        <Card title={t('courseDetails.about')}>
          <Markdown source={c.description} />
        </Card>
        <Card title={t('courseDetails.curriculum')}>
          {c.curriculum.length === 0 && <p className="muted">{t('courseDetails.noCurriculum')}</p>}
          {c.curriculum.map((s) => (
            <details key={s.name} className="accordion" open>
              <summary>{s.name}</summary>
              {s.modules.map((m) => (
                <div key={m.name} className="accordion__module">
                  <strong>{m.name}</strong>
                  <ul>
                    {m.contents.map((x) => (
                      <li key={`${m.name}-${x.title}`}>
                        {t(`curriculum.types.${x.type}`)}: {x.title}{' '}
                        {x.previewUrl && <a href={x.previewUrl.startsWith('/api') ? fileUrl(x.previewUrl) : x.previewUrl} target="_blank" rel="noreferrer">{t('courseDetails.preview')}</a>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </details>
          ))}
        </Card>
      </div>
      <aside className="course-details__side stack">
        <Card accent>
          {c.feeDisplay && <p className="course-details__fee">{c.feeDisplay}</p>}
          <p className="muted">{t('courseDetails.noPayment')}</p>
          <div className="stack" style={{ gap: 'var(--space-2)' }}>
            <Button block onClick={() => setDemoOpen(true)}>{t('courseDetails.bookDemo')}</Button>
            <Link className="btn btn--compact btn--block" to={paths.enroll(c.slug)}><span className="btn__label">{t('courseDetails.enroll')}</span></Link>
          </div>
          {c.batches.length > 0 && (
            <>
              <h3 style={{ marginTop: 'var(--space-4)' }}>{t('courseDetails.batches')}</h3>
              <ul>{c.batches.map((b) => <li key={b.name}>{b.name}{b.timingText ? ` — ${b.timingText}` : ''} <span className="muted">({t('courseDetails.starts', { date: formatDate(b.startDate, i18n.language) })})</span></li>)}</ul>
            </>
          )}
        </Card>
        <Card title={t('courseDetails.teacher')}>
          <div className="row">
            {c.teacher.photoUrl && <img src={fileUrl(c.teacher.photoUrl)} alt="" className="avatar-sm" />}
            <div>
              <strong>{c.teacher.name}</strong>
              {c.teacher.experienceYears != null && <p className="muted" style={{ margin: 0 }}>{t('teacherRequests.years', { n: c.teacher.experienceYears })}</p>}
            </div>
          </div>
          {c.teacher.bio && <p>{c.teacher.bio.replace(/<[^>]+>/g, '')}</p>}
          {c.teacher.slug && <Link to={paths.teacher(c.teacher.slug)}>{t('courseDetails.moreFromTeacher')}</Link>}
        </Card>
      </aside>
      <Modal open={demoOpen} size="lg" title={t('courseDetails.bookDemoTitle', { course: c.title })} onClose={() => setDemoOpen(false)}>
        {demoOpen && <LiveDemoForm courseSlug={c.slug} />}
      </Modal>
    </div>
  );
}
