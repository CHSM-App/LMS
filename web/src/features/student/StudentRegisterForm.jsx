import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, setAccessToken } from '../../api/client';
import { useAuth } from '../../app/AuthProvider';
import { Banner, Button, Input, OtpInput } from '../../components';
import { isValidMobile } from '../../utils/format';
import { useOtp } from '../auth/useOtp';
import { ConsentFields } from '../auth/ConsentFields';
import { StepIndicator } from '../auth/AuthLayout';

const EMPTY = { name: '', mobile: '', education: '', classStandard: '', city: '', email: '' };

// Student registration (spec §4): name*, mobile*, OTP*, education*, city, email. Logs in on success.
// heading / intro / footer are optional slots so the step indicator sits above the page heading.
export function StudentRegisterForm({ onDone, heading = null, intro = null, footer = null }) {
  const { t, i18n } = useTranslation();
  const { refreshMe } = useAuth();
  const otp = useOtp('student_register');
  const [f, setF] = useState(EMPTY);
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState({});
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const optional = (label) => `${label} (${t('common.optional')})`;

  const onContinue = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!f.name.trim()) errs.name = t('validation.required');
    if (!isValidMobile(f.mobile)) errs.mobile = t('auth.invalidMobile');
    if (!f.education.trim()) errs.education = t('validation.required');
    if (!f.email.trim()) errs.email = t('validation.required');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) errs.email = t('validation.email');
    if (!accept) errs.accept = t('consent.required');
    setErrors(errs);
    if (!Object.keys(errs).length) await otp.send(f.mobile);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setServerError('');
    try {
      const r = await api.post('/auth/register-student', {
        ...f, otp: code, acceptTerms: accept, whatsappOptIn: true, preferredLang: i18n.language,
        classStandard: f.classStandard || null, city: f.city || null, email: f.email.trim(),
      });
      setAccessToken(r.data.accessToken);
      await refreshMe();
      onDone(r.data.user);
    } catch (err) {
      setServerError(err.message);
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const form = !otp.sentTo ? (
    <form onSubmit={onContinue} noValidate>
      <div className="grid reg-cols reg-cols--3">
        <Input label={t('common.name')} value={f.name} onChange={set('name')} error={errors.name} required autoComplete="name" />
        <Input label={t('common.mobile')} type="tel" inputMode="numeric" prefix="+91" value={f.mobile} onChange={set('mobile')} error={errors.mobile} required />
        <Input label={t('requests.education')} value={f.education} onChange={set('education')} error={errors.education} placeholder={t('demoForm.educationPlaceholder')} required />
        <Input label={t('demoForm.classStandard')} placeholder={t('common.optional')} value={f.classStandard} onChange={set('classStandard')} />
        <Input label={t('common.city')} placeholder={t('common.optional')} value={f.city} onChange={set('city')} />
        <Input label={t('common.email')} type="email" value={f.email} onChange={set('email')} error={errors.email} required autoComplete="email" />
      </div>
      <ConsentFields accept={accept} onAccept={setAccept} error={errors.accept} />
      {otp.error && <Banner kind="error" message={otp.error} />}
      <Button type="submit" block loading={otp.sending}>{t('teacherReg.continue')}</Button>
    </form>
  ) : (
    <form onSubmit={onSubmit} className="stack" noValidate>
      <p>{t('auth.otpSentTo', { mobile: otp.sentTo })} <button type="button" className="btn btn--link" onClick={otp.reset}>{t('teacherReg.editDetails')}</button></p>
      <OtpInput value={code} onChange={setCode} autoFocus />
      {serverError && <Banner kind="error" message={serverError} />}
      <Button type="submit" block loading={busy} disabled={code.length !== 6}>{t('register.create')}</Button>
      {otp.secondsLeft > 0 ? <p className="muted">{t('auth.resendIn', { s: otp.secondsLeft })}</p> : (
        <button type="button" className="btn btn--link" onClick={() => otp.send(otp.sentTo)}>{t('auth.resend')}</button>
      )}
    </form>
  );

  return (
    <>
      <StepIndicator step={otp.sentTo ? 2 : 1} label={otp.sentTo ? t('auth.stepVerify') : t('auth.stepDetails')} />
      {heading}
      {intro}
      {form}
      {!otp.sentTo && footer}
    </>
  );
}
