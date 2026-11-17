import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api/client';
import { Button, Card, Checkbox, EmptyState, Input, PageHeader, Select, Spinner, StatusBadge, useToast } from '../../../components';

const DEFAULTS = {
  title: '', scope: 'module', moduleIds: [], mode: 'mock', selection: 'random', randomMix: [], questionIds: [], category: 'unit_test_1',
  weightage: 20, totalMarks: '', negativeMarking: false, timeLimitMin: 30, passingPct: 40, shuffleQuestions: true, shuffleOptions: true,
  attemptLimit: 1, startsAt: '', endsAt: '', batchIds: [],
};

const toLocalInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

function fromExam(e) {
  return { ...DEFAULTS, ...e, totalMarks: e.totalMarks ?? '', timeLimitMin: e.timeLimitMin ?? '', passingPct: e.passingPct ?? '', attemptLimit: e.attemptLimit ?? '', startsAt: toLocalInput(e.startsAt), endsAt: toLocalInput(e.endsAt) };
}

function toBody(f) {
  const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
  return {
    title: f.title, scope: f.scope, moduleIds: f.moduleIds, mode: f.mode, selection: f.selection, randomMix: f.randomMix, questionIds: f.questionIds,
    category: f.category, weightage: Number(f.weightage || 0), totalMarks: num(f.totalMarks), negativeMarking: f.negativeMarking,
    timeLimitMin: num(f.timeLimitMin), passingPct: num(f.passingPct), shuffleQuestions: f.shuffleQuestions, shuffleOptions: f.shuffleOptions,
    attemptLimit: num(f.attemptLimit), startsAt: fromLocalInput(f.startsAt), endsAt: fromLocalInput(f.endsAt), batchIds: f.batchIds,
  };
}

function Section({ n, title, children }) {
  return (
    <Card title={`${n}. ${title}`}>
      {children}
    </Card>
  );
}

export default function ExamBuilderPage() {
  const { examId } = useParams();
  const [params] = useSearchParams();
  const isNew = !examId;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [problems, setProblems] = useState(null);

  const examQ = useQuery({ queryKey: ['teacher', 'exam', examId], queryFn: () => api.get(`/teacher/exams/${examId}`), enabled: !isNew });
  const courseId = isNew ? Number(params.get('course')) : examQ.data?.data.courseId;

  useEffect(() => {
    if (isNew && !f) setF({ ...DEFAULTS });
    if (!isNew && examQ.data && !f) setF(fromExam(examQ.data.data));
  }, [isNew, examQ.data, f]);

  const tree = useQuery({ queryKey: ['teacher', 'curriculum', courseId], queryFn: () => api.get(`/teacher/courses/${courseId}/curriculum`), enabled: !!courseId });
  const batches = useQuery({ queryKey: ['teacher', 'batches', courseId], queryFn: () => api.get(`/teacher/courses/${courseId}/batches`), enabled: !!courseId });
  const modules = useMemo(
    () => (tree.data?.data.subjects || []).flatMap((s) => s.modules.map((m) => ({ id: m.id, label: `${s.name} › ${m.name}` }))),
    [tree.data],
  );
  const selectedModules = f ? (f.scope === 'course' ? modules.map((m) => m.id) : f.moduleIds) : [];
  const countQs = useQueries({
    queries: selectedModules.map((id) => ({ queryKey: ['teacher', 'qcount', id], queryFn: () => api.get(`/teacher/modules/${id}/question-counts`) })),
  });
  const bankQs = useQueries({
    queries: f && f.selection === 'manual' ? selectedModules.map((id) => ({ queryKey: ['teacher', 'questions', String(id), '', false], queryFn: () => api.get(`/teacher/modules/${id}/questions`) })) : [],
  });

  const validate = useMutation({
    mutationFn: () => api.post(`/teacher/exams/${examId}/validate`),
    onSuccess: (r) => setProblems(r.data),
  });
  useEffect(() => {
    if (!isNew && examQ.data) validate.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, examQ.data]);

  const save = useMutation({
    mutationFn: () => (isNew ? api.post(`/teacher/courses/${courseId}/exams`, toBody(f)) : api.put(`/teacher/exams/${examId}`, toBody(f))),
    onSuccess: (r) => {
      toast.show({ message: t('examBuilder.saved') });
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['teacher', 'exams'] });
      if (isNew) navigate(`/teacher/exams/${r.data.id}`, { replace: true });
      else validate.mutate();
    },
    onError: (e) => toast.show({ kind: 'error', message: e.message }),
  });
  const publish = useMutation({
    mutationFn: () => api.post(`/teacher/exams/${examId}/publish`),
    onSuccess: () => {
      toast.show({ message: t('examBuilder.published') });
      qc.invalidateQueries({ queryKey: ['teacher'] });
      navigate('/teacher/exams');
    },
    onError: (e) => (e.details?.problems ? setProblems({ ok: false, problems: e.details.problems }) : toast.show({ kind: 'error', message: e.message })),
  });

  if ((!isNew && examQ.isLoading) || !f) return <Spinner label={t('common.loading')} />;
  if (examQ.error) return <EmptyState title={examQ.error.message} />;
  if (!courseId) return <EmptyState title={t('examBuilder.noCourse')} />;

  const update = (patch) => {
    setF((x) => ({ ...x, ...patch }));
    setDirty(true);
  };
  const set = (k) => (e) => update({ [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const locked = !isNew && examQ.data.data.status === 'published';
  const practice = f.mode === 'practice';
  const mixFor = (id) => f.randomMix.find((m) => m.moduleId === id) || { moduleId: id, easy: 0, medium: 0, hard: 0 };
  const setMix = (id, d, v) => update({ randomMix: [...f.randomMix.filter((m) => m.moduleId !== id), { ...mixFor(id), [d]: Number(v || 0) }] });
  const toggle = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <div className="stack">
      <p><Link to="/teacher/exams">{t('examBuilder.back')}</Link></p>
      <PageHeader
        title={isNew ? t('examBuilder.newTitle') : f.title || t('examBuilder.untitled')}
        subtitle={!isNew && <StatusBadge status={examQ.data.data.status} />}
        actions={
          <>
            {!locked && <Button variant="secondary" loading={save.isPending} onClick={() => save.mutate()}>{t('examBuilder.saveDraft')}</Button>}
            {!isNew && !locked && (
              <Button loading={publish.isPending} disabled={dirty || !problems || !problems.ok} onClick={() => publish.mutate()}>{t('examBuilder.publish')}</Button>
            )}
          </>
        }
      />
      {locked && <p className="muted">{t('examBuilder.lockedNote')}</p>}
      {dirty && !isNew && <p className="muted">{t('examBuilder.saveFirst')}</p>}
      {problems && !problems.ok && (
        <div role="alert" className="banner banner--warning">
          <div>
            <p className="banner__message"><strong>{t('examBuilder.problems')}</strong></p>
            <ul>{problems.problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        </div>
      )}
      <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }} className="stack">
        <Section n={1} title={t('examBuilder.scope')}>
          <Input label={t('examBuilder.title')} value={f.title} onChange={set('title')} required />
          <Select label={t('examBuilder.scopeLabel')} value={f.scope} onChange={(e) => update({ scope: e.target.value, moduleIds: [] })}
            options={['module', 'modules', 'course'].map((s) => ({ value: s, label: t(`examBuilder.scopes.${s}`) }))} />
          {f.scope !== 'course' && (
            <div className="stack" style={{ gap: 'var(--space-1)' }}>
              {modules.map((m) => (
                <Checkbox key={m.id} label={m.label} checked={f.moduleIds.includes(m.id)}
                  onChange={() => update({ moduleIds: f.scope === 'module' ? [m.id] : toggle(f.moduleIds, m.id) })} />
              ))}
            </div>
          )}
        </Section>
        <Section n={2} title={t('examBuilder.mode')}>
          <Select label={t('examBuilder.modeLabel')} value={f.mode}
            onChange={(e) => update(e.target.value === 'practice' ? { mode: 'practice', category: 'practice', weightage: 0, timeLimitMin: '', attemptLimit: '' } : { mode: 'mock', category: f.category === 'practice' ? 'unit_test_1' : f.category })}
            options={[{ value: 'mock', label: t('examBuilder.modes.mock') }, { value: 'practice', label: t('examBuilder.modes.practice') }]} />
          <p className="field__hint">{practice ? t('examBuilder.practiceHint') : t('examBuilder.mockHint')}</p>
        </Section>
        <Section n={3} title={t('examBuilder.questions')}>
          <Select label={t('examBuilder.selection')} value={f.selection} onChange={set('selection')}
            options={[{ value: 'random', label: t('examBuilder.selections.random') }, { value: 'manual', label: t('examBuilder.selections.manual') }]} />
          {f.selection === 'random' &&
            selectedModules.map((id, i) => {
              const have = countQs[i]?.data?.data;
              const label = (modules.find((m) => m.id === id) || {}).label;
              return (
                <div key={id} className="video-field">
                  <strong>{label}</strong>
                  {have && <p className="field__hint">{t('examBuilder.available', have)}</p>}
                  <div className="grid grid--3">
                    {['easy', 'medium', 'hard'].map((d) => (
                      <Input key={d} label={t(`questions.levels.${d}`)} type="number" min="0" value={mixFor(id)[d]} onChange={(e) => setMix(id, d, e.target.value)} />
                    ))}
                  </div>
                </div>
              );
            })}
          {f.selection === 'manual' && (
            <div className="stack" style={{ gap: 'var(--space-1)' }}>
              {bankQs.flatMap((bq) => bq.data?.data || []).map((q) => (
                <Checkbox key={q.id} label={`${q.text} (${q.marks})`} checked={f.questionIds.includes(q.id)} onChange={() => update({ questionIds: toggle(f.questionIds, q.id) })} />
              ))}
              <Input label={`${t('examBuilder.totalMarks')} (${t('common.optional')})`} type="number" value={f.totalMarks} onChange={set('totalMarks')} />
            </div>
          )}
        </Section>
        <Section n={4} title={t('examBuilder.category')}>
          <div className="grid grid--2">
            <Select label={t('examBuilder.categoryLabel')} value={f.category} disabled={practice} onChange={set('category')}
              options={['unit_test_1', 'unit_test_2', 'final', 'practice'].map((c) => ({ value: c, label: t(`examBuilder.categories.${c}`) }))} />
            <Input label={t('examBuilder.weightage')} type="number" min="0" max="100" value={f.weightage} disabled={practice} onChange={set('weightage')} hint={practice ? t('examBuilder.practiceWeight') : t('examBuilder.weightHint')} />
          </div>
        </Section>
        <Section n={5} title={t('examBuilder.batches')}>
          <p className="field__hint">{t('examBuilder.batchesHint')}</p>
          {(batches.data?.data || []).map((b) => (
            <Checkbox key={b.id} label={b.name} checked={f.batchIds.includes(b.id)} onChange={() => update({ batchIds: toggle(f.batchIds, b.id) })} />
          ))}
        </Section>
        <Section n={6} title={t('examBuilder.options')}>
          <div className="grid grid--2">
            {!practice && <Input label={t('examBuilder.timeLimit')} type="number" min="1" value={f.timeLimitMin} onChange={set('timeLimitMin')} />}
            {!practice && <Input label={t('examBuilder.passing')} type="number" min="0" max="100" value={f.passingPct} onChange={set('passingPct')} />}
            {!practice && <Input label={`${t('examBuilder.attempts')} (${t('common.optional')})`} type="number" min="1" value={f.attemptLimit} onChange={set('attemptLimit')} hint={t('examBuilder.attemptsHint')} />}
            <Input label={`${t('examBuilder.startsAt')} (${t('common.optional')})`} type="datetime-local" value={f.startsAt} onChange={set('startsAt')} />
            <Input label={`${t('examBuilder.endsAt')} (${t('common.optional')})`} type="datetime-local" value={f.endsAt} onChange={set('endsAt')} />
          </div>
          <Checkbox label={t('examBuilder.negative')} checked={f.negativeMarking} onChange={set('negativeMarking')} />
          <Checkbox label={t('examBuilder.shuffleQ')} checked={f.shuffleQuestions} onChange={set('shuffleQuestions')} />
          <Checkbox label={t('examBuilder.shuffleO')} checked={f.shuffleOptions} onChange={set('shuffleOptions')} />
        </Section>
      </fieldset>
    </div>
  );
}
