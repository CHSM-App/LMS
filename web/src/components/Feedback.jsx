import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

const STATUS_STYLE = {
  approved: 'approved', published: 'approved', completed: 'approved', active: 'approved', answered: 'approved', present: 'approved',
  pending: 'pending', scheduled: 'pending', open: 'pending', upcoming: 'pending', live: 'pending',
  draft: 'neutral', paused: 'neutral', expired: 'neutral', closed: 'neutral', cancelled: 'neutral', archived: 'neutral', absent: 'neutral',
  rejected: 'rejected', blocked: 'rejected',
};
const STATUS_ICON = { approved: '✓', pending: '◷', neutral: '•', rejected: '✕' };

export function StatusBadge({ status }) {
  const { t } = useTranslation();
  const style = STATUS_STYLE[status] || 'neutral';
  return (
    <span className={`badge badge--${style}`}>
      <span aria-hidden="true" className="badge__icon">{STATUS_ICON[style]}</span>
      {t(`status.${status}`, { defaultValue: status })}
    </span>
  );
}

export function ProgressBar({ value = 0, label, showLabel = true }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="progress">
      <div className="progress__track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}>
        <div className="progress__fill" style={{ width: `${v}%` }} />
      </div>
      {showLabel && <span className="progress__label">{v}%</span>}
    </div>
  );
}

export function Banner({ kind = 'info', message, action }) {
  return (
    <div className={`banner banner--${kind}`} role="status">
      <span className="banner__icon" aria-hidden="true">{kind === 'error' ? '!' : kind === 'warning' ? '⚠' : 'i'}</span>
      <p className="banner__message">{message}</p>
      {action && <div className="banner__action">{action}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {body && <p className="empty__body">{body}</p>}
      {action && (
        <button type="button" className="btn btn--compact btn--sm" onClick={action.onClick}>
          <span className="btn__label">{action.label}</span>
        </button>
      )}
    </div>
  );
}

export function Spinner({ label }) {
  return (
    <div className="spinner-wrap" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label && <span className="visually-hidden">{label}</span>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export function Card({ title, actions, children, accent = false, className = '' }) {
  return (
    <section className={`card${accent ? ' card--accent' : ''} ${className}`}>
      {(title || actions) && (
        <header className="card__header">
          {title && <h2 className="card__title">{title}</h2>}
          {actions && <div className="card__actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

const ToastContext = createContext({ show: () => {} });

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const show = useCallback(({ kind = 'success', message }) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((ts) => [...ts, { id, kind, message }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 4000);
  }, []);
  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((x) => (
          <div key={x.id} className={`toast toast--${x.kind}`} role={x.kind === 'error' ? 'alert' : 'status'}>
            <span aria-hidden="true">{x.kind === 'error' ? '✕' : '✓'}</span> {x.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
