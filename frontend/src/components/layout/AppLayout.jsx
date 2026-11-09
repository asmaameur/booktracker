import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  BookOpen,
  BookPlus,
  ChartColumn,
  Library,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  Menu,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Logo, ThemeToggle } from './Brand';
import NotificationBell from './NotificationBell';
import { initials } from '../../utils/format';

// `activeWhen` keeps a section highlighted on its sub-pages (a book's details
// belong to "Catalogue").
const NAVIGATION = {
  user: [
    { to: '/app', label: 'Dashboard', icon: LayoutDashboard, activeWhen: (p) => p === '/app' },
    {
      to: '/app/catalogue',
      label: 'Catalogue',
      icon: BookOpen,
      activeWhen: (p) => p.startsWith('/app/catalogue') || p.startsWith('/app/books'),
    },
    { to: '/app/library', label: 'My Library', icon: Library, activeWhen: (p) => p.startsWith('/app/library') },
    { to: '/app/stats', label: 'My reading', icon: ChartColumn, activeWhen: (p) => p.startsWith('/app/stats') },
    { to: '/app/profile', label: 'Profile', icon: UserRound, activeWhen: (p) => p.startsWith('/app/profile') },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, activeWhen: (p) => p === '/admin' },
    {
      to: '/admin/books',
      label: 'Catalogue',
      icon: LibraryBig,
      activeWhen: (p) => p.startsWith('/admin/books') && p !== '/admin/books/new',
    },
    { to: '/admin/books/new', label: 'Add a book', icon: BookPlus, activeWhen: (p) => p === '/admin/books/new' },
    { to: '/admin/users', label: 'Readers', icon: UsersRound, activeWhen: (p) => p.startsWith('/admin/users') },
    { to: '/admin/profile', label: 'Profile', icon: UserRound, activeWhen: (p) => p.startsWith('/admin/profile') },
  ],
};

const todayLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(
  new Date()
);

export default function AppLayout({ variant }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const items = NAVIGATION[variant];
  const home = variant === 'admin' ? '/admin' : '/app';

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (event) => event.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <aside className={`sidebar ${drawerOpen ? 'sidebar--open' : ''}`} aria-label="Main navigation">
        <div className="sidebar__top">
          <Logo to={home} />
          <button
            type="button"
            className="icon-btn sidebar__close"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <p className="sidebar__section-label">{variant === 'admin' ? 'Administration' : 'Reading room'}</p>
        <nav className="sidebar__nav">
          {items.map(({ to, label, icon: Icon, activeWhen }) => {
            const active = activeWhen(location.pathname);
            return (
              <Link
                key={to}
                to={to}
                className={`nav-link ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <blockquote className="sidebar__quote">
          “I declare after all there is no enjoyment like reading!”
          <cite>Jane Austen</cite>
        </blockquote>

        <div className="sidebar__footer">
          <button type="button" className="nav-link" onClick={() => logout('You have been logged out.')}>
            <LogOut aria-hidden="true" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <button
        type="button"
        className={`sidebar-backdrop ${drawerOpen ? 'sidebar-backdrop--visible' : ''}`}
        onClick={() => setDrawerOpen(false)}
        aria-label="Close menu"
        tabIndex={drawerOpen ? 0 : -1}
      />

      <div className="app-main">
        <header className="app-header">
          <button
            type="button"
            className="icon-btn app-header__menu"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
          >
            <Menu aria-hidden="true" />
          </button>
          <Logo to={home} className="app-header__logo" />
          <span className="app-header__date">{todayLabel}</span>

          <div className="app-header__end">
            <ThemeToggle />
            <NotificationBell variant={variant} />
            <Link to={`${home}/profile`} className="user-chip" aria-label={`Your profile (${user?.name})`}>
              <span className="avatar" aria-hidden="true">
                {initials(user?.name)}
              </span>
              <span className="user-chip__text">
                <span className="user-chip__name">{user?.name}</span>
                <span className="user-chip__role">{user?.role === 'admin' ? 'Administrator' : 'Reader'}</span>
              </span>
            </Link>
          </div>
        </header>

        <main id="main" className="app-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
