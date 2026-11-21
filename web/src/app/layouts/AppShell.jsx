import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthProvider';
import { activeItem } from '../nav';
import { Icon } from '../../components/Icon';
import { fileUrl } from '../../api/client';
import { LanguageSwitcher } from './LanguageSwitcher';
import { NotificationBell } from './NotificationBell';
import { CourseSearch } from './CourseSearch';
import '../../design/shell.css';

function Avatar({ user, size = 'md' }) {
  const initials = (user && user.name ? user.name : '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  if (user && user.photoUrl) return <img src={fileUrl(user.photoUrl)} alt="" className={`avatar avatar--${size}`} />;
  return <span className={`avatar avatar--${size} avatar--initials`} aria-hidden="true">{initials}</span>;
}

// Shared shell for Admin, Teacher and Student: Navy sidebar on desktop, top bar + drawer on mobile.
// `nav` is a list of groups: [{ group: i18nKey|null, items: [{ to, label, icon, end }] }].
export function AppShell({ nav, banner }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const current = activeItem(nav, location.pathname);
  const roleLabel = user ? t(`roles.${user.role}`) : '';

  useEffect(() => setOpen(false), [location.pathname]);

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="shell">
      <a className="skip-link" href="#main">{t('shell.skip')}</a>
      <aside className={`shell__sidebar${open ? ' shell__sidebar--open' : ''}`} aria-label={t('shell.navigation')}>
        <div className="shell__brand">
          <span className="shell__mark" aria-hidden="true">{t('app.name').charAt(0)}</span>
          <span className="shell__brand-text">
            <span className="shell__brand-name">{t('app.name')}</span>
            <span className="shell__brand-role">{roleLabel}</span>
          </span>
        </div>
        <nav className="shell__nav-wrap">
          {nav.map((g, gi) => (
            <div key={g.group || `g${gi}`} className="shell__group">
              {g.group && <p className="shell__group-title">{t(g.group)}</p>}
              <ul className="shell__nav">
                {g.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={() => `shell__link${current === item ? ' shell__link--active' : ''}`}
                      aria-current={current === item ? 'page' : undefined}
                    >
                      <Icon name={item.icon} size={18} />
                      <span>{t(item.label)}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="shell__sidebar-foot">
          <div className="shell__me">
            <Avatar user={user} />
            <span className="shell__me-text">
              <span className="shell__me-name">{user && user.name}</span>
              <span className="shell__me-role">{roleLabel}</span>
            </span>
          </div>
          <NavLink to="/account" className={({ isActive }) => `shell__link${isActive ? ' shell__link--active' : ''}`}>
            <Icon name="settings" size={18} /><span>{t('nav.account')}</span>
          </NavLink>
          <button type="button" className="shell__link shell__logout" onClick={onLogout}>
            <Icon name="logout" size={18} /><span>{t('common.logout')}</span>
          </button>
        </div>
      </aside>
      {open && <div className="shell__scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <div className="shell__main">
        <header className="shell__topbar">
          <button type="button" className="icon-btn shell__menu" aria-label={t('common.menu')} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <Icon name="menu" size={22} />
          </button>
          <h2 className="shell__page-title">{current ? t(current.label) : location.pathname.startsWith('/notifications') ? t('nav.notifications') : t('app.name')}</h2>
          {user && user.role === 'student' && location.pathname === '/student/browse' && <CourseSearch />}
          <div className="shell__tools">
            <LanguageSwitcher />
            <NotificationBell />
            <span className="shell__user-chip">
              <Avatar user={user} size="sm" />
              <span className="shell__user-name">{user && user.name}</span>
            </span>
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
