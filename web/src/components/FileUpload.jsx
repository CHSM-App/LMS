import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function FileUpload({ label, accept, maxMb, onFile, error, hint, required }) {
  const { t } = useTranslation();
  const id = useId();
  const [localError, setLocalError] = useState('');
  const [name, setName] = useState('');

  const onChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (maxMb && file.size > maxMb * 1024 * 1024) {
      setLocalError(t('common.fileTooLarge', { mb: maxMb }));
      setName('');
      e.target.value = '';
      return;
    }
    setLocalError('');
    setName(file.name);
    onFile(file);
  };

  const shown = localError || error;
  return (
    <div className={`field${shown ? ' field--error' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required && <span className="field__required" aria-hidden="true"> *</span>}
      </label>
      <input id={id} type="file" className="file-input" accept={accept} onChange={onChange} aria-invalid={shown ? 'true' : undefined} aria-describedby={shown ? `${id}-error` : undefined} />
      {name && !shown && <p className="field__hint">{name}</p>}
      {hint && !name && !shown && <p className="field__hint">{hint}</p>}
      {shown && <p className="field__error" id={`${id}-error`} role="alert">{shown}</p>}
    </div>
  );
}

export function UploadProgress({ fileName, percent, onCancel, onRetry, failed }) {
  const { t } = useTranslation();
  return (
    <div className="upload-progress">
      <div className="upload-progress__row">
        <span className="upload-progress__name">{fileName}</span>
        <span>{failed ? t('upload.failed') : `${Math.round(percent)}%`}</span>
      </div>
      <div className="progress__track" role="progressbar" aria-label={fileName} aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress__fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="upload-progress__actions">
        {failed && onRetry && <button type="button" className="btn btn--compact btn--sm" onClick={onRetry}><span className="btn__label">{t('common.retry')}</span></button>}
        {!failed && onCancel && percent < 100 && <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}><span className="btn__label">{t('common.cancel')}</span></button>}
      </div>
    </div>
  );
}
