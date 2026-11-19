import { useTranslation } from 'react-i18next';

// Split layout for login and sign-up: a navy panel that says what the page is for, and the form.
// `panel` is the i18n key prefix of the side panel (title, body, point1..3).
export function AuthLayout({ panel, wide = false, children }) {
  const { t } = useTranslation();
  return (
    <div className="container">
    <div className={`auth-split${wide ? ' auth-split--wide' : ''}`}>
      <aside className="auth-split__panel">
        <h2 className="auth-split__title">{t(`${panel}.title`)}</h2>
        <p className="auth-split__body">{t(`${panel}.body`)}</p>
        <ul className="auth-split__points">
          {[1, 2, 3].map((n) => <li key={n}>{t(`${panel}.point${n}`)}</li>)}
        </ul>
        <p className="auth-split__langs">English · मराठी · हिंदी</p>
      </aside>
      <section className="auth-split__main">{children}</section>
    </div>
    </div>
  );
}

// "Step 1 of 2 · Your details": every sign-up here is details first, then the OTP.
export function StepIndicator({ step, label }) {
  const { t } = useTranslation();
  return (
    <p className="step-indicator">
      <span className="step-indicator__count">{t('auth.step', { n: step, total: 2 })}</span>
      <span className="step-indicator__label">{label}</span>
    </p>
  );
}
