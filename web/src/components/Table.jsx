import { useTranslation } from 'react-i18next';
import { EmptyState } from './EmptyState';

// Desktop: a real table. Below 640px CSS turns rows into stacked cards using data-label.
export function Table({ columns, rows, empty, loading = false, error, onRetry, rowKey = (r, i) => r.id ?? r.publicId ?? i, caption }) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <div className="table-skeleton" aria-busy="true" aria-label={t('common.loading')}>
        {[0, 1, 2].map((i) => <div key={i} className="skeleton skeleton--row" />)}
      </div>
    );
  }
  if (error) {
    return <EmptyState title={error} action={onRetry ? { label: t('common.retry'), onClick: onRetry } : undefined} />;
  }
  if (!rows || rows.length === 0) {
    return typeof empty === 'string' || !empty ? <EmptyState title={empty || t('common.nothingHere')} /> : empty;
  }
  return (
    <div className="table-wrap">
      <table className="table">
        {caption && <caption className="visually-hidden">{caption}</caption>}
        <thead>
          <tr>{columns.map((c) => <th key={c.key} scope="col" className={c.align ? `align-${c.align}` : undefined}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowKey(r, i)}>
              {columns.map((c) => (
                <td key={c.key} data-label={c.header} className={c.align ? `align-${c.align}` : undefined}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
