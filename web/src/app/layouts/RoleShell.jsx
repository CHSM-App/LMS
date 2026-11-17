import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthProvider';
import { RequireRole } from '../RequireRole';
import { AppShell } from './AppShell';
import { navFor } from '../nav';
import { Banner } from '../../components';
import { SupportLink } from '../../features/auth/SupportLink';

// Limited mode notice for teachers whose subscription has ended (DECISIONS.md).
function TeacherBanner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const sub = user && user.subscription;
  if (!sub || sub.status === 'active') return null;
  const message = sub.status === 'expired' ? t('subscriptions.limitedBanner', { date: sub.endDate }) : t('subscriptions.noneBanner');
  return <Banner kind="warning" message={message} action={<SupportLink />} />;
}

function Shell() {
  const { user } = useAuth();
  return <AppShell nav={navFor(user && user.role)} banner={user && user.role === 'teacher' ? <TeacherBanner /> : null} />;
}

// roles: who may enter. The sidebar always matches the signed-in user's role.
export function RoleShell({ roles }) {
  return (
    <RequireRole roles={roles}>
      <Shell />
    </RequireRole>
  );
}
