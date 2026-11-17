import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, fileUrl } from '../../../api/client';
import { Button, Card, EmptyState, FileUpload, Input, Modal, PageHeader, Select, Spinner, StatusBadge, Table, Textarea, useToast } from '../../../components';
import { formatDateTime } from '../../../utils/format';
import { uploadSmall } from '../../../utils/upload';
import { useCourseModules } from '../exams/useCourseModules';

export function DoubtsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState('open');
  const [replying, setReplying] = useState(null);
  const [reply, setReply] = useState('');
  const q = useQuery({ queryKey: ['teacher', 'doubts', status], queryFn: () => api.get('/teacher/doubts', { status: status || undefined }) });
  const send = useMutation({
    mutationFn: () => api.post(`/teacher/doubts/${replying.id}/reply`, { reply }),
    onSuccess: () => {
      toast.show({ message: t('doubts.replied') });
      setReplying(null);
      setReply('');
      qc.invalidateQueries({ queryKey: ['teacher'] });
    },
    onError: (e) => toast.show({ kind: 'error', message: e.message }),
  });
  return (
    <>
      <PageHeader title={t('nav.doubts')} subtitle={t('doubts.subtitle')} />
      <div className="filters">
        <Select label={t('common.status')} value={status} onChange={(e) => setStatus(e.target.value)}
          options={['', 'open', 'answered', 'closed'].map((s) => ({ value: s, label: s ? t(`status.${s}`) : t('common.all') }))} />
      </div>
      {q.isLoading && <Spinner label={t('common.loading')} />}
      {q.data && q.data.data.length === 0 && <EmptyState title={t('doubts.empty')} />}
      <div className="stack">
        {q.data?.data.map((d) => (
          <Card key={d.id}>
            <div className="row row--between">
              <strong>{d.student.name}</strong>
              <span className="row"><span className="muted">{d.course.title} · {formatDateTime(d.createdAt, i18n.language)}</span><StatusBadge status={d.status} /></span>
            </div>
            <p>{d.question}</p>
            {d.attachmentUrl && <p><a href={fileUrl(d.attachmentUrl)} target="_blank" rel="noreferrer">{t('doubts.attachment')}</a></p>}
            {d.reply && <blockquote className="reply">{d.reply}</blockquote>}
            {d.status !== 'closed' && (
              <div className="row">
                <Button variant="compact" size="sm" onClick={() => { setReplying(d); setReply(d.reply || ''); }}>{d.reply ? t('doubts.editReply') : t('doubts.reply')}</Button>
              </div>
            )}
          </Card>
        ))}
      </div>
      <Modal open={!!replying} title={t('doubts.replyTo', { name: replying?.student.name })} onClose={() => setReplying(null)}
        footer={<><Button variant="secondary" onClick={() => setReplying(null)}>{t('common.cancel')}</Button><Button loading={send.isPending} disabled={!reply.trim()} onClick={() => send.mutate()}>{t('doubts.sendReply')}</Button></>}>
        {replying && <p className="muted">{replying.question}</p>}
        <Textarea label={t('doubts.yourReply')} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={2000} rows={5} required />
      </Modal>
    </>
  );
}

export function ProgramsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const { courses } = useCourseModules('');
  const [dialog, setDialog] = useState(null);
  const list = useQuery({ queryKey: ['teacher', 'programs'], queryFn: () => api.get('/teacher/programs') });
  const del = useMutation({ mutationFn: (id) => api.del(`/teacher/programs/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['teacher', 'programs'] }) });
  return (
    <>
      <PageHeader title={t('nav.programs')} subtitle={t('programs.subtitle')} actions={<Button onClick={() => setDialog({})}>{t('programs.add')}</Button>} />
      <Table
        rows={list.data?.data}
        loading={list.isLoading}
        error={list.error?.message}
        empty={t('programs.empty')}
        columns={[
          { key: 'title', header: t('programs.title') },
          { key: 'startsAt', header: t('requests.when'), render: (p) => formatDateTime(p.startsAt, i18n.language) },
          { key: 'course', header: t('nav.courses'), render: (p) => (p.course ? p.course.title : '—') },
          { key: 'batch', header: t('nav.batches'), render: (p) => (p.batch ? p.batch.name : t('liveClasses.allBatches')) },
          { key: 'a', header: t('common.actions'), render: (p) => (
            <div className="row">
              <Button variant="ghost" size="sm" onClick={() => setDialog({ item: p })}>{t('common.edit')}</Button>
              <Button variant="ghost" size="sm" onClick={() => del.mutate(p.id)}>{t('common.delete')}</Button>
            </div>
          ) },
        ]}
      />
      {dialog && <ProgramDialog item={dialog.item} courses={courses} onClose={() => setDialog(null)} onDone={() => { setDialog(null); toast.show({ message: t('common.saved') }); qc.invalidateQueries({ queryKey: ['teacher', 'programs'] }); }} />}
    </>
  );
}

function ProgramDialog({ item, courses, onClose, onDone }) {
  const { t } = useTranslation();
  const toLocal = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
  const [f, setF] = useState({ title: item?.title || '', startsAt: toLocal(item?.startsAt), courseId: item?.course ? String(item.course.id) : '', batchId: item?.batch ? String(item.batch.id) : '' });
  const [error, setError] = useState('');
  const batches = useQuery({ queryKey: ['teacher', 'batches', Number(f.courseId)], queryFn: () => api.get(`/teacher/courses/${f.courseId}/batches`), enabled: !!f.courseId });
  const m = useMutation({
    mutationFn: () => {
      const body = { title: f.title.trim(), startsAt: new Date(f.startsAt).toISOString(), courseId: f.courseId ? Number(f.courseId) : null, batchId: f.batchId ? Number(f.batchId) : null };
      return item ? api.put(`/teacher/programs/${item.id}`, body) : api.post('/teacher/programs', body);
    },
    onSuccess: onDone,
    onError: (e) => setError(e.message),
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal open title={item ? t('programs.edit') : t('programs.add')} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={m.isPending} onClick={() => (f.title.trim() && f.startsAt ? m.mutate() : setError(t('validation.required')))}>{t('common.save')}</Button></>}>
      <Input label={t('programs.title')} value={f.title} onChange={set('title')} required />
      <Input label={t('requests.when')} type="datetime-local" value={f.startsAt} onChange={set('startsAt')} required />
      <Select label={`${t('nav.courses')} (${t('common.optional')})`} value={f.courseId} onChange={(e) => setF((x) => ({ ...x, courseId: e.target.value, batchId: '' }))}
        options={[{ value: '', label: '—' }, ...courses.map((c) => ({ value: String(c.id), label: c.title }))]} />
      <Select label={t('nav.batches')} value={f.batchId} onChange={set('batchId')} disabled={!f.courseId}
        options={[{ value: '', label: t('liveClasses.allBatches') }, ...(batches.data?.data || []).map((b) => ({ value: String(b.id), label: b.name }))]} />
      {error && <p className="field__error" role="alert">{error}</p>}
    </Modal>
  );
}

const SOCIAL = ['website', 'youtube', 'facebook', 'instagram', 'linkedin'];

export function ProfilePage() {
  const { t } = useTranslation();
  const toast = useToast();
  const q = useQuery({ queryKey: ['teacher', 'profile'], queryFn: () => api.get('/teacher/profile') });
  const [f, setF] = useState(null);
  const [photoError, setPhotoError] = useState('');
  useEffect(() => {
    if (q.data && !f) setF({ ...q.data.data, socialLinks: q.data.data.socialLinks || {} });
  }, [q.data, f]);
  const save = useMutation({
    mutationFn: () => api.put('/teacher/profile', { ...f, experienceYears: f.experienceYears === '' ? null : f.experienceYears }),
    onSuccess: () => toast.show({ message: t('common.saved') }),
    onError: (e) => toast.show({ kind: 'error', message: e.message }),
  });
  if (!f) return <Spinner label={t('common.loading')} />;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const onPhoto = async (file) => {
    setPhotoError('');
    try {
      const r = await uploadSmall('photo', file);
      setF((x) => ({ ...x, photoKey: r.key, photoUrl: r.url }));
    } catch (e) {
      setPhotoError(e.message);
    }
  };
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); save.mutate(); }} noValidate>
      <PageHeader title={t('nav.profile')} subtitle={t('profile.subtitle')}
        actions={f.publicSlug && <Link to={`/teachers/${f.publicSlug}`} target="_blank">{t('profile.view')}</Link>} />
      <Card title={t('profile.about')}>
        <div className="grid grid--2">
          <Input label={t('common.name')} value={f.name} onChange={set('name')} required />
          <Input label={t('common.email')} type="email" value={f.email || ''} onChange={set('email')} />
          <Input label={t('profile.subjects')} value={f.subjects || ''} onChange={set('subjects')} hint={t('profile.subjectsHint')} />
          <Input label={t('teacherReg.experience')} type="number" min="0" max="60" value={f.experienceYears ?? ''} onChange={set('experienceYears')} />
          <Input label={t('teacherReg.qualification')} value={f.qualification || ''} onChange={set('qualification')} />
          <Input label={t('profile.languages')} value={f.languages || ''} onChange={set('languages')} hint={t('profile.languagesHint')} />
        </div>
        <Textarea label={t('profile.bio')} value={f.bio || ''} onChange={set('bio')} rows={5} />
        {f.photoUrl && <img src={fileUrl(f.photoUrl)} alt="" className="avatar-lg" />}
        <FileUpload label={t('teacherReg.photo')} accept="image/jpeg,image/png,image/webp" maxMb={5} onFile={onPhoto} error={photoError} />
      </Card>
      <Card title={t('profile.publicPage')}>
        <Input label={t('profile.slug')} value={f.publicSlug || ''} onChange={set('publicSlug')} hint={t('profile.slugHint')} />
        <Input label={t('profile.introVideo')} value={f.introVideoUrl || ''} onChange={set('introVideoUrl')} placeholder="https://" />
        <div className="grid grid--2">
          {SOCIAL.map((k) => (
            <Input key={k} label={t(`profile.social.${k}`)} value={f.socialLinks[k] || ''} placeholder="https://"
              onChange={(e) => setF((x) => ({ ...x, socialLinks: { ...x.socialLinks, [k]: e.target.value } }))} />
          ))}
        </div>
      </Card>
      <div className="row"><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></div>
    </form>
  );
}
