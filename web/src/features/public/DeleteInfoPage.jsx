import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { Card } from '../../components';

// Public page (no login) linked from Google Play's data safety form: how to delete an account and what happens.
export default function DeleteInfoPage() {
  const { t } = useTranslation();
  const { data } = useQuery({ queryKey: ['public-config'], queryFn: () => api.get('/public/config'), staleTime: Infinity, retry: false });
  const contact = data?.data?.supportContact;
  return (
    <div className="auth-card" style={{ maxWidth: 720 }}>
      <Card>
        <h1>{t('deleteInfo.title')}</h1>
        <p>{t('deleteInfo.intro')}</p>
        <h2>{t('deleteInfo.howTitle')}</h2>
        <ol>
          <li>{t('deleteInfo.inApp')}</li>
          <li>{t('deleteInfo.onWeb')}</li>
        </ol>
        <p className="muted">{t('deleteInfo.otp')}</p>
        <h2>{t('deleteInfo.whatTitle')}</h2>
        <ul>
          <li>{t('deleteInfo.deleted')}</li>
          <li>{t('deleteInfo.sessions')}</li>
          <li>{t('deleteInfo.downloads')}</li>
          <li>{t('deleteInfo.kept')}</li>
        </ul>
        <p>{t('deleteInfo.when')}</p>
        <h2>{t('deleteInfo.helpTitle')}</h2>
        <p>{contact ? t('deleteInfo.help', { contact }) : t('deleteInfo.helpNoContact')}</p>
        <p>
          <Link to="/privacy">{t('account.privacy')}</Link>
        </p>
      </Card>
    </div>
  );
}
