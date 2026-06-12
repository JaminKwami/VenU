import { useEffect, useState } from 'react';
import api from '../api/axios';
import { usePageTitle } from '../hooks/usePageTitle';
import { useReveal } from '../hooks/useReveal';
import { useTopbar } from '../components/TopbarContext';
import { Icon } from '../components/icons';

const firstError = v => (Array.isArray(v) ? v[0] : typeof v === 'object' ? Object.values(v)[0] : v);

// ── Auto-approval rules ───────────────────────────────────────────────────────

function RuleRow({ rule, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  async function del() {
    if (!confirm('Delete this rule?')) return;
    setDeleting(true);
    try {
      await api.delete(`/bookings/approval-rules/${rule.id}/`);
      onDelete(rule.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <tr>
      <td>{rule.venue_name || <span className="muted">All venues</span>}</td>
      <td className="mono">{rule.max_attendees}</td>
      <td className="mono">{rule.max_duration_hours}h</td>
      <td className="mono">{rule.min_notice_hours}h notice</td>
      <td>
        <span className={`badge ${rule.enabled ? 'badge-approved' : 'badge-neutral'}`}>
          <span className="dot" />{rule.enabled ? 'Active' : 'Disabled'}
        </span>
      </td>
      <td>
        <button className="btn btn-ghost btn-sm" onClick={del} disabled={deleting} title="Delete">
          <Icon.X width={14} height={14} />
        </button>
      </td>
    </tr>
  );
}

function NewRuleForm({ venues, onCreated }) {
  const [form, setForm] = useState({ venue: '', max_attendees: 20, max_duration_hours: 2, min_notice_hours: 24 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        max_attendees: Number(form.max_attendees),
        max_duration_hours: Number(form.max_duration_hours),
        min_notice_hours: Number(form.min_notice_hours),
      };
      if (form.venue) payload.venue = Number(form.venue);
      const res = await api.post('/bookings/approval-rules/', payload);
      onCreated(res.data);
      setForm({ venue: '', max_attendees: 20, max_duration_hours: 2, min_notice_hours: 24 });
    } catch (err) {
      setError(firstError(err.response?.data) || 'Could not save rule.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings-inline-form" onSubmit={submit}>
      <div className="field" style={{ flex: '1 1 180px' }}>
        <label>Venue (optional)</label>
        <select className="select" value={form.venue} onChange={e => set('venue', e.target.value)}>
          <option value="">All venues (global)</option>
          {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>
      <div className="field" style={{ flex: '0 0 120px' }}>
        <label>Max attendees</label>
        <input className="input" type="number" min="1" value={form.max_attendees} onChange={e => set('max_attendees', e.target.value)} />
      </div>
      <div className="field" style={{ flex: '0 0 120px' }}>
        <label>Max duration (h)</label>
        <input className="input" type="number" min="0.5" step="0.5" value={form.max_duration_hours} onChange={e => set('max_duration_hours', e.target.value)} />
      </div>
      <div className="field" style={{ flex: '0 0 130px' }}>
        <label>Min notice (h)</label>
        <input className="input" type="number" min="0" value={form.min_notice_hours} onChange={e => set('min_notice_hours', e.target.value)} />
      </div>
      <div className="field" style={{ flex: '0 0 auto', alignSelf: 'flex-end' }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add rule'}</button>
      </div>
      {error && <div className="field-error" style={{ flex: '1 1 100%' }}>{error}</div>}
    </form>
  );
}

// ── Term / holiday dates ──────────────────────────────────────────────────────

function TermRow({ term, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  async function del() {
    if (!confirm(`Delete "${term.name}"?`)) return;
    setDeleting(true);
    try {
      await api.delete(`/bookings/term-dates/${term.id}/`);
      onDelete(term.id);
    } finally {
      setDeleting(false);
    }
  }

  const fmt = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <tr>
      <td style={{ fontWeight: 600 }}>{term.name}</td>
      <td className="mono">{fmt(term.start_date)}</td>
      <td className="mono">{fmt(term.end_date)}</td>
      <td>
        <span className={`badge ${term.skip_in_recurrence ? 'badge-pending' : 'badge-neutral'}`}>
          <span className="dot" />{term.skip_in_recurrence ? 'Skipped in recurrence' : 'Info only'}
        </span>
      </td>
      <td>
        <button className="btn btn-ghost btn-sm" onClick={del} disabled={deleting} title="Delete">
          <Icon.X width={14} height={14} />
        </button>
      </td>
    </tr>
  );
}

function NewTermForm({ onCreated }) {
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '', skip_in_recurrence: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.start_date || !form.end_date) {
      setError('Name, start date and end date are all required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/bookings/term-dates/', { ...form });
      onCreated(res.data);
      setForm({ name: '', start_date: '', end_date: '', skip_in_recurrence: true });
    } catch (err) {
      setError(firstError(err.response?.data) || 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings-inline-form" onSubmit={submit}>
      <div className="field" style={{ flex: '1 1 200px' }}>
        <label>Period name</label>
        <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Winter Break 2026" />
      </div>
      <div className="field" style={{ flex: '0 0 150px' }}>
        <label>Start date</label>
        <input className="input" type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
      </div>
      <div className="field" style={{ flex: '0 0 150px' }}>
        <label>End date</label>
        <input className="input" type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
      </div>
      <div className="field" style={{ flex: '0 0 auto', alignSelf: 'flex-end' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer', height: '2.4rem' }}>
          <input type="checkbox" checked={form.skip_in_recurrence} onChange={e => set('skip_in_recurrence', e.target.checked)} />
          Skip in recurrence
        </label>
      </div>
      <div className="field" style={{ flex: '0 0 auto', alignSelf: 'flex-end' }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add period'}</button>
      </div>
      {error && <div className="field-error" style={{ flex: '1 1 100%' }}>{error}</div>}
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  usePageTitle('Admin Settings');
  useTopbar('Admin Settings', null);
  const [rules, setRules]   = useState(null);
  const [terms, setTerms]   = useState(null);
  const [venues, setVenues] = useState([]);
  const revealRef = useReveal([rules != null, terms != null]);

  useEffect(() => {
    api.get('/bookings/approval-rules/').then(r => setRules(r.data)).catch(() => setRules([]));
    api.get('/bookings/term-dates/').then(r => setTerms(r.data)).catch(() => setTerms([]));
    api.get('/venues/').then(r => setVenues(r.data)).catch(() => {});
  }, []);

  return (
    <div className="page" style={{ maxWidth: 1100 }} ref={revealRef}>
      <div className="page-head reveal">
        <span className="eyebrow">Administration</span>
        <h1>Settings</h1>
        <p>Configure auto-approval rules and block out academic calendar periods.</p>
      </div>

      {/* ── Auto-approval rules ── */}
      <div className="card reveal" style={{ marginBottom: '1.4rem' }}>
        <div className="card-head">
          <div>
            <h3>Auto-approval rules</h3>
            <p className="muted" style={{ fontSize: '.85rem', marginTop: '.3rem' }}>
              Bookings that match all criteria below are approved instantly — no admin action needed.
              A global rule (no venue) applies everywhere; a venue-specific rule takes precedence.
            </p>
          </div>
        </div>

        {rules && rules.length > 0 && (
          <div className="table-wrap" style={{ borderRadius: 0, boxShadow: 'none', border: 'none', borderBottom: '1px solid var(--line)' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Venue</th>
                  <th>Max attendees</th>
                  <th>Max duration</th>
                  <th>Min notice</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rules.map(r => (
                  <RuleRow key={r.id} rule={r} onDelete={id => setRules(prev => prev.filter(x => x.id !== id))} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rules && rules.length === 0 && (
          <div className="empty" style={{ padding: '1.5rem 1.3rem' }}>
            <span>No rules yet — all new bookings go to the approval queue.</span>
          </div>
        )}

        <div style={{ padding: '1.2rem 1.3rem', borderTop: rules?.length ? '1px solid var(--line)' : 'none' }}>
          <div className="eyebrow" style={{ marginBottom: '.8rem' }}>Add rule</div>
          {venues && <NewRuleForm venues={venues} onCreated={r => setRules(prev => [...(prev || []), r])} />}
        </div>
      </div>

      {/* ── Term / holiday dates ── */}
      <div className="card reveal" data-d="1">
        <div className="card-head">
          <div>
            <h3>Academic calendar</h3>
            <p className="muted" style={{ fontSize: '.85rem', marginTop: '.3rem' }}>
              Define terms, reading weeks and holiday breaks. Recurring booking series will skip
              dates inside any period marked "skip in recurrence".
            </p>
          </div>
        </div>

        {terms && terms.length > 0 && (
          <div className="table-wrap" style={{ borderRadius: 0, boxShadow: 'none', border: 'none', borderBottom: '1px solid var(--line)' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Recurrence</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {terms.map(t => (
                  <TermRow key={t.id} term={t} onDelete={id => setTerms(prev => prev.filter(x => x.id !== id))} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {terms && terms.length === 0 && (
          <div className="empty" style={{ padding: '1.5rem 1.3rem' }}>
            <span>No academic calendar periods defined yet.</span>
          </div>
        )}

        <div style={{ padding: '1.2rem 1.3rem', borderTop: terms?.length ? '1px solid var(--line)' : 'none' }}>
          <div className="eyebrow" style={{ marginBottom: '.8rem' }}>Add period</div>
          <NewTermForm onCreated={t => setTerms(prev => [...(prev || []), t])} />
        </div>
      </div>
    </div>
  );
}
