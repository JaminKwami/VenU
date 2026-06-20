import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import { useAppearanceStore, ACCENTS } from '../store/appearanceStore';
import { usePageTitle } from '../hooks/usePageTitle';
import { Icon } from '../components/icons';
import { initials } from './mobileUi';
import { useFeedback } from './MobileFeedback';
import { INSTITUTION, INSTITUTION_FULL } from '../constants';

const ROLE_LABEL = { ADMIN: 'Admin', RECEPTIONIST: 'Receptionist', STAFF: 'Staff', STUDENT: 'Student' };

function Toggle({ on, onChange, label }) {
  return (
    <button
      className={`m-tog${on ? ' on' : ''}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
    />
  );
}

export default function ProfileScreen() {
  usePageTitle('Profile');
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, accent, setAppearance } = useAppearanceStore();
  const { toast } = useFeedback();
  const [notify, setNotify] = useState(() => typeof Notification !== 'undefined' && Notification.permission === 'granted');

  const name = user?.full_name || user?.email?.split('@')[0] || 'You';
  const role = user?.role;
  const isAdmin = ['ADMIN', 'RECEPTIONIST'].includes(role);
  const isSuperAdmin = role === 'ADMIN';

  function cycleAccent() {
    const idx = ACCENTS.findIndex((a) => a.id === accent);
    const next = ACCENTS[(idx + 1) % ACCENTS.length];
    setAppearance('accent', next.id);
  }

  async function enableNotifications(want) {
    if (!want) { setNotify(false); toast('Notifications turned off'); return; }
    if (typeof Notification === 'undefined') { toast('Notifications aren’t supported on this device.'); return; }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') { setNotify(true); toast('Notifications enabled'); }
    else { setNotify(false); toast(perm === 'denied' ? 'Blocked in browser settings' : 'Permission not granted'); }
  }

  async function handleLogout() {
    const { refreshToken } = useAuthStore.getState();
    if (refreshToken) {
      try { await api.post('/auth/logout/', { refresh: refreshToken }); } catch { /* ignore */ }
    }
    logout();
    navigate('/login');
  }

  const accentLabel = (accent || 'cobalt').charAt(0).toUpperCase() + (accent || 'cobalt').slice(1);

  return (
    <>
      <div className="m-profile-hero">
        <div className="m-profile-av">{initials(name)}</div>
        <div>
          <h2>{name}</h2>
          <div className="m-profile-email">{user?.email}</div>
          <div className="m-profile-inst">{INSTITUTION_FULL}</div>
        </div>
        <span className="m-role-pill">{ROLE_LABEL[role] || role}</span>
      </div>

      {isAdmin && (
        <>
          <div className="m-section-title">{isSuperAdmin ? 'Administration' : 'Staff tools'}</div>
          <div className="card m-pref-card">
            <button className="m-pref-row m-pref-btn" onClick={() => navigate('/approvals')}>
              <span className="pl m-pref-ic"><Icon.Approvals width={18} height={18} /> Approvals</span>
              <Icon.ChevronRight width={16} height={16} />
            </button>
            {isSuperAdmin && (
              <>
                <button className="m-pref-row m-pref-btn" onClick={() => navigate('/admin/venues')}>
                  <span className="pl m-pref-ic"><Icon.Manage width={18} height={18} /> Manage venues</span>
                  <Icon.ChevronRight width={16} height={16} />
                </button>
                <button className="m-pref-row m-pref-btn" onClick={() => navigate('/admin/users')}>
                  <span className="pl m-pref-ic"><Icon.Users width={18} height={18} /> Manage users</span>
                  <Icon.ChevronRight width={16} height={16} />
                </button>
                <button className="m-pref-row m-pref-btn" style={{ borderBottom: 'none' }} onClick={() => navigate('/admin/settings')}>
                  <span className="pl m-pref-ic"><Icon.Settings width={18} height={18} /> Settings</span>
                  <Icon.ChevronRight width={16} height={16} />
                </button>
              </>
            )}
          </div>
        </>
      )}

      <div className="m-section-title">Preferences</div>
      <div className="card m-pref-card">
        <div className="m-pref-row">
          <span className="pl">Dark mode</span>
          <Toggle on={theme === 'dark'} onChange={(v) => setAppearance('theme', v ? 'dark' : 'light')} label="Toggle dark mode" />
        </div>
        <div className="m-pref-row">
          <span className="pl">Notifications</span>
          <Toggle on={notify} onChange={enableNotifications} label="Toggle notifications" />
        </div>
        <button className="m-pref-row m-pref-btn" onClick={cycleAccent}>
          <span className="pl">Appearance</span>
          <span className="pr">
            <span className="m-accent-dot" style={{ background: ACCENTS.find((a) => a.id === accent)?.color || 'var(--accent)' }} />
            {accentLabel} <Icon.ChevronRight width={16} height={16} />
          </span>
        </button>
        <div className="m-pref-row" style={{ borderBottom: 'none' }}>
          <span className="pl">Institution</span>
          <span className="pr" title={INSTITUTION}>UHAS</span>
        </div>
      </div>

      <button className="m-sign-out" onClick={handleLogout}>
        <Icon.Logout width={18} height={18} /> Sign out
      </button>
    </>
  );
}
