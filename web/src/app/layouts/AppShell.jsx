import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthProvider';
import { LanguageSwitcher } from './LanguageSwitcher';
import { NotificationBell } from './NotificationBell';
import '../../design/shell.css';

// Shared shell for Admin, Teacher and Student: Navy sidebar on desktop, top bar + drawer on mobile.
export function AppShell({ nav, banner }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setOpen(false), [location.pathname]);

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="shell">
      <a className="skip-link" href="#main">{t('shell.skip')}</a>
      <aside className={`shell__sidebar${open ? ' shell__sidebar--open' : ''}`} aria-label={t('shell.navigation')}>
        <div className="shell__brand">{t('app.name')}</div>
        <nav>
          <ul className="shell__nav">
            {nav.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={({ isActive }) => `shell__link${isActive ? ' shell__link--active' : ''}`}>
                  {t(item.label)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="shell__sidebar-foot">
          <NavLink to="/account" className="shell__link">{t('nav.account')}</NavLink>
          <button type="button" className="shell__link shell__logout" onClick={onLogout}>{t('common.logout')}</button>
        </div>
      </aside>
      {open && <div className="shell__scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <div className="shell__main">
        <header className="shell__topbar">
          <button type="button" className="icon-btn shell__menu" aria-label={t('common.menu')} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <span aria-hidden="true">☰</span>
          </button>
          <span className="shell__who">{user && user.name}</span>
          <div className="shell__tools">
            <LanguageSwitcher />
            <NotificationBell />
          </div>
        </header>
        <main id="main" className="shell__content" tabIndex={-1}>
          {banner}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
