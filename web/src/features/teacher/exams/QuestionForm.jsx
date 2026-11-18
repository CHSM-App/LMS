import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Select, Textarea, Checkbox, FileUpload } from '../../../components';
import { fileUrl } from '../../../api/client';
import { uploadSmall } from '../../../utils/upload';

const TYPES = ['mcq', 'true_false', 'fill_blank', 'multi_correct'];
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

function initialState(q) {
  if (!q) return { type: 'mcq', text: '', difficulty: 'medium', marks: 1, negativeMarks: 0, explanation: '', imageKey: null, imageUrl: null, options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }], accepted: '', tf: null };
  return {
    type: q.type,
    text: q.text,
    difficulty: q.difficulty,
    marks: q.marks,
    negativeMarks: q.negativeMarks,
    explanation: q.explanation || '',
    imageKey: q.explanationImageKey || null,
    imageUrl: q.explanationImageUrl || null,
    options: q.type === 'mcq' || q.type === 'multi_correct' ? q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) : [{ text: '', isCorrect: false }, { text: '', isCorrect: false }],
    accepted: (q.acceptedAnswers || []).join('; '),
    tf: q.type === 'true_false' ? (q.options.find((o) => o.isCorrect) || {}).text === 'True' : null,
  };
}

// Add / edit a question. Fields change with the type (spec §5: MCQ, True/False, Fill in the blank, Multiple correct).
export function QuestionForm({ initial, onSave, onCancel, saving, serverErrors }) {
  const { t } = useTranslation();
  const [f, setF] = useState(() => initialState(initial));
  const [errors, setErrors] = useState([]);
  const [imageError, setImageError] = useState('');
  const [uploading, setUploading] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setOption = (i, patch) => setF((x) => ({ ...x, options: x.options.map((o, j) => (j === i ? { ...o, ...patch } : f.type === 'mcq' && patch.isCorrect ? { ...o, isCorrect: false } : o)) }));

  const build = () => {
    const body = { type: f.type, text: f.text.trim(), difficulty: f.difficulty, marks: Number(f.marks), negativeMarks: Number(f.negativeMarks || 0), explanation: f.explanation.trim() || null, explanationImageKey: f.imageKey };
    if (f.type === 'true_false') body.options = [{ text: 'True', isCorrect: f.tf === true }, { text: 'False', isCorrect: f.tf === false }];
    else if (f.type === 'fill_blank') body.acceptedAnswers = f.accepted.split(';').map((s) => s.trim()).filter(Boolean);
    else body.options = f.options.filter((o) => o.text.trim()).map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect }));
    return body;
  };

  // Photo of the worked solution (e.g. a maths sum solved on paper). Uploaded first; the key is saved with the question.
  const onImage = async (file) => {
    setImageError('');
    setUploading(true);
    try {
      const r = await uploadSmall('solution', file);
      setF((x) => ({ ...x, imageKey: r.key, imageUrl: r.url }));
    } catch (err) {
      setImageError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const body = build();
    const errs = [];
    if (!body.text) errs.push(t('questions.errors.text'));
    if (body.type === 'true_false' && f.tf === null) errs.push(t('questions.errors.tf'));
    if (body.type === 'fill_blank' && !body.acceptedAnswers.length) errs.push(t('questions.errors.accepted'));
    if (body.type === 'mcq' && body.options.filter((o) => o.isCorrect).length !== 1) errs.push(t('questions.errors.mcq'));
    if (body.type === 'multi_correct' && !body.options.some((o) => o.isCorrect)) errs.push(t('questions.errors.multi'));
    if (['mcq', 'multi_correct'].includes(body.type) && body.options.length < 2) errs.push(t('questions.errors.options'));
    if (!(body.marks > 0)) errs.push(t('questions.errors.marks'));
    if (body.negativeMarks > body.marks) errs.push(t('questions.errors.negative'));
    setErrors(errs);
    if (!errs.length) onSave(body);
  };

  const shown = errors.length ? errors : serverErrors || [];
  return (
    <form onSubmit={submit} noValidate className="stack" style={{ gap: 0 }}>
      <div className="grid grid--2">
        <Select label={t('questions.type')} value={f.type} onChange={set('type')} options={TYPES.map((x) => ({ value: x, label: t(`questions.types.${x}`) }))} />
        <Select label={t('questions.difficulty')} value={f.difficulty} onChange={set('difficulty')} options={['easy', 'medium', 'hard'].map((x) => ({ value: x, label: t(`questions.levels.${x}`) }))} />
      </div>
      <Textarea label={t('questions.question')} value={f.text} onChange={set('text')} required rows={3} />
      {(f.type === 'mcq' || f.type === 'multi_correct') && (
        <fieldset className="video-field">
          <legend className="field__label">{f.type === 'mcq' ? t('questions.optionsMcq') : t('questions.optionsMulti')}</legend>
          {f.options.map((o, i) => (
            <div key={i} className="row" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <Input label={t('questions.option', { letter: LETTERS[i] })} value={o.text} onChange={(e) => setOption(i, { text: e.target.value })} />
              </div>
              <Checkbox label={t('questions.correct')} checked={o.isCorrect} onChange={(e) => setOption(i, { isCorrect: e.target.checked })} />
            </div>
          ))}
          {f.options.length < 5 && (
            <Button variant="ghost" size="sm" onClick={() => setF((x) => ({ ...x, options: [...x.options, { text: '', isCorrect: false }] }))}>{t('questions.addOption')}</Button>
          )}
        </fieldset>
      )}
      {f.type === 'true_false' && (
        <fieldset className="video-field">
          <legend className="field__label">{t('questions.correctAnswer')}</legend>
          <div className="row">
            {['True', 'False'].map((v) => (
              <label key={v} className="checkbox">
                <input type="radio" name="tf" checked={f.tf === (v === 'True')} onChange={() => setF((x) => ({ ...x, tf: v === 'True' }))} />
                {v}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {f.type === 'fill_blank' && (
        <Input label={t('questions.accepted')} value={f.accepted} onChange={set('accepted')} hint={t('questions.acceptedHint')} required />
      )}
      <div className="grid grid--2">
        <Input label={t('questions.marks')} type="number" min="0.25" step="0.25" value={f.marks} onChange={set('marks')} />
        <Input label={t('questions.negative')} type="number" min="0" step="0.25" value={f.negativeMarks} onChange={set('negativeMarks')} hint={t('questions.negativeHint')} />
      </div>
      <Textarea label={`${t('questions.explanation')} (${t('common.optional')})`} value={f.explanation} onChange={set('explanation')} rows={2} hint={t('questions.explanationHint')} />
      {f.imageUrl && (
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <img src={fileUrl(f.imageUrl)} alt={t('questions.solutionImage')} className="solution-img" />
          <Button variant="ghost" size="sm" onClick={() => setF((x) => ({ ...x, imageKey: null, imageUrl: null }))}>{t('questions.removeImage')}</Button>
        </div>
      )}
      <FileUpload label={`${t('questions.solutionImage')} (${t('common.optional')})`} accept="image/jpeg,image/png,image/webp" maxMb={5} onFile={onImage} error={imageError} hint={t('questions.solutionImageHint')} />
      {shown.length > 0 && (
        <ul className="field__error" role="alert">{shown.map((e) => <li key={e}>{e}</li>)}</ul>
      )}
      <div className="row">
        <Button type="submit" loading={saving} disabled={uploading}>{t('questions.save')}</Button>
        <Button variant="secondary" onClick={onCancel}>{t('common.cancel')}</Button>
      </div>
    </form>
  );
}
