import { useTranslation } from 'react-i18next';

export function Pager({ pagination, onPage }) {
  const { t } = useTranslation();
  if (!pagination || pagination.total <= pagination.limit) return null;
  const pages = Math.max(1, Math.ceil(pagination.total / pagination.limit));
  const { page } = pagination;
  return (
    <nav className="pager" aria-label={t('common.page', { page, pages })}>
      <button type="button" className="btn btn--secondary btn--sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <span className="btn__label">{t('common.previous')}</span>
      </button>
      <span>{t('common.page', { page, pages })}</span>
      <button type="button" className="btn btn--secondary btn--sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        <span className="btn__label">{t('common.next')}</span>
      </button>
    </nav>
  );
}
