import { useEffect, useState } from 'react';
import { NavLink, Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../api/axios';
import { Icon } from './icons';
import AppearanceControl from './AppearanceControl';
import NotificationBell from './NotificationBell';
import { TopbarProvider, useTopbarState } from './TopbarContext';

const ROLE_LABEL = { ADMIN: 'Admin', RECEPTIONIST: 'Receptionist', VC: 'Vice-Chancellor', STAFF: 'Staff', STUDENT: 'Student' };

function initials(user) {
  const name = user?.full_name || user?.email || '?';
  return name.split(/[\s@.]/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
}

function Topbar() {
  const { title, actions } = useTopbarState();
  return (
    <header className="topbar">
      <div className="tb-title">{title}</div>
      <div className="tb-actions">
        {actions}
        <NotificationBell />
        <AppearanceControl />
      </div>
    </header>
  );
}

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(null);
  const isAdmin = ['ADMIN', 'RECEPTIONIST'].includes(user?.role);
  const isVC = user?.role === 'VC';
  const canApprove = isAdmin || isVC;
  const isSuperAdmin = user?.role === 'ADMIN';

  // Pending-approvals badge for admins and VC — the backend already scopes
  // /bookings/ for VC to their own bookings + venues requiring their sign-off.
  useEffect(() => {
    if (!canApprove) return;
    api.get('/bookings/')
      .then(r => setPendingCount((r.data.results ?? r.data).filter(b => b.status === 'PENDING').length))
      .catch(() => {});
  }, [canApprove, location.pathname]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  async function handleLogout() {
    const { refreshToken } = useAuthStore.getState();
    if (refreshToken) {
      try { await api.post('/auth/logout/', { refresh: refreshToken }); } catch (_) { /* ignore */ }
    }
    logout();
    navigate('/login');
  }

  const navLink = (to, label, Ic, badge = null) => (
    <NavLink key={to} to={to} className={({ isActive }) => `sb-link${isActive ? ' active' : ''}`}>
      <Ic />
      <span>{label}</span>
      {badge != null && badge > 0 && (
        <span className="badge badge-accent" style={{ marginLeft: 'auto', fontSize: '.6rem', padding: '.15em .5em' }}>{badge}</span>
      )}
    </NavLink>
  );

  const sidebar = (
    <>
      <Link className="sb-brand" to="/">
        <span className="sb-mark">V</span><span className="sb-word">VenU</span>
      </Link>
      <nav className="sb-nav">
        <div className="sb-section">Workspace</div>
        {navLink('/dashboard', 'Dashboard', Icon.Dash)}
        {navLink('/venues', 'Venues', Icon.Venues)}
        {navLink('/timetable', 'Find a room', Icon.Calendar)}
        {navLink('/book', 'Book a room', Icon.Book)}
        {canApprove && (
          <>
            <div className="sb-section">Administration</div>
            {isAdmin && navLink('/desk', 'Front desk', Icon.Key)}
            {navLink('/admin/approvals', 'Approvals', Icon.Approvals, pendingCount)}
            {isSuperAdmin && navLink('/admin/venues', 'Manage venues', Icon.Manage)}
            {isSuperAdmin && navLink('/admin/users', 'Users', Icon.Users)}
            {isSuperAdmin && navLink('/admin/reports', 'Reports', Icon.Dash)}
            {isSuperAdmin && navLink('/admin/settings', 'Settings', Icon.Settings)}
          </>
        )}
      </nav>
      <div className="sb-user">
        <span className="avatar">{initials(user)}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="nm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.full_name || user?.email?.split('@')[0]}
          </div>
          <div className="rl">{ROLE_LABEL[user?.role] || user?.role}</div>
        </div>
        <button
          className="icon-btn"
          onClick={handleLogout}
          title="Log out"
          aria-label="Log out"
          style={{ width: 32, height: 32, border: 'none', background: 'transparent' }}
        >
          <Icon.Logout />
        </button>
      </div>
    </>
  );

  return (
    <TopbarProvider>
      <div className="app">
        <aside className={`sidebar${mobileOpen ? ' open' : ''}`}>{sidebar}</aside>
        <div className={`scrim${mobileOpen ? ' show' : ''}`} onClick={() => setMobileOpen(false)} />
        <main className="main">
          <div className="mobile-bar">
            <button className="icon-btn" aria-label="Menu" onClick={() => setMobileOpen(true)}>
              <Icon.Menu />
            </button>
            <Link className="sb-brand" style={{ padding: 0 }} to="/">
              <span className="sb-mark" style={{ width: 26, height: 26, fontSize: '.95rem' }}>V</span>
              <span className="sb-word" style={{ fontSize: '1.1rem' }}>VenU</span>
            </Link>
            <span style={{ width: 40 }} />
          </div>
          <Topbar />
          <Outlet />
        </main>
      </div>
    </TopbarProvider>
  );
}
