import { useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import styles from './Layout.module.css';

/* â”€â”€ Inline SVG icons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const Icon = {
  Dashboard: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  Venues: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  Book: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      <line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/>
    </svg>
  ),
  Approvals: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  ManageVenues: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
    </svg>
  ),
  Logout: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  Menu: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
  Close: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
};

const NAV = [
  { to: '/dashboard', label: 'Dashboard',  Icon: Icon.Dashboard },
  { to: '/venues',    label: 'Venues',      Icon: Icon.Venues    },
  { to: '/book',      label: 'New Booking', Icon: Icon.Book      },
];

const ADMIN_NAV = [
  { to: '/admin/approvals', label: 'Approvals',     Icon: Icon.Approvals    },
  { to: '/admin/venues',    label: 'Manage Venues', Icon: Icon.ManageVenues },
];

function initials(user) {
  if (!user) return '?';
  const name = user.full_name || user.email || '';
  return name.split(/[\s@]/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
}

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'STAFF';

  function handleLogout() { logout(); navigate('/login'); }

  const navLinks = (onClick) => (
    <>
      {NAV.map(({ to, label, Icon: Ic }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `${styles.navLink}${isActive ? ' ' + styles.active : ''}`}
          onClick={onClick}
        >
          <Ic />{label}
        </NavLink>
      ))}
      {isAdmin && ADMIN_NAV.map(({ to, label, Icon: Ic }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `${styles.navLink}${isActive ? ' ' + styles.active : ''}`}
          onClick={onClick}
        >
          <Ic />{label}
        </NavLink>
      ))}
    </>
  );

  return (
    <div className={styles.shell}>
      {/* Desktop sidebar */}
      <aside className={styles.desktopSidebar}>
        <div className={styles.logoRow}>
          <span className={styles.logoMark} />
          <span className={styles.logoText}>VenU</span>
        </div>

        <nav className={styles.navSection}>{navLinks()}</nav>

        <div className={styles.userRow}>
          <span className="avatar">{initials(user)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.full_name || user?.email?.split('@')[0]}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.role}
            </div>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout} title="Sign out">
            <Icon.Logout />
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className={styles.mobileHeader}>
        <div className={styles.logoRow} style={{ flex: 1 }}>
          <span className={styles.logoMark} />
          <span className={styles.logoText}>VenU</span>
        </div>
        <button className={styles.hamburger} onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Icon.Menu />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div className={styles.mobileOverlay} onClick={() => setMobileOpen(false)} />
          <aside className={styles.mobileDrawer}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem 0.5rem' }}>
              <div className={styles.logoRow}>
                <span className={styles.logoMark} />
                <span className={styles.logoText}>VenU</span>
              </div>
              <button className={styles.hamburger} onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <Icon.Close />
              </button>
            </div>
            <nav className={styles.navSection}>{navLinks(() => setMobileOpen(false))}</nav>
            <div className={styles.userRow}>
              <span className="avatar">{initials(user)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.full_name || user?.email?.split('@')[0]}
                </div>
              </div>
              <button className={styles.logoutBtn} onClick={handleLogout} title="Sign out">
                <Icon.Logout />
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Main content */}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
