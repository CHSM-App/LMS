import { forwardRef, useId } from 'react';

function FieldShell({ id, label, hint, error, required, children }) {
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      {label && (
        <label className="field__label" htmlFor={id}>
          {label}
          {required && <span className="field__required" aria-hidden="true"> *</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="field__hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="field__error" id={`${id}-error`} role="alert">{error}</p>}
    </div>
  );
}

function describedBy(id, hint, error) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export const Input = forwardRef(function Input({ label, hint, error, required, id, className = '', ...rest }, ref) {
  const auto = useId();
  const fid = id || auto;
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} required={required}>
      <input
        ref={ref}
        id={fid}
        className={`input ${className}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy(fid, hint, error)}
        aria-required={required || undefined}
        {...rest}
      />
    </FieldShell>
  );
});

export const Textarea = forwardRef(function Textarea({ label, hint, error, required, id, rows = 4, ...rest }, ref) {
  const auto = useId();
  const fid = id || auto;
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} required={required}>
      <textarea
        ref={ref}
        id={fid}
        rows={rows}
        className="input input--textarea"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy(fid, hint, error)}
        {...rest}
      />
    </FieldShell>
  );
});

export const Select = forwardRef(function Select({ label, hint, error, required, id, options = [], placeholder, ...rest }, ref) {
  const auto = useId();
  const fid = id || auto;
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} required={required}>
      <select
        ref={ref}
        id={fid}
        className="input input--select"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy(fid, hint, error)}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </FieldShell>
  );
});

export const Checkbox = forwardRef(function Checkbox({ label, error, id, ...rest }, ref) {
  const auto = useId();
  const fid = id || auto;
  return (
    <div className={`checkbox${error ? ' field--error' : ''}`}>
      <input ref={ref} id={fid} type="checkbox" aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${fid}-error` : undefined} {...rest} />
      <label htmlFor={fid}>{label}</label>
      {error && <p className="field__error" id={`${fid}-error`} role="alert">{error}</p>}
    </div>
  );
});
