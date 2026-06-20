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
import { enablePush, disablePush } from '../push';

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
  const [pwOpen, setPwOpen] = useState(false);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  async function changePassword(e) {
    e.preventDefault();
    setPwSaving(true);
    try {
      await api.post('/auth/change-password/', { current_password: curPw, new_password: newPw });
      setPwOpen(false); setCurPw(''); setNewPw('');
      toast('Password changed');
    } catch (err) {
      toast(err.response?.data?.detail || 'Could not change password.');
    } finally {
      setPwSaving(false);
    }
  }

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
    if (!want) {
      setNotify(false);
      await disablePush();
      toast('Notifications turned off');
      return;
    }
    try {
      await enablePush();
      setNotify(true);
      toast('Notifications enabled');
    } catch (err) {
      setNotify(false);
      const msg = {
        unsupported: 'Notifications aren’t supported on this device.',
        'no-sw': 'Reopen the installed app to enable notifications.',
        'not-configured': 'Notifications aren’t set up on the server yet.',
        denied: 'Blocked — allow notifications in your browser settings.',
      }[err?.code] || 'Couldn’t enable notifications.';
      toast(msg);
    }
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
        <button className="m-pref-row m-pref-btn" onClick={() => setPwOpen(true)}>
          <span className="pl m-pref-ic"><Icon.Key width={18} height={18} /> Change password</span>
          <Icon.ChevronRight width={16} height={16} />
        </button>
        <div className="m-pref-row" style={{ borderBottom: 'none' }}>
          <span className="pl">Institution</span>
          <span className="pr" title={INSTITUTION}>UHAS</span>
        </div>
      </div>

      <button className="m-sign-out" onClick={handleLogout}>
        <Icon.Logout width={18} height={18} /> Sign out
      </button>

      {pwOpen && (
        <div className="m-sheet-overlay" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setPwOpen(false); }}>
          <form className="m-sheet" onSubmit={changePassword}>
            <h3 className="m-sheet-title">Change password</h3>
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="cur-pw">Current password</label>
              <input id="cur-pw" className="input" type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} required autoFocus />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="new-pw">New password</label>
              <input id="new-pw" className="input" type="password" minLength={8} placeholder="At least 8 characters" value={newPw} onChange={(e) => setNewPw(e.target.value)} required />
            </div>
            <div className="m-sheet-actions">
              <button type="button" className="btn btn-ghost btn-block" onClick={() => setPwOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-block" disabled={pwSaving}>{pwSaving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
