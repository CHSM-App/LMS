import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, fileUrl } from '../../api/client';
import { Card, EmptyState, Spinner } from '../../components';
import { CourseCard } from './CourseCard';

export default function TeacherPublicPage() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['public', 'teacher', slug], queryFn: () => api.get(`/public/teachers/${slug}`) });
  const d = q.data?.data;
  useEffect(() => {
    if (d) document.title = d.name;
  }, [d]);
  if (q.isLoading) return <Spinner label={t('common.loading')} />;
  if (q.error) return <EmptyState title={q.error.status === 404 ? t('teacherPage.notFound') : q.error.message} />;
  const social = Object.entries(d.socialLinks || {});
  return (
    <div className="container stack">
      <Card>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          {d.photoUrl && <img src={fileUrl(d.photoUrl)} alt="" className="avatar-lg" />}
          <div className="stack" style={{ gap: 'var(--space-1)' }}>
            <h1 style={{ margin: 0 }}>{d.name}</h1>
            <p className="muted" style={{ margin: 0 }}>
              {[d.subjects, d.experienceYears != null ? t('teacherRequests.years', { n: d.experienceYears }) : null, d.languages].filter(Boolean).join(' · ')}
            </p>
            {d.qualification && <p style={{ margin: 0 }}>{d.qualification}</p>}
          </div>
        </div>
        {d.bio && <p>{d.bio.replace(/<[^>]+>/g, '')}</p>}
        {social.length > 0 && <p className="row">{social.map(([k, url]) => <a key={k} href={url} target="_blank" rel="noreferrer noopener">{t(`profile.social.${k}`)}</a>)}</p>}
      </Card>
      <h2>{t('teacherPage.courses')}</h2>
      {d.courses.length === 0 ? <EmptyState title={t('teacherPage.noCourses')} /> : <div className="course-grid">{d.courses.map((c) => <CourseCard key={c.slug} course={c} />)}</div>}
    </div>
  );
}
