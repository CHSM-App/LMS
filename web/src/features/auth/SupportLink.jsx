import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';

export function SupportLink() {
  const { t } = useTranslation();
  const { data } = useQuery({ queryKey: ['public-config'], queryFn: () => api.get('/public/config'), staleTime: Infinity, retry: false });
  const contact = data?.data?.supportContact;
  if (!contact) return <span>{t('common.contactSupport')}</span>;
  const href = contact.includes('@') ? `mailto:${contact}` : `https://wa.me/${contact.replace(/\D/g, '')}`;
  return <a href={href}>{t('common.contactSupport')}</a>;
}
