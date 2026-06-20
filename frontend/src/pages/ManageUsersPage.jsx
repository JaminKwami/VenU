import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/axios';
import { usePageTitle } from '../hooks/usePageTitle';
import { useReveal } from '../hooks/useReveal';
import { useTopbar } from '../components/TopbarContext';
import { useAuthStore } from '../store/authStore';
import { Icon } from '../components/icons';

const ROLE_LABEL = {
  ADMIN:        'Admin',
  RECEPTIONIST: 'Receptionist',
  STAFF:        'Staff',
  STUDENT:      'Student',
};

const ROLE_DESCRIPTIONS = {
  ADMIN:        'Full access — venues, users, settings, approvals.',
  RECEPTIONIST: 'Approve/decline requests, kiosk check-in, view all bookings.',
  STAFF:        'Books spaces. May qualify for auto-approval rules.',
  STUDENT:      'Browse venues, create and cancel own bookings.',
};

function initials(name) {
  return (name || '?').split(/[\s@.]/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
}

function roleClass(role) {
  return role?.toLowerCase() || 'student';
}

export default function ManageUsersPage() {
  usePageTitle('Users');
  const { user: me } = useAuthStore();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [acting, setActing] = useState(null);
  const [error, setError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(null);
  const revealRef = useReveal([users != null]);

  useTopbar('Users', tab === 'users' ? (
    <button className="btn btn-primary btn-sm" onClick={() => setInviteOpen(true)}>
      <Icon.Plus width={15} height={15} /> Invite user
    </button>
  ) : null);

  useEffect(() => {
    api.get('/auth/users/').then(r => setUsers(r.data.results ?? r.data)).catch(() => setUsers([]));
  }, []);

  const all = users || [];
  const stats = useMemo(() => ({
    total: all.length,
    admins: all.filter(u => u.role === 'ADMIN').length,
    receptionists: all.filter(u => u.role === 'RECEPTIONIST').length,
    students: all.filter(u => ['STUDENT', 'STAFF'].includes(u.role)).length,
  }), [all]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return all.filter(u =>
      (!q || (u.full_name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) &&
      (roleFilter === 'All' || u.role === roleFilter) &&
      (statusFilter === 'Active' ? u.is_active !== false : statusFilter === 'Inactive' ? u.is_active === false : true),
    );
  }, [all, search, roleFilter, statusFilter]);

  async function updateUser(id, patch) {
    setActing(id);
    setError('');
    try {
      const res = await api.patch(`/auth/users/${id}/`, patch);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...res.data } : u));
    } catch (err) {
      setError(err.response?.data?.detail || 'Update failed.');
    } finally {
      setActing(null);
    }
  }

  async function deactivateUser(id) {
    if (!confirm('Deactivate this user? They will not be able to log in.')) return;
    setActing(id);
    setError('');
    try {
      await api.delete(`/auth/users/${id}/`);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: false } : u));
    } catch (err) {
      setError(err.response?.data?.detail || 'Deactivation failed.');
    } finally {
      setActing(null);
    }
  }

  async function resetPassword(id) {
    setResetConfirm(null);
    setActing(id);
    setError('');
    try {
      await api.post(`/auth/users/${id}/reset-password/`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Password reset failed.');
    } finally {
      setActing(null);
    }
  }

  const loading = users == null;

  return (
    <>
    <div className="page" style={{ maxWidth: 1200 }} ref={revealRef}>
      <div className="page-head reveal">
        <span className="eyebrow">Administration</span>
        <h1>Users</h1>
        <p>Manage roles, access and account status for everyone on the platform.</p>
      </div>

      <div className="filters reveal" style={{ marginBottom: '1.2rem' }}>
        <button className={`chip${tab === 'users' ? ' active' : ''}`} onClick={() => setTab('users')}>Users</button>
        <button className={`chip${tab === 'enrollment' ? ' active' : ''}`} onClick={() => setTab('enrollment')}>Enrollment</button>
      </div>

      {tab === 'enrollment' && <EnrollmentTab />}

      {tab === 'users' && <>
      <div className="mg-stats reveal">
        <div className="card stat-card"><div className="stat-label">Total users</div><div className="stat-val">{loading ? '—' : stats.total}</div></div>
        <div className="card stat-card"><div className="stat-label">Admins</div><div className="stat-val">{loading ? '—' : stats.admins}</div></div>
        <div className="card stat-card"><div className="stat-label">Receptionists</div><div className="stat-val">{loading ? '—' : stats.receptionists}</div></div>
        <div className="card stat-card"><div className="stat-label">Students &amp; staff</div><div className="stat-val">{loading ? '—' : stats.students}</div></div>
      </div>

      {error && (
        <div className="conflict reveal in" style={{ marginBottom: '1rem' }}>
          <Icon.X strokeWidth={2} /><span>{error}</span>
        </div>
      )}

      <div className="toolbar reveal">
        <div className="search-box" style={{ maxWidth: 280 }}>
          <Icon.Search />
          <input className="input" placeholder="Search name or email…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select" style={{ maxWidth: 160 }} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="All">All roles</option>
          {Object.keys(ROLE_LABEL).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <select className="select" style={{ maxWidth: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="All">All</option>
        </select>
        <span className="count-label" style={{ marginLeft: 'auto' }}>{filtered.length} user{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="table-wrap reveal">
        <table className="tbl">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th className="hide-sm">Joined</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && [1, 2, 3, 4].map(i => (
              <tr key={i}>
                <td><div className="skeleton" style={{ height: 14, width: '60%' }} /></td>
                <td><div className="skeleton" style={{ height: 14, width: '80px' }} /></td>
                <td className="hide-sm"><div className="skeleton" style={{ height: 14, width: '70px' }} /></td>
                <td><div className="skeleton" style={{ height: 14, width: '50px' }} /></td>
                <td />
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--ink-45)' }}>No users match those filters.</td></tr>
            )}
            {!loading && filtered.map(u => (
              <tr key={u.id} style={{ opacity: u.is_active === false ? 0.5 : 1 }}>
                <td>
                  <div className="vcell">
                    <span className="avatar" style={{ background: 'var(--canvas-2)', color: 'var(--ink-65)', fontSize: '.75rem' }}>
                      {initials(u.full_name || u.email)}
                    </span>
                    <div>
                      <div className="vn">{u.full_name || '—'}</div>
                      <div className="vl">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  {u.id === me?.id ? (
                    <span className={`role-sel ${roleClass(u.role)}`}>{ROLE_LABEL[u.role]}</span>
                  ) : (
                    <select
                      className={`role-sel ${roleClass(u.role)}`}
                      value={u.role}
                      disabled={acting === u.id}
                      onChange={e => updateUser(u.id, { role: e.target.value })}
                    >
                      {Object.keys(ROLE_LABEL).map(r => (
                        <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="hide-sm" style={{ color: 'var(--ink-45)', fontSize: '.82rem', fontFamily: 'var(--font-mono)' }}>
                  {u.date_joined ? new Date(u.date_joined).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </td>
                <td>
                  <button
                    type="button"
                    className={`toggle${u.is_active !== false ? ' on' : ''}`}
                    title={u.id === me?.id ? 'Cannot deactivate yourself' : u.is_active !== false ? 'Deactivate' : 'Activate'}
                    disabled={u.id === me?.id || acting === u.id}
                    onClick={() => u.is_active !== false ? deactivateUser(u.id) : updateUser(u.id, { is_active: true })}
                    aria-label={u.is_active !== false ? 'Deactivate user' : 'Activate user'}
                  />
                </td>
                <td>
                  <div className="row-act">
                    <button
                      type="button"
                      title="Send password reset"
                      disabled={acting === u.id}
                      onClick={() => setResetConfirm(u)}
                      aria-label="Reset password"
                    >
                      <Icon.Key width={15} height={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>}
    </div>

    {inviteOpen && (
      <InviteModal
        onClose={() => setInviteOpen(false)}
        onInvited={newUser => {
          setUsers(prev => [newUser, ...(prev || [])]);
          setInviteOpen(false);
        }}
      />
    )}

    {resetConfirm && (
      <div className="modal-scrim" onClick={() => setResetConfirm(null)}>
        <div className="modal-card" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
          <h3>Reset password</h3>
          <p style={{ color: 'var(--ink-65)', marginBottom: '1.2rem' }}>
            Send a temporary password to <b>{resetConfirm.email}</b>? They will be prompted to change it on next login.
          </p>
          <div className="row" style={{ gap: '.6rem' }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setResetConfirm(null)}>Cancel</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => resetPassword(resetConfirm.id)}>Send reset</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function EnrollmentTab() {
  const [domains, setDomains] = useState([]);
  const [links, setLinks] = useState([]);
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [linksLoading, setLinksLoading] = useState(true);
  const [newDomain, setNewDomain] = useState('');
  const [newDomainRole, setNewDomainRole] = useState('STUDENT');
  const [addingDomain, setAddingDomain] = useState(false);
  const [domainError, setDomainError] = useState('');
  const [newLinkRole, setNewLinkRole] = useState('STUDENT');
  const [newLinkLimit, setNewLinkLimit] = useState(0);
  const [newLinkNote, setNewLinkNote] = useState('');
  const [addingLink, setAddingLink] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    api.get('/auth/enrollment/domains/').then(r => { setDomains(r.data); setDomainsLoading(false); }).catch(() => { setDomains([]); setDomainsLoading(false); });
    api.get('/auth/enrollment/links/').then(r => { setLinks(r.data); setLinksLoading(false); }).catch(() => { setLinks([]); setLinksLoading(false); });
  }, []);

  async function addDomain(e) {
    e.preventDefault();
    setAddingDomain(true);
    setDomainError('');
    try {
      const res = await api.post('/auth/enrollment/domains/', { domain: newDomain, default_role: newDomainRole });
      setDomains(prev => [...(prev || []), res.data]);
      setNewDomain('');
    } catch (err) {
      setDomainError(err.response?.data?.domain?.[0] || err.response?.data?.detail || 'Failed to add domain.');
    } finally {
      setAddingDomain(false);
    }
  }

  async function removeDomain(id) {
    await api.delete(`/auth/enrollment/domains/${id}/`);
    setDomains(prev => prev.filter(d => d.id !== id));
  }

  async function createLink(e) {
    e.preventDefault();
    setAddingLink(true);
    setLinkError('');
    try {
      const res = await api.post('/auth/enrollment/links/', { default_role: newLinkRole, uses_limit: Number(newLinkLimit), note: newLinkNote });
      setLinks(prev => [res.data, ...(prev || [])]);
      setNewLinkNote('');
    } catch (err) {
      setLinkError(err.response?.data?.detail || 'Failed to create link.');
    } finally {
      setAddingLink(false);
    }
  }

  async function toggleLink(link) {
    const res = await api.patch(`/auth/enrollment/links/${link.id}/`, { is_active: !link.is_active });
    setLinks(prev => prev.map(l => l.id === link.id ? res.data : l));
  }

  function copyLink(token) {
    const url = `${window.location.origin}/login?token=${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div className="stack" style={{ gap: '1.4rem' }}>
      <div className="card card-pad reveal">
        <h3 style={{ marginBottom: '.3rem' }}>Allowed email domains</h3>
        <p className="muted" style={{ fontSize: '.86rem', marginBottom: '1.2rem' }}>Anyone with a matching email domain can self-register without an admin invite.</p>
        {domainsLoading && <p className="muted" style={{ fontSize: '.86rem' }}>Loading…</p>}
        {!domainsLoading && (domains || []).map(d => (
          <div key={d.id} className="enrollment-row">
            <span className="enr-domain">@{d.domain}</span>
            <span className={`role-sel ${d.default_role.toLowerCase()}`} style={{ pointerEvents: 'none' }}>{ROLE_LABEL[d.default_role]}</span>
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', color: 'var(--danger)' }} onClick={() => removeDomain(d.id)}>Remove</button>
          </div>
        ))}
        {domains.length === 0 && <p className="muted" style={{ fontSize: '.86rem' }}>No domains added yet.</p>}
        <form className="row" style={{ gap: '.7rem', marginTop: '1rem', flexWrap: 'wrap' }} onSubmit={addDomain}>
          <input className="input" style={{ flex: '1 1 180px' }} placeholder="e.g. campus.edu" value={newDomain} onChange={e => setNewDomain(e.target.value)} />
          <select className="select" style={{ maxWidth: 140 }} value={newDomainRole} onChange={e => setNewDomainRole(e.target.value)}>
            {Object.keys(ROLE_LABEL).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" type="submit" disabled={!newDomain || addingDomain}>Add domain</button>
        </form>
        {domainError && <p style={{ color: 'var(--danger)', fontSize: '.82rem', marginTop: '.5rem' }}>{domainError}</p>}
      </div>

      <div className="card card-pad reveal">
        <h3 style={{ marginBottom: '.3rem' }}>Enrolment links</h3>
        <p className="muted" style={{ fontSize: '.86rem', marginBottom: '1.2rem' }}>Share these links to let people self-register with a specific role. Optional use limits and expiry.</p>
        {linksLoading && <p className="muted" style={{ fontSize: '.86rem' }}>Loading…</p>}
        {!linksLoading && (links || []).map(l => (
          <div key={l.id} className={`enrollment-row${!l.is_valid ? ' dim' : ''}`}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.72rem', color: 'var(--ink-45)', marginBottom: '.2rem' }}>
                {l.note || `Link #${l.id}`}
              </div>
              <div className="row" style={{ gap: '.5rem', flexWrap: 'wrap' }}>
                <span className={`role-sel ${l.default_role.toLowerCase()}`} style={{ pointerEvents: 'none' }}>{ROLE_LABEL[l.default_role]}</span>
                <span className="badge badge-neutral">{l.uses_limit ? `${l.uses_count}/${l.uses_limit} uses` : `${l.uses_count} uses`}</span>
                {!l.is_valid && <span className="badge badge-cancelled">Inactive</span>}
              </div>
            </div>
            <button
              className="btn btn-outline btn-sm"
              style={{ fontSize: '.75rem' }}
              onClick={() => copyLink(l.token)}
            >
              {copied === l.token ? 'Copied!' : 'Copy link'}
            </button>
            <button
              className={`toggle${l.is_active ? ' on' : ''}`}
              title={l.is_active ? 'Deactivate' : 'Activate'}
              onClick={() => toggleLink(l)}
            />
          </div>
        ))}
        {links.length === 0 && <p className="muted" style={{ fontSize: '.86rem' }}>No enrolment links yet.</p>}
        <form className="row" style={{ gap: '.7rem', marginTop: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={createLink}>
          <div className="field" style={{ flex: '1 1 140px', marginBottom: 0 }}>
            <label style={{ fontSize: '.72rem' }}>Role</label>
            <select className="select" value={newLinkRole} onChange={e => setNewLinkRole(e.target.value)}>
              {Object.keys(ROLE_LABEL).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: '0 0 100px', marginBottom: 0 }}>
            <label style={{ fontSize: '.72rem' }}>Max uses (0=∞)</label>
            <input className="input" type="number" min="0" value={newLinkLimit} onChange={e => setNewLinkLimit(e.target.value)} />
          </div>
          <div className="field" style={{ flex: '1 1 160px', marginBottom: 0 }}>
            <label style={{ fontSize: '.72rem' }}>Note (optional)</label>
            <input className="input" placeholder="e.g. Cohort 2026" value={newLinkNote} onChange={e => setNewLinkNote(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-sm" type="submit" disabled={addingLink}>Generate link</button>
        </form>
        {linkError && <p style={{ color: 'var(--danger)', fontSize: '.82rem', marginTop: '.5rem' }}>{linkError}</p>}
      </div>
    </div>
  );
}

function InviteModal({ onClose, onInvited }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('STUDENT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/register/', {
        first_name: firstName,
        last_name: lastName,
        email,
        password,
        role,
      });
      onInvited(res.data);
    } catch (err) {
      const data = err.response?.data;
      setError(data?.email?.[0] || data?.detail || data?.password?.[0] || 'Invite failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h3>Invite user</h3>

        <div className="role-tiles">
          {Object.entries(ROLE_LABEL).map(([r, label]) => (
            <button
              key={r}
              type="button"
              className={`role-tile${role === r ? ' on' : ''}`}
              onClick={() => setRole(r)}
            >
              <span className="rt-name">{label}</span>
              <span className="rt-desc">{ROLE_DESCRIPTIONS[r]}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: '1.2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.7rem', marginBottom: '.7rem' }}>
            <div className="field">
              <label htmlFor="inv-fname">First name</label>
              <input id="inv-fname" className="input" value={firstName} onChange={e => setFirstName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="inv-lname">Last name</label>
              <input id="inv-lname" className="input" value={lastName} onChange={e => setLastName(e.target.value)} required />
            </div>
          </div>
          <div className="field" style={{ marginBottom: '.7rem' }}>
            <label htmlFor="inv-email">Email</label>
            <input id="inv-email" className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: '1rem' }}>
            <label htmlFor="inv-password">Temporary password</label>
            <input id="inv-password" className="input" type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <p style={{ color: 'var(--danger)', fontSize: '.85rem', marginBottom: '.8rem' }}>{error}</p>}
          <div className="row" style={{ gap: '.6rem' }}>
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? 'Sending…' : 'Send invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
