import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, fileUrl } from '../../../api/client';
import { BackLink, Banner, Button, Card, EmptyState, FileUpload, Input, Modal, PageHeader, Select, Spinner, StatusBadge, Textarea, useToast } from '../../../components';
import { uploadSmall } from '../../../utils/upload';
import { VideoSourceField } from './VideoSourceField';
import { CurriculumTab } from './CurriculumTab';
import { BatchesTab } from './BatchesTab';
import { LANGUAGE_OPTIONS } from './CoursesPage';
import { toCourseInput } from './courseInput';

function DetailsTab({ course, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [f, setF] = useState(() => ({
    title: course.title,
    subject: course.subject,
    language: course.language,
    description: course.description,
    durationText: course.durationText || '',
    feeDisplay: course.feeDisplay || '',
    thumbnailKey: course.thumbnailKey,
    thumbnailUrl: course.thumbnailUrl,
    demoVideo1: course.demoVideo1,
    demoVideo2: course.demoVideo2,
  }));
  const [thumbError, setThumbError] = useState('');
  const save = useMutation({
    mutationFn: () => api.put(`/teacher/courses/${course.id}`, toCourseInput(f)),
    onSuccess: () => {
      toast.show({ message: t('common.saved') });
      onSaved();
    },
    onError: (e) => toast.show({ kind: 'error', message: e.message }),
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const onThumb = async (file) => {
    setThumbError('');
    try {
      const r = await uploadSmall('thumbnail', file);
      setF((x) => ({ ...x, thumbnailKey: r.key, thumbnailUrl: r.url }));
    } catch (e) {
      setThumbError(e.message);
    }
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="stack" noValidate>
      <Card title={t('courses.basics')}>
        <div className="grid grid--2">
          <Input label={t('courses.title')} value={f.title} onChange={set('title')} required />
          <Input label={t('courses.subject')} value={f.subject} onChange={set('subject')} required />
          <Select label={t('courses.language')} value={f.language} onChange={set('language')} options={LANGUAGE_OPTIONS(t)} required />
          <Input label={`${t('courses.duration')} (${t('common.optional')})`} value={f.durationText} onChange={set('durationText')} hint={t('courses.durationHint')} />
          <Input label={`${t('courses.fee')} (${t('common.optional')})`} value={f.feeDisplay} onChange={set('feeDisplay')} hint={t('courses.feeHint')} />
        </div>
        <Textarea label={t('courses.description')} value={f.description} onChange={set('description')} rows={8} required />
      </Card>
      <Card title={t('courses.thumbnail')}>
        {f.thumbnailUrl && <img src={fileUrl(f.thumbnailUrl)} alt={t('courses.thumbnail')} className="thumb-lg" />}
        <FileUpload label={`${t('courses.thumbnailUpload')} (${t('common.optional')})`} accept="image/jpeg,image/png,image/webp" maxMb={5} onFile={onThumb} error={thumbError} hint={t('courses.thumbnailHint')} />
      </Card>
      <Card title={t('courses.demoVideos')}>
        <p className="muted">{t('courses.demoVideosHint')}</p>
        <div className="grid grid--2">
          <VideoSourceField label={t('courses.demo1')} kind="demo_video" value={f.demoVideo1} onChange={(v) => setF((x) => ({ ...x, demoVideo1: v }))} required />
          <VideoSourceField label={`${t('courses.demo2')} (${t('common.optional')})`} kind="demo_video" value={f.demoVideo2} onChange={(v) => setF((x) => ({ ...x, demoVideo2: v }))} />
        </div>
      </Card>
      <div className="row"><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></div>
    </form>
  );
}

const MISSING_KEYS = ['title', 'description', 'demo_video_1', 'content'];

export default function CourseEditorPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState('details');
  const [missing, setMissing] = useState(null);
  const [copying, setCopying] = useState(false);
  const q = useQuery({ queryKey: ['teacher', 'course', courseId], queryFn: () => api.get(`/teacher/courses/${courseId}`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['teacher'] });

  useEffect(() => setMissing(null), [courseId]);

  const status = useMutation({
    mutationFn: (next) => api.post(`/teacher/courses/${courseId}/status`, { status: next }),
    onSuccess: (r) => {
      setMissing(null);
      toast.show({ message: r.data.status === 'published' ? t('courses.published') : t('courses.unpublished') });
      refresh();
    },
    onError: (e) => {
      if (e.code === 'NOT_READY') setMissing(e.details.missing);
      else toast.show({ kind: 'error', message: e.message });
    },
  });

  const duplicate = useMutation({
    mutationFn: () => api.post(`/teacher/courses/${courseId}/duplicate`, {}),
    onSuccess: (r) => {
      setCopying(false);
      toast.show({ message: t('courses.duplicated') });
      refresh();
      navigate(`/teacher/courses/${r.data.id}`);
    },
    onError: (e) => toast.show({ kind: 'error', message: e.message }),
  });

  if (q.isLoading) return <Spinner label={t('common.loading')} />;
  if (q.error) return <EmptyState title={q.error.message} action={{ label: t('common.retry'), onClick: q.refetch }} />;
  const course = q.data.data;
  const published = course.status === 'published';
  const tabs = [
    ['details', t('courses.tabs.details')],
    ['curriculum', t('courses.tabs.curriculum')],
    ['batches', t('courses.tabs.batches')],
  ];

  return (
    <>
      <p><BackLink to="/teacher/courses">{t('courses.back')}</BackLink></p>
      <PageHeader
        title={course.title}
        subtitle={<StatusBadge status={course.status} />}
        actions={
          <>
            <Button variant="secondary" onClick={() => setCopying(true)}>{t('courses.duplicate')}</Button>
            {published ? (
              <Button variant="secondary" loading={status.isPending} onClick={() => status.mutate('draft')}>{t('courses.unpublish')}</Button>
            ) : (
              <Button loading={status.isPending} onClick={() => status.mutate('published')}>{t('courses.publish')}</Button>
            )}
          </>
        }
      />
      {copying && (
        <Modal open title={t('courses.duplicate')} onClose={() => setCopying(false)}
          footer={<><Button variant="secondary" onClick={() => setCopying(false)}>{t('common.cancel')}</Button><Button loading={duplicate.isPending} onClick={() => duplicate.mutate()}>{t('courses.duplicate')}</Button></>}>
          <p>{t('courses.duplicateBody')}</p>
        </Modal>
      )}
      {missing && (
        <div role="alert" className="banner banner--warning">
          <div>
            <p className="banner__message"><strong>{t('courses.notReady')}</strong></p>
            <ul>{missing.filter((m) => MISSING_KEYS.includes(m)).map((m) => <li key={m}>{t(`courses.missing.${m}`)}</li>)}</ul>
          </div>
        </div>
      )}
      {published && <Banner kind="success" message={t('courses.liveNote')} />}
      <div className="tabs" role="tablist">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" role="tab" className="tabs__tab" aria-selected={tab === key} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'details' && <DetailsTab key={course.id} course={course} onSaved={refresh} />}
        {tab === 'curriculum' && <CurriculumTab courseId={course.id} />}
        {tab === 'batches' && <BatchesTab courseId={course.id} />}
      </div>
    </>
  );
}
