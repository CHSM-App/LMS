import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { Banner, Button, Card, EmptyState, Input, Modal, Spinner } from '../../components';

const fmt = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function Question({ q, index, value, onChange, feedback }) {
  const { t } = useTranslation();
  const name = `q-${q.id}`;
  return (
    <Card>
      <p className="exam-q__meta muted">{t('exam.questionOf', { n: index + 1 })} · {t('exam.marks', { n: q.marks })}</p>
      <p className="exam-q__text">{q.text}</p>
      {(q.type === 'mcq' || q.type === 'true_false') && (
        <div className="exam-q__options" role="radiogroup" aria-label={q.text}>
          {q.options.map((o) => (
            <label key={o.id} className={`exam-option${value && value.optionId === o.id ? ' exam-option--chosen' : ''}`}>
              <input type="radio" name={name} checked={!!value && value.optionId === o.id} onChange={() => onChange({ optionId: o.id })} />
              {o.text}
            </label>
          ))}
        </div>
      )}
      {q.type === 'multi_correct' && (
        <div className="exam-q__options">
          <p className="field__hint">{t('exam.chooseAll')}</p>
          {q.options.map((o) => {
            const ids = (value && value.optionIds) || [];
            const on = ids.includes(o.id);
            return (
              <label key={o.id} className={`exam-option${on ? ' exam-option--chosen' : ''}`}>
                <input type="checkbox" checked={on} onChange={() => onChange({ optionIds: on ? ids.filter((x) => x !== o.id) : [...ids, o.id] })} />
                {o.text}
              </label>
            );
          })}
        </div>
      )}
      {q.type === 'fill_blank' && (
        <Input label={t('exam.yourAnswer')} value={(value && value.text) || ''} onChange={(e) => onChange({ text: e.target.value })} maxLength={500} />
      )}
      {feedback && (
        <Banner kind={feedback.correct ? 'success' : 'error'} message={`${feedback.correct ? t('exam.correct') : t('exam.wrong')}${feedback.explanation ? ` — ${feedback.explanation}` : ''}`} />
      )}
    </Card>
  );
}

// Runs an attempt: server deadline drives the timer; answers autosave; unsent answers retry when back online.
export function ExamRunner({ paper }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState(paper.answers || {});
  const [feedback, setFeedback] = useState({});
  const [status, setStatus] = useState('idle');
  const [remaining, setRemaining] = useState(paper.deadlineAt ? new Date(paper.deadlineAt) - Date.now() : null);
  const [confirming, setConfirming] = useState(false);
  const timers = useRef({});
  const unsent = useRef({});
  const submitted = useRef(false);

  const send = useCallback(async (questionId, answer) => {
    setStatus('saving');
    try {
      const r = await api.put(`/student/attempts/${paper.attemptId}/answers/${questionId}`, answer);
      delete unsent.current[questionId];
      if (paper.mode === 'practice' && r.data && r.data.correct !== undefined) setFeedback((f) => ({ ...f, [questionId]: r.data }));
      setStatus(Object.keys(unsent.current).length ? 'offline' : 'saved');
    } catch (e) {
      if (e.code === 'TIME_UP' || e.code === 'ATTEMPT_SUBMITTED') {
        submitted.current = true;
        navigate(`/student/attempts/${paper.attemptId}/result`, { replace: true });
        return;
      }
      unsent.current[questionId] = answer;
      setStatus('offline');
    }
  }, [paper.attemptId, paper.mode, navigate]);

  const onChange = (questionId, answer) => {
    setAnswers((a) => ({ ...a, [questionId]: answer }));
    clearTimeout(timers.current[questionId]);
    timers.current[questionId] = setTimeout(() => send(questionId, answer), 600);
  };

  // Retry unsent answers every 5 seconds and when the browser comes back online.
  useEffect(() => {
    const retry = () => Object.entries(unsent.current).forEach(([qid, a]) => send(qid, a));
    const id = setInterval(() => Object.keys(unsent.current).length && retry(), 5000);
    window.addEventListener('online', retry);
    return () => {
      clearInterval(id);
      window.removeEventListener('online', retry);
    };
  }, [send]);

  const submit = useMutation({
    mutationFn: async () => {
      submitted.current = true;
      Object.values(timers.current).forEach(clearTimeout);
      return api.post(`/student/attempts/${paper.attemptId}/submit`);
    },
    onSettled: () => navigate(`/student/attempts/${paper.attemptId}/result`, { replace: true }),
  });

  useEffect(() => {
    if (!paper.deadlineAt) return undefined;
    const id = setInterval(() => {
      const left = new Date(paper.deadlineAt) - Date.now();
      setRemaining(left);
      if (left <= 0 && !submitted.current) submit.mutate();
    }, 250);
    return () => clearInterval(id);
  }, [paper.deadlineAt, submit]);

  // Warn before leaving the page with unsent answers.
  useEffect(() => {
    const warn = (e) => {
      if (Object.keys(unsent.current).length && !submitted.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const answered = paper.questions.filter((q) => answers[q.id]).length;
  return (
    <div className="exam stack">
      <div className="exam__bar">
        <strong>{paper.title}</strong>
        <span className="muted">{t('exam.answered', { n: answered, total: paper.questions.length })}</span>
        <span className={`exam__save exam__save--${status}`} aria-live="polite">
          {status === 'saving' && t('exam.saving')}
          {status === 'saved' && t('common.saved')}
          {status === 'offline' && t('exam.offline')}
        </span>
        {remaining !== null && <span role="timer" className={`exam__timer${remaining < 60000 ? ' exam__timer--low' : ''}`}>{fmt(remaining)}</span>}
      </div>
      {paper.questions.map((q, i) => (
        <Question key={q.id} q={q} index={i} value={answers[q.id]} onChange={(a) => onChange(q.id, a)} feedback={feedback[q.id]} />
      ))}
      <div className="row"><Button onClick={() => setConfirming(true)} loading={submit.isPending}>{t('exam.submit')}</Button></div>
      <Modal open={confirming} title={t('exam.confirmTitle')} onClose={() => setConfirming(false)}
        footer={<><Button variant="secondary" onClick={() => setConfirming(false)}>{t('exam.keepGoing')}</Button><Button loading={submit.isPending} onClick={() => submit.mutate()}>{t('exam.submitNow')}</Button></>}>
        <p>{t('exam.confirmBody', { n: answered, total: paper.questions.length })}</p>
      </Modal>
    </div>
  );
}

export default function ExamTakePage() {
  const { examId } = useParams();
  const { t } = useTranslation();
  const [paper, setPaper] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    api.post(`/student/exams/${examId}/attempts`).then((r) => alive && setPaper(r.data)).catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [examId]);
  if (error) return <EmptyState title={error} />;
  if (!paper) return <Spinner label={t('common.loading')} />;
  return <ExamRunner paper={paper} />;
}
