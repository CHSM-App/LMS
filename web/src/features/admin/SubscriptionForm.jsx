import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Input, Select } from '../../components';
import { PLANS, planEndDate } from '../../utils/plans';
import { todayISO } from '../../utils/format';

// Add / edit a teacher subscription. Fixed plans fill the end date; Custom asks for it.
export function SubscriptionForm({ teachers, initial, onSubmit, onCancel, saving, serverError }) {
  const { t } = useTranslation();
  const [teacherPublicId, setTeacher] = useState(initial?.teacher?.publicId || '');
  const [planType, setPlan] = useState(initial?.planType || 'monthly');
  const [startDate, setStart] = useState(initial?.startDate || todayISO());
  const [endDate, setEnd] = useState(initial?.planType === 'custom' ? initial.endDate : '');
  const [blocked, setBlocked] = useState(initial?.status === 'blocked');
  const [errors, setErrors] = useState({});

  const computedEnd = planType === 'custom' ? endDate : planEndDate(planType, startDate);

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!initial && !teacherPublicId) errs.teacher = t('validation.required');
    if (!startDate) errs.startDate = t('validation.required');
    if (planType === 'custom' && !endDate) errs.endDate = t('validation.required');
    else if (computedEnd && startDate && computedEnd < startDate) errs.endDate = t('subscriptions.dateOrder');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSubmit({ teacherPublicId, planType, startDate, endDate: planType === 'custom' ? endDate : undefined, blocked });
  };

  return (
    <form onSubmit={submit} noValidate>
      {!initial && (
        <Select
          label={t('subscriptions.teacher')}
          value={teacherPublicId}
          onChange={(e) => setTeacher(e.target.value)}
          placeholder={t('subscriptions.chooseTeacher')}
          options={teachers.map((x) => ({ value: x.publicId, label: x.name }))}
          error={errors.teacher}
          required
        />
      )}
      <Select
        label={t('subscriptions.plan')}
        value={planType}
        onChange={(e) => setPlan(e.target.value)}
        options={PLANS.map((p) => ({ value: p, label: t(`subscriptions.plans.${p}`) }))}
        required
      />
      <Input label={t('subscriptions.startDate')} type="date" value={startDate} onChange={(e) => setStart(e.target.value)} error={errors.startDate} required />
      {planType === 'custom' ? (
        <Input label={t('subscriptions.endDate')} type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} error={errors.endDate} required />
      ) : (
        computedEnd && <p className="field__hint">{t('subscriptions.endsOn', { date: computedEnd })}</p>
      )}
      {errors.endDate && planType !== 'custom' && <p className="field__error" role="alert">{errors.endDate}</p>}
      {initial && <Checkbox label={t('subscriptions.blockThis')} checked={blocked} onChange={(e) => setBlocked(e.target.checked)} />}
      {serverError && <p className="field__error" role="alert">{serverError}</p>}
      <div className="row">
        <Button type="submit" loading={saving}>{t('subscriptions.save')}</Button>
        <Button variant="secondary" onClick={onCancel}>{t('common.cancel')}</Button>
      </div>
    </form>
  );
}
