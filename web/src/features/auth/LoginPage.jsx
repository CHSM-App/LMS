import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Input, OtpInput, Banner } from '../../components';
import { AuthLayout, StepIndicator } from './AuthLayout';
import { useAuth, homeFor } from '../../app/AuthProvider';
import { isValidMobile } from '../../utils/format';
import { useOtp } from './useOtp';
import { SupportLink } from './SupportLink';

export default function LoginPage() {
  const { t } = useTranslation();
  const { login, sessionMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const otp = useOtp('login');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [loginError, setLoginError] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const onSend = async (e) => {
    e.preventDefault();
    if (!isValidMobile(mobile)) {
      setFieldError(t('auth.invalidMobile'));
      return;
    }
    setFieldError('');
    await otp.send(mobile);
  };

  const onVerify = async (e) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setVerifying(true);
    setLoginError(null);
    try {
      const user = await login(mobile, code);
      const from = location.state && location.state.from;
      navigate(from && from !== '/login' ? from : homeFor(user.role), { replace: true });
    } catch (err) {
      setLoginError(err);
      setCode('');
    } finally {
      setVerifying(false);
    }
  };

  const errorAction = () => {
    if (!loginError) return null;
    if (loginError.code === 'ACCOUNT_BLOCKED') return <SupportLink />;
    if (loginError.code === 'REQUEST_REJECTED') return <Link to="/become-teacher">{t('auth.applyAgain')}</Link>;
    if (loginError.status === 404) return <Link to="/register">{t('auth.studentRegister')}</Link>;
    return null;
  };

  return (
    <AuthLayout panel="auth.panelLogin">
        <StepIndicator step={otp.sentTo ? 2 : 1} label={otp.sentTo ? t('auth.stepVerify') : t('auth.stepMobile')} />
        <h1 className="auth-split__heading">{t('auth.loginTitle')}</h1>
        <p className="muted">{t('auth.loginIntro')}</p>
        {sessionMessage && !otp.sentTo && <Banner kind="warning" message={sessionMessage} />}
        {!otp.sentTo ? (
          <form onSubmit={onSend} noValidate>
            <Input
              label={t('common.mobile')}
              name="mobile"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              prefix="+91"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              error={fieldError || otp.error}
              hint={t('auth.mobileHint')}
              required
            />
            <Button type="submit" block loading={otp.sending}>{t('auth.sendOtp')}</Button>
          </form>
        ) : (
          <form onSubmit={onVerify} noValidate className="stack">
            <p>
              {t('auth.otpSentTo', { mobile: otp.sentTo })}{' '}
              <button type="button" className="btn btn--link" onClick={() => { otp.reset(); setCode(''); setLoginError(null); }}>
                {t('auth.changeNumber')}
              </button>
            </p>
            <OtpInput value={code} onChange={setCode} autoFocus />
            {loginError && <Banner kind="error" message={loginError.message} action={errorAction()} />}
            <Button type="submit" block loading={verifying} disabled={code.length !== 6}>{t('auth.verifyLogin')}</Button>
            {otp.secondsLeft > 0 ? (
              <p className="muted">{t('auth.resendIn', { s: otp.secondsLeft })}</p>
            ) : (
              <button type="button" className="btn btn--link" onClick={() => otp.send(otp.sentTo)}>{t('auth.resend')}</button>
            )}
            {otp.error && <p className="field__error" role="alert">{otp.error}</p>}
          </form>
        )}
        <div className="auth-split__alt">
          <p className="muted">{t('auth.newHere')}</p>
          <div className="auth-split__alt-links">
            <Link to="/register" className="btn btn--secondary"><span className="btn__label">{t('auth.studentRegister')}</span></Link>
            <Link to="/become-teacher" className="btn btn--secondary"><span className="btn__label">{t('auth.becomeTeacher')}</span></Link>
          </div>
        </div>
    </AuthLayout>
  );
}
