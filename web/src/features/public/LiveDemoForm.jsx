import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { Banner, Button, Input, OtpInput, Textarea } from '../../components';
import { Icon } from '../../components/Icon';
import { isValidMobile } from '../../utils/format';
import { useOtp } from '../auth/useOtp';
import { ConsentFields } from '../auth/ConsentFields';

const EMPTY = { name: '', mobile: '', education: '', classStandard: '', preferredTime: '', message: '' };

// Live demo request (spec §3.3 / §4): name*, mobile*, OTP*, education*, class, preferred time, message.
export function LiveDemoForm({ courseSlug, courseTitle, onSent }) {
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

  const step = otp.sentTo ? 2 : 1;
  const aside = (
    <aside className="demo__aside">
      <span className="demo__pill">{t('demoForm.badge')}</span>
      <h3 className="demo__headline">{t('demoForm.headline')}</h3>
      {courseTitle && <p className="demo__course">{courseTitle}</p>}
      <ul className="demo__perks">
        {['perk1', 'perk2', 'perk3'].map((k) => (
          <li key={k}><span className="demo__tick"><Icon name="check" size={14} /></span>{t(`demoForm.${k}`)}</li>
        ))}
      </ul>
      <p className="demo__trust"><Icon name="shield" size={16} /> {t('demoForm.trust')}</p>
    </aside>
  );
  const shell = (children) => <div className="demo">{aside}<div className="demo__main">{children}</div></div>;

  if (done) {
    return shell(
      <div className="demo__done">
        <span className="demo__done-icon"><Icon name="check" size={28} /></span>
        <Banner kind="success" message={t('demoForm.sent', { teacher: done.teacherName })} />
      </div>,
    );
  }

  const steps = (
    <ol className="demo__steps" aria-label={t('demoForm.stepsLabel')}>
      <li className={step === 1 ? 'is-current' : 'is-done'} aria-current={step === 1 ? 'step' : undefined}><span>{step === 1 ? 1 : <Icon name="check" size={14} />}</span>{t('demoForm.step1')}</li>
      <li className={step === 2 ? 'is-current' : ''} aria-current={step === 2 ? 'step' : undefined}><span>2</span>{t('demoForm.step2')}</li>
    </ol>
  );

  return shell(!otp.sentTo ? (
    <form onSubmit={onContinue} noValidate>
      {steps}
      <div className="grid grid--2 demo__grid">
        <Input label={t('common.name')} value={f.name} onChange={set('name')} error={errors.name} required autoComplete="name" />
        <Input label={t('common.mobile')} type="tel" inputMode="numeric" value={f.mobile} onChange={set('mobile')} error={errors.mobile} required />
        <Input label={t('requests.education')} value={f.education} onChange={set('education')} error={errors.education} placeholder={t('demoForm.educationPlaceholder')} required />
        <Input label={t('demoForm.classStandard')} placeholder={t('common.optional')} value={f.classStandard} onChange={set('classStandard')} />
        <Input label={t('demoForm.preferredTime')} placeholder={t('common.optional')} value={f.preferredTime} onChange={set('preferredTime')} />
        <Textarea label={optional(t('requests.message'))} value={f.message} onChange={set('message')} rows={2} maxLength={1000} />
      </div>
      <ConsentFields accept={accept} onAccept={setAccept} whatsapp={whatsapp} onWhatsapp={setWhatsapp} error={errors.accept} />
      {otp.error && <Banner kind="error" message={otp.error} />}
      <Button type="submit" size="lg" block loading={otp.sending}>{t('teacherReg.continue')}</Button>
    </form>
  ) : (
    <form onSubmit={onSubmit} className="stack demo__otp" noValidate>
      {steps}
      <p>
        {t('auth.otpSentTo', { mobile: otp.sentTo })}{' '}
        <button type="button" className="btn btn--link" onClick={otp.reset}>{t('teacherReg.editDetails')}</button>
      </p>
      <OtpInput value={code} onChange={setCode} autoFocus />
      {serverError && <Banner kind="error" message={serverError} />}
      <Button type="submit" block loading={busy} disabled={code.length !== 6}>{t('demoForm.send')}</Button>
      {otp.secondsLeft > 0 ? (
        <p className="muted">{t('auth.resendIn', { s: otp.secondsLeft })}</p>
      ) : (
        <button type="button" className="btn btn--link" onClick={() => otp.send(otp.sentTo)}>{t('auth.resend')}</button>
      )}
    </form>
  ));
}
