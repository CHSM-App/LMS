import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, homeFor } from '../AuthProvider';
import { LanguageSwitcher } from './LanguageSwitcher';
import { SupportLink } from '../../features/auth/SupportLink';
import '../../design/shell.css';

export function PublicLayout() {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <>
      <a className="skip-link" href="#main">{t('shell.skip')}</a>
      <header className="public-header">
        <div className="container public-header__inner">
          <Link to="/" className="public-header__brand">{t('app.name')}</Link>
          <nav className="public-header__nav" aria-label={t('shell.navigation')}>
            <NavLink to={user && user.role === 'student' ? '/student/browse' : '/courses'}>{t('nav.browse')}</NavLink>
            <NavLink to="/become-teacher">{t('nav.becomeTeacher')}</NavLink>
            <LanguageSwitcher />
            {user ? (
              <Link className="btn btn--compact btn--sm" to={homeFor(user.role)}><span className="btn__label">{t('common.dashboard')}</span></Link>
            ) : (
              <Link className="btn btn--compact btn--sm" to="/login"><span className="btn__label">{t('nav.login')}</span></Link>
            )}
          </nav>
        </div>
      </header>
      <main id="main" className="public-main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="public-footer">
        <div className="container public-footer__links">
          <strong>{t('app.name')}</strong>
          <Link to="/terms">{t('consent.terms')}</Link>
          <Link to="/privacy">{t('consent.privacy')}</Link>
          <SupportLink />
          <Link to="/become-teacher">{t('nav.becomeTeacher')}</Link>
        </div>
      </footer>
    </>
  );
}
