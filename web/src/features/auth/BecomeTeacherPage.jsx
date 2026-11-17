import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Input, OtpInput, FileUpload, Card, Banner } from '../../components';
import { api } from '../../api/client';
import { isValidMobile } from '../../utils/format';
import { useOtp } from './useOtp';
import { ConsentFields } from './ConsentFields';

const EMPTY = { name: '', mobile: '', courseName: '', subject: '', experienceYears: '', email: '', city: '', qualification: '' };

export default function BecomeTeacherPage() {
  const { t } = useTranslation();
  const otp = useOtp('teacher_register');
  const [f, setF] = useState(EMPTY);
  const [files, setFiles] = useState({});
  const [accept, setAccept] = useState(false);
  const [whatsapp, setWhatsapp] = useState(true);
  const [errors, setErrors] = useState({});
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(false);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const optional = (label) => `${label} (${t('common.optional')})`;

  const validate = () => {
    const e = {};
    if (!f.name.trim()) e.name = t('validation.required');
    if (!isValidMobile(f.mobile)) e.mobile = t('auth.invalidMobile');
    if (!f.courseName.trim()) e.courseName = t('validation.required');
    if (!f.subject.trim()) e.subject = t('validation.required');
    const y = Number(f.experienceYears);
    if (f.experienceYears === '' || !Number.isInteger(y) || y < 0 || y > 60) e.experienceYears = t('validation.years');
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = t('validation.email');
    if (!accept) e.accept = t('consent.required');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onContinue = async (e) => {
    e.preventDefault();
    if (validate()) await otp.send(f.mobile);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setServerError('');
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => v !== '' && fd.append(k, v));
    fd.append('otp', code);
    fd.append('acceptTerms', String(accept));
    fd.append('whatsappOptIn', String(whatsapp));
    if (files.photo) fd.append('photo', files.photo);
    if (files.idDocument) fd.append('idDocument', files.idDocument);
    try {
      await api.form('/teacher-requests', fd);
      setDone(true);
    } catch (err) {
      setServerError(err.message);
      setCode('');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="auth-card">
        <Card>
          <h1>{t('teacherReg.sentTitle')}</h1>
          <p>{t('teacherReg.sentBody')}</p>
          <Link to="/login">{t('auth.goToLogin')}</Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 760 }}>
      <h1>{t('teacherReg.title')}</h1>
      <p className="muted">{t('teacherReg.intro')}</p>
      <Card>
        {!otp.sentTo ? (
          <form onSubmit={onContinue} noValidate>
            <div className="grid grid--2">
              <Input label={t('common.name')} value={f.name} onChange={set('name')} error={errors.name} required autoComplete="name" />
              <Input label={t('common.mobile')} type="tel" inputMode="numeric" value={f.mobile} onChange={set('mobile')} error={errors.mobile} required />
              <Input label={t('teacherReg.course')} value={f.courseName} onChange={set('courseName')} error={errors.courseName} hint={t('teacherReg.courseHint')} required />
              <Input label={t('teacherReg.subject')} value={f.subject} onChange={set('subject')} error={errors.subject} required />
              <Input label={t('teacherReg.experience')} type="number" min="0" max="60" inputMode="numeric" value={f.experienceYears} onChange={set('experienceYears')} error={errors.experienceYears} required />
              <Input label={optional(t('common.email'))} type="email" value={f.email} onChange={set('email')} error={errors.email} autoComplete="email" />
              <Input label={optional(t('common.city'))} value={f.city} onChange={set('city')} />
              <Input label={optional(t('teacherReg.qualification'))} value={f.qualification} onChange={set('qualification')} />
              <FileUpload label={optional(t('teacherReg.photo'))} accept="image/jpeg,image/png,image/webp" maxMb={5} onFile={(file) => setFiles((x) => ({ ...x, photo: file }))} />
              <FileUpload label={optional(t('teacherReg.idDocument'))} accept="image/*,application/pdf" maxMb={5} onFile={(file) => setFiles((x) => ({ ...x, idDocument: file }))} />
            </div>
            <ConsentFields accept={accept} onAccept={setAccept} whatsapp={whatsapp} onWhatsapp={setWhatsapp} error={errors.accept} />
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
            <Button type="submit" loading={submitting} disabled={code.length !== 6}>{t('teacherReg.send')}</Button>
            {otp.secondsLeft > 0 ? (
              <p className="muted">{t('auth.resendIn', { s: otp.secondsLeft })}</p>
            ) : (
              <button type="button" className="btn btn--link" onClick={() => otp.send(otp.sentTo)}>{t('auth.resend')}</button>
            )}
          </form>
        )}
      </Card>
    </div>
  );
}
