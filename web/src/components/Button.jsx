import { forwardRef } from 'react';

// variant: primary (orange CTA) | compact (white + orange border) | secondary | danger | ghost | link
export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled = false, type = 'button', block = false, className = '', children, ...rest },
  ref,
) {
  const classes = ['btn', `btn--${variant}`, `btn--${size}`, block ? 'btn--block' : '', className].filter(Boolean).join(' ');
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading ? 'true' : undefined} {...rest}>
      {loading && <span className="spinner spinner--inline" aria-hidden="true" />}
      <span className="btn__label">{children}</span>
    </button>
  );
});
