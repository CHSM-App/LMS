import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api/client';
import { Button, Card, Checkbox, EmptyState, Input, Modal, Select, Spinner, Textarea, useToast, FileUpload, LiveStageBadge } from '../../../components';
import { uploadSmall } from '../../../utils/upload';
import { VideoSourceField } from './VideoSourceField';
import { LiveLessonFields, emptyLive, liveBody } from './LiveLessonFields';
import { RecordingModal } from './RecordingModal';
import { formatDateTime } from '../../../utils/format';

const swap = (list, i, j) => {
  const next = list.map((x) => x.id);
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

function MoveButtons({ name, index, count, onMove }) {
  const { t } = useTranslation();
  return (
    <span className="row" style={{ gap: 2 }}>
      <button type="button" className="icon-btn" disabled={index === 0} aria-label={t('curriculum.moveUp', { name })} onClick={() => onMove(index, index - 1)}>↑</button>
      <button type="button" className="icon-btn" disabled={index === count - 1} aria-label={t('curriculum.moveDown', { name })} onClick={() => onMove(index, index + 1)}>↓</button>
    </span>
  );
}

function NameDialog({ title, initial = '', withDescription, onSave, onClose, saving, error }) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial.name || '');
  const [description, setDescription] = useState(initial.description || '');
  const [local, setLocal] = useState('');
  const submit = () => {
    if (!name.trim()) return setLocal(t('validation.required'));
    return onSave({ name: name.trim(), description: description.trim() || null });
  };
  return (
    <Modal open title={title} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={saving} onClick={submit}>{t('common.save')}</Button></>}>
      <Input label={t('common.name')} value={name} onChange={(e) => setName(e.target.value)} error={local || error} required autoFocus />
      {withDescription && <Textarea label={`${t('curriculum.description')} (${t('common.optional')})`} value={description} onChange={(e) => setDescription(e.target.value)} />}
    </Modal>
  );
}

function ContentDialog({ courseId, initial, onSave, onClose, saving, error }) {
  const { t } = useTranslation();
  const [live, setLive] = useState(() => emptyLive(initial));
  const [f, setF] = useState(() => ({
    title: initial?.title || '',
    type: initial?.type || 'video',
    video: initial?.type === 'video' ? (initial.videoSource === 'upload' ? { source: 'upload', fileKey: initial.fileKey, url: initial.url } : { source: initial.videoSource, url: initial.url }) : null,
    url: initial?.type === 'link' ? initial.url : '',
    fileKey: initial?.type === 'pdf' ? initial.fileKey : null,
    isFreePreview: !!initial?.isFreePreview,
  }));
  const [local, setLocal] = useState('');
  const [pdfError, setPdfError] = useState('');
  const submit = () => {
    if (!f.title.trim()) return setLocal(t('validation.required'));
    if (f.type === 'live') {
      const lb = liveBody(live);
      if (!lb) return setLocal(t('validation.required'));
      return onSave({ title: f.title.trim(), type: 'live', ...lb });
    }
    const body = { title: f.title.trim(), type: f.type, isFreePreview: f.isFreePreview };
    if (f.type === 'video') {
      if (!f.video) return setLocal(t('curriculum.needVideo'));
      Object.assign(body, f.video.source === 'upload' ? { videoSource: 'upload', fileKey: f.video.fileKey } : { videoSource: f.video.source, url: f.video.url });
    }
    if (f.type === 'pdf') {
      if (!f.fileKey) return setLocal(t('curriculum.needPdf'));
      body.fileKey = f.fileKey;
    }
    if (f.type === 'link') body.url = f.url;
    return onSave(body);
  };
  const onPdf = async (file) => {
    setPdfError('');
    try {
      setF((x) => ({ ...x, fileKey: null }));
      const r = await uploadSmall('pdf', file);
      setF((x) => ({ ...x, fileKey: r.key }));
    } catch (e) {
      setPdfError(e.message);
    }
  };
  return (
    <Modal open size="lg" title={initial ? t('curriculum.editContent') : t('curriculum.addContent')} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button loading={saving} onClick={submit}>{t('common.save')}</Button></>}>
      <Input label={t('curriculum.contentTitle')} value={f.title} onChange={(e) => setF((x) => ({ ...x, title: e.target.value }))} required autoFocus />
      {/* A live lesson stays live (the API refuses switching), so its type is fixed when editing. */}
      <Select label={t('curriculum.type')} value={f.type} onChange={(e) => setF((x) => ({ ...x, type: e.target.value }))}
        disabled={!!initial && initial.type === 'live'}
        options={[
          { value: 'video', label: t('curriculum.types.video') }, { value: 'pdf', label: t('curriculum.types.pdf') },
          { value: 'link', label: t('curriculum.types.link') },
          ...(!initial || initial.type === 'live' ? [{ value: 'live', label: t('curriculum.types.live') }] : []),
        ]} />
      {f.type === 'live' && <LiveLessonFields courseId={courseId} value={live} onChange={setLive} />}
      {f.type === 'video' && <VideoSourceField label={t('curriculum.types.video')} kind="video" value={f.video} onChange={(v) => setF((x) => ({ ...x, video: v }))} required />}
      {f.type === 'pdf' && (
        <FileUpload label={t('curriculum.pdfFile')} accept="application/pdf" maxMb={20} onFile={onPdf} error={pdfError} hint={f.fileKey ? t('curriculum.pdfReady') : t('curriculum.pdfHint')} required />
      )}
      {f.type === 'link' && <Input label={t('curriculum.linkUrl')} type="url" value={f.url} onChange={(e) => setF((x) => ({ ...x, url: e.target.value }))} placeholder="https://" required />}
      {f.type !== 'live' && <Checkbox label={t('curriculum.freePreview')} checked={f.isFreePreview} onChange={(e) => setF((x) => ({ ...x, isFreePreview: e.target.checked }))} />}
      {(local || error) && <p className="field__error" role="alert">{local || error}</p>}
    </Modal>
  );
}

export function CurriculumTab({ courseId }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [dialog, setDialog] = useState(null);
  const key = ['teacher', 'curriculum', courseId];
  const q = useQuery({ queryKey: key, queryFn: () => api.get(`/teacher/courses/${courseId}/curriculum`) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['teacher', 'course'] });
  };
  const run = useMutation({
    mutationFn: ({ method, path, body }) => api[method](path, body),
    onSuccess: () => {
      setDialog(null);
      refresh();
    },
    onError: (e) => toast.show({ kind: 'error', message: e.message }),
  });
  const save = (method, path) => (body) => run.mutate({ method, path, body });

  if (q.isLoading) return <Spinner label={t('common.loading')} />;
  if (q.error) return <EmptyState title={q.error.message} action={{ label: t('common.retry'), onClick: q.refetch }} />;
  const { subjects } = q.data.data;

  return (
    <div className="stack">
      <div className="row"><Button variant="compact" onClick={() => setDialog({ kind: 'subject' })}>{t('curriculum.addSubject')}</Button></div>
      {subjects.length === 0 && <EmptyState title={t('curriculum.empty')} body={t('curriculum.emptyBody')} />}
      {subjects.map((s, si) => (
        <Card
          key={s.id}
          title={s.name}
          actions={
            <>
              <MoveButtons name={s.name} index={si} count={subjects.length} onMove={(i, j) => run.mutate({ method: 'put', path: `/teacher/courses/${courseId}/subjects/order`, body: { subjectIds: swap(subjects, i, j) } })} />
              <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: 'subject', item: s })}>{t('common.edit')}</Button>
              <Button variant="ghost" size="sm" onClick={() => run.mutate({ method: 'del', path: `/teacher/subjects/${s.id}` })}>{t('common.delete')}</Button>
            </>
          }
        >
          {s.description && <p className="muted">{s.description}</p>}
          <ol className="curriculum">
            {s.modules.map((m, mi) => (
              <li key={m.id} className="curriculum__module">
                <div className="row row--between">
                  <strong>{m.name}</strong>
                  <span className="row">
                    <MoveButtons name={m.name} index={mi} count={s.modules.length} onMove={(i, j) => run.mutate({ method: 'put', path: `/teacher/subjects/${s.id}/modules/order`, body: { moduleIds: swap(s.modules, i, j) } })} />
                    <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: 'module', item: m, subjectId: s.id })}>{t('common.edit')}</Button>
                    <Button variant="ghost" size="sm" onClick={() => run.mutate({ method: 'del', path: `/teacher/modules/${m.id}` })}>{t('common.delete')}</Button>
                  </span>
                </div>
                <ul className="curriculum__contents">
                  {m.contents.map((c, ci) => (
                    <li key={c.id} className="row row--between">
                      <span>
                        <span className="badge badge--neutral">{t(`curriculum.types.${c.type}`)}</span> {c.title}
                        {c.isFreePreview && <span className="muted"> · {t('curriculum.free')}</span>}
                        {c.live && (
                          <>
                            {' '}<LiveStageBadge stage={c.live.stage} />
                            <span className="muted"> · {formatDateTime(c.live.startsAt, i18n.language)} · {c.live.batch ? c.live.batch.name : t('content.live.allBatches')}</span>
                          </>
                        )}
                      </span>
                      <span className="row">
                        {c.type === 'live' && (c.recording
                          ? <Button variant="ghost" size="sm" onClick={() => run.mutate({ method: 'del', path: `/teacher/contents/${c.id}/recording` })}>{t('content.live.removeRecording')}</Button>
                          : <Button variant="compact" size="sm" onClick={() => setDialog({ kind: 'recording', item: c })}>{t('content.live.addRecording')}</Button>)}
                        <MoveButtons name={c.title} index={ci} count={m.contents.length} onMove={(i, j) => run.mutate({ method: 'put', path: `/teacher/modules/${m.id}/contents/order`, body: { contentIds: swap(m.contents, i, j) } })} />
                        <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: 'content', item: c, moduleId: m.id })}>{t('common.edit')}</Button>
                        <Button variant="ghost" size="sm" onClick={() => run.mutate({ method: 'del', path: `/teacher/contents/${c.id}` })}>{t('common.delete')}</Button>
                      </span>
                    </li>
                  ))}
                </ul>
                <Button variant="compact" size="sm" onClick={() => setDialog({ kind: 'content', moduleId: m.id })}>{t('curriculum.addContent')}</Button>
              </li>
            ))}
          </ol>
          <Button variant="compact" size="sm" onClick={() => setDialog({ kind: 'module', subjectId: s.id })}>{t('curriculum.addModule')}</Button>
        </Card>
      ))}

      {dialog?.kind === 'subject' && (
        <NameDialog
          withDescription
          title={dialog.item ? t('curriculum.editSubject') : t('curriculum.addSubject')}
          initial={dialog.item}
          saving={run.isPending}
          onClose={() => setDialog(null)}
          onSave={dialog.item ? save('put', `/teacher/subjects/${dialog.item.id}`) : save('post', `/teacher/courses/${courseId}/subjects`)}
        />
      )}
      {dialog?.kind === 'module' && (
        <NameDialog
          title={dialog.item ? t('curriculum.editModule') : t('curriculum.addModule')}
          initial={dialog.item}
          saving={run.isPending}
          onClose={() => setDialog(null)}
          onSave={dialog.item ? save('put', `/teacher/modules/${dialog.item.id}`) : save('post', `/teacher/subjects/${dialog.subjectId}/modules`)}
        />
      )}
      {dialog?.kind === 'content' && (
        <ContentDialog
          courseId={courseId}
          initial={dialog.item}
          saving={run.isPending}
          onClose={() => setDialog(null)}
          onSave={dialog.item ? save('put', `/teacher/contents/${dialog.item.id}`) : save('post', `/teacher/modules/${dialog.moduleId}/contents`)}
        />
      )}
      {dialog?.kind === 'recording' && (
        <RecordingModal lesson={dialog.item} saving={run.isPending} onClose={() => setDialog(null)} onSave={save('put', `/teacher/contents/${dialog.item.id}/recording`)} />
      )}
    </div>
  );
}
