import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api/client';
import { Button, Card, EmptyState, Modal, PageHeader, Select, StatusBadge, useToast } from '../../../components';
import { QuestionForm } from './QuestionForm';
import { ImportPanel } from './ImportPanel';
import { useCourseModules } from './useCourseModules';

export default function QuestionBankPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [courseId, setCourseId] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);
  const { courses, modules } = useCourseModules(courseId);

  const key = ['teacher', 'questions', moduleId, difficulty, archived];
  const q = useQuery({
    queryKey: key,
    queryFn: () => api.get(`/teacher/modules/${moduleId}/questions`, { difficulty: difficulty || undefined, archived: archived ? 'true' : undefined }),
    enabled: !!moduleId,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['teacher', 'questions', moduleId] });
  const save = useMutation({
    mutationFn: (body) => (editing && editing.id ? api.put(`/teacher/questions/${editing.id}`, body) : api.post(`/teacher/modules/${moduleId}/questions`, body)),
    onSuccess: () => {
      toast.show({ message: t('questions.saved') });
      setEditing(null);
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id) => api.del(`/teacher/questions/${id}`),
    onSuccess: (r) => {
      toast.show({ message: r.data.archived ? t('questions.archived') : t('questions.deleted') });
      refresh();
    },
    onError: (e) => toast.show({ kind: 'error', message: e.message }),
  });

  return (
    <>
      <PageHeader
        title={t('nav.questionBank')}
        subtitle={t('questions.subtitle')}
        actions={moduleId && (
          <>
            <Button variant="secondary" onClick={() => setImporting(true)}>{t('import.open')}</Button>
            <Button onClick={() => setEditing({})}>{t('questions.add')}</Button>
          </>
        )}
      />
      <div className="filters">
        <Select label={t('nav.courses')} value={courseId} placeholder={t('questions.chooseCourse')} onChange={(e) => { setCourseId(e.target.value); setModuleId(''); }}
          options={courses.map((c) => ({ value: String(c.id), label: c.title }))} />
        <Select label={t('questions.module')} value={moduleId} placeholder={t('questions.chooseModule')} onChange={(e) => setModuleId(e.target.value)}
          options={modules.map((m) => ({ value: String(m.id), label: m.label }))} disabled={!courseId} />
        <Select label={t('questions.difficulty')} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
          options={[{ value: '', label: t('common.all') }, ...['easy', 'medium', 'hard'].map((x) => ({ value: x, label: t(`questions.levels.${x}`) }))]} />
        <Select label={t('common.status')} value={archived ? 'archived' : 'active'} onChange={(e) => setArchived(e.target.value === 'archived')}
          options={[{ value: 'active', label: t('status.active') }, { value: 'archived', label: t('status.archived') }]} />
      </div>
      {!moduleId && <EmptyState title={t('questions.pickModule')} />}
      {moduleId && q.data && q.data.data.length === 0 && <EmptyState title={t('questions.empty')} action={{ label: t('questions.add'), onClick: () => setEditing({}) }} />}
      <div className="stack">
        {q.data?.data.map((x, i) => (
          <Card key={x.id}>
            <div className="row row--between">
              <span className="row">
                <strong>{i + 1}.</strong>
                <span className="badge badge--neutral">{t(`questions.types.${x.type}`)}</span>
                <span className="badge badge--neutral">{t(`questions.levels.${x.difficulty}`)}</span>
                <span className="muted">{t('questions.marksShort', { marks: x.marks, neg: x.negativeMarks })}</span>
                {x.isArchived && <StatusBadge status="archived" />}
              </span>
              {!x.isArchived && (
                <span className="row">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(x)}>{t('common.edit')}</Button>
                  <Button variant="ghost" size="sm" onClick={() => remove.mutate(x.id)}>{t('common.delete')}</Button>
                </span>
              )}
            </div>
            <p>{x.text}</p>
            {x.options.length > 0 && (
              <ul>{x.options.map((o) => <li key={o.id}>{o.isCorrect ? <strong>✓ {o.text}</strong> : o.text}</li>)}</ul>
            )}
            {x.acceptedAnswers.length > 0 && <p className="muted">{t('questions.acceptedShort', { list: x.acceptedAnswers.join(', ') })}</p>}
          </Card>
        ))}
      </div>
      <Modal open={!!editing} size="lg" title={editing && editing.id ? t('questions.edit') : t('questions.add')} onClose={() => setEditing(null)}>
        {editing && (
          <>
            {editing.id && <p className="muted">{t('questions.versionNote')}</p>}
            <QuestionForm
              initial={editing.id ? editing : null}
              saving={save.isPending}
              serverErrors={save.error?.details?.errors || (save.error ? [save.error.message] : null)}
              onSave={(body) => save.mutate(body)}
              onCancel={() => setEditing(null)}
            />
          </>
        )}
      </Modal>
      <Modal open={importing} size="lg" title={t('import.title')} onClose={() => setImporting(false)}>
        {importing && <ImportPanel moduleId={moduleId} onDone={refresh} />}
      </Modal>
    </>
  );
}
