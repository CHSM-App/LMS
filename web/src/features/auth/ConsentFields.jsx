import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '../../components';

export function ConsentFields({ accept, onAccept, error }) {
  const { t } = useTranslation();
  return (
    <div className="stack" style={{ gap: 'var(--space-2)' }}>
      <Checkbox
        checked={accept}
        onChange={(e) => onAccept(e.target.checked)}
        error={error}
        label={
          <>
            {t('consent.agreePrefix')} <Link to="/terms" target="_blank">{t('consent.terms')}</Link> {t('consent.and')}{' '}
            <Link to="/privacy" target="_blank">{t('consent.privacy')}</Link>
          </>
        }
      />
      <p className="field__hint">{t('consent.whatsappNotice')}</p>
    </div>
  );
}
