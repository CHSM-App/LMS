import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

export function OtpInput({ length = 6, value = '', onChange, disabled = false, autoFocus = false }) {
  const { t } = useTranslation();
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  const setAt = (index, digit) => {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join('').slice(0, length));
  };

  const focus = (i) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  const handleChange = (i, e) => {
    const d = e.target.value.replace(/\D/g, '').slice(-1);
    setAt(i, d);
    if (d) focus(i + 1);
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[i]) setAt(i, '');
      else if (i > 0) {
        setAt(i - 1, '');
        focus(i - 1);
      }
    } else if (e.key === 'ArrowLeft') focus(i - 1);
    else if (e.key === 'ArrowRight') focus(i + 1);
  };

  const handlePaste = (e) => {
    const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    focus(pasted.length);
  };

  return (
    <div className="otp" role="group" aria-label={t('auth.otpLabel')}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className="otp__box"
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={d}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          aria-label={t('auth.otpDigit', { n: i + 1 })}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
        />
      ))}
    </div>
  );
}
