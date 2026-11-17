import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { Spinner, EmptyState } from '../../components';
import { Markdown } from '../../components/Markdown';

export default function LegalPage({ doc }) {
  const { t, i18n } = useTranslation();
  const q = useQuery({ queryKey: ['legal', doc, i18n.language], queryFn: () => api.get(`/public/legal/${doc}`, { lang: i18n.language }) });
  if (q.isLoading) return <Spinner label={t('common.loading')} />;
  if (q.error) return <EmptyState title={q.error.message} action={{ label: t('common.retry'), onClick: q.refetch }} />;
  return (
    <article className="container" style={{ maxWidth: 760 }}>
      <Markdown source={q.data.data.markdown} />
      <p className="muted">{t('legal.version', { v: q.data.data.version })}</p>
    </article>
  );
}
