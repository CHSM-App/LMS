import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { Banner, Button, Input, OtpInput, Textarea } from '../../components';
import { isValidMobile } from '../../utils/format';
import { useOtp } from '../auth/useOtp';
import { ConsentFields } from '../auth/ConsentFields';

const EMPTY = { name: '', mobile: '', education: '', classStandard: '', preferredTime: '', message: '' };

// Live demo request (spec §3.3 / §4): name*, mobile*, OTP*, education*, class, preferred time, message.
export function LiveDemoForm({ courseSlug, onSent }) {
  const { t } = useTranslation();
  const otp = useOtp('demo_request');
  const [f, setF] = useState(EMPTY);
  const [accept, setAccept] = useState(false);
  const [whatsapp, setWhatsapp] = useState(true);
  const [errors, setErrors] = useState({});
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const optional = (label) => `${label} (${t('common.optional')})`;

  const onContinue = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!f.name.trim()) errs.name = t('validation.required');
    if (!f.mobile.trim()) errs.mobile = t('validation.required');
    else if (!isValidMobile(f.mobile)) errs.mobile = t('auth.invalidMobile');
    if (!f.education.trim()) errs.education = t('validation.required');
    if (!accept) errs.accept = t('consent.required');
    setErrors(errs);
    if (!Object.keys(errs).length) await otp.send(f.mobile);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setServerError('');
    try {
      const r = await api.post('/public/demo-requests', {
        courseSlug, ...f, otp: code, acceptTerms: accept, whatsappOptIn: whatsapp,
        classStandard: f.classStandard || null, preferredTime: f.preferredTime || null, message: f.message || null,
      });
      setDone(r.data);
      if (onSent) onSent(r.data);
    } catch (err) {
      setServerError(err.message);
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  if (done) return <Banner kind="success" message={t('demoForm.sent', { teacher: done.teacherName })} />;

  return !otp.sentTo ? (
    <form onSubmit={onContinue} noValidate>
      <div className="grid grid--2">
        <Input label={t('common.name')} value={f.name} onChange={set('name')} error={errors.name} required autoComplete="name" />
        <Input label={t('common.mobile')} type="tel" inputMode="numeric" value={f.mobile} onChange={set('mobile')} error={errors.mobile} required />
        <Input label={t('requests.education')} value={f.education} onChange={set('education')} error={errors.education} hint={t('demoForm.educationHint')} required />
        <Input label={optional(t('demoForm.classStandard'))} value={f.classStandard} onChange={set('classStandard')} />
        <Input label={optional(t('demoForm.preferredTime'))} value={f.preferredTime} onChange={set('preferredTime')} hint={t('demoForm.preferredTimeHint')} />
      </div>
      <Textarea label={optional(t('requests.message'))} value={f.message} onChange={set('message')} rows={3} maxLength={1000} />
      <ConsentFields accept={accept} onAccept={setAccept} whatsapp={whatsapp} onWhatsapp={setWhatsapp} error={errors.accept} whatsappHint={t('demoForm.whatsappHint')} />
      {otp.error && <Banner kind="error" message={otp.error} />}
      <Button type="submit" loading={otp.sending}>{t('teacherReg.continue')}</Button>
    </form>
  ) : (
    <form onSubmit={onSubmit} className="stack" noValidate>
      <p>
        {t('auth.otpSentTo', { mobile: otp.sentTo })}{' '}
        <button type="button" className="btn btn--link" onClick={otp.reset}>{t('teacherReg.editDetails')}</button>
      </p>
      <OtpInput value={code} onChange={setCode} autoFocus />
      {serverError && <Banner kind="error" message={serverError} />}
      <Button type="submit" loading={busy} disabled={code.length !== 6}>{t('demoForm.send')}</Button>
      {otp.secondsLeft > 0 ? (
        <p className="muted">{t('auth.resendIn', { s: otp.secondsLeft })}</p>
      ) : (
        <button type="button" className="btn btn--link" onClick={() => otp.send(otp.sentTo)}>{t('auth.resend')}</button>
      )}
    </form>
  );
}
