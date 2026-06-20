import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { usePageTitle } from '../hooks/usePageTitle';
import { useReveal } from '../hooks/useReveal';
import { useTopbar } from '../components/TopbarContext';
import { Icon } from '../components/icons';

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

async function downloadCsv(days) {
  const res = await api.get('/bookings/export-csv/', { params: { days }, responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'venu-bookings.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function Kpi({ label, value, suffix, tone }) {
  return (
    <div className="card stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-val" style={{ color: tone }}>
        {value}{suffix && <span style={{ fontSize: '1rem', fontWeight: 500 }}>{suffix}</span>}
      </div>
    </div>
  );
}

/* Vertical bar chart (peak hours / daily). */
function BarChart({ data, labelKey, valueKey, height = 140, format = (v) => v }) {
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  return (
    <div className="rp-bars" style={{ height }}>
      {data.map((d, i) => {
        const h = Math.round((d[valueKey] / max) * 100);
        return (
          <div className="rp-bar-col" key={i} title={`${d[labelKey]}: ${d[valueKey]}`}>
            <div className="rp-bar-wrap">
              <span className="rp-bar" style={{ height: `${h}%` }} />
            </div>
            <span className="rp-bar-lbl">{format(d[labelKey])}</span>
          </div>
        );
      })}
    </div>
  );
}

/* Horizontal bars (top venues). */
function HBars({ data }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (!data.length) return <div className="muted" style={{ padding: '1rem 0' }}>No bookings in this period.</div>;
  return (
    <div className="rp-hbars">
      {data.map((d) => (
        <div className="rp-hbar-row" key={d.venue}>
          <span className="rp-hbar-name" title={d.venue}>{d.venue}</span>
          <span className="rp-hbar-track"><span className="rp-hbar-fill" style={{ width: `${(d.count / max) * 100}%` }} /></span>
          <span className="rp-hbar-val">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

const STATUS_TONE = {
  APPROVED: 'var(--success)', PENDING: 'var(--warn)',
  REJECTED: 'var(--danger)', CANCELLED: 'var(--ink-45)',
};
const STATUS_LABEL = { APPROVED: 'Approved', PENDING: 'Pending', REJECTED: 'Declined', CANCELLED: 'Cancelled' };

export default function ReportsPage() {
  usePageTitle('Reports');
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [exporting, setExporting] = useState(false);

  useTopbar('Reports', (
    <button className="btn btn-outline btn-sm" disabled={exporting} onClick={async () => {
      setExporting(true);
      try { await downloadCsv(days); } finally { setExporting(false); }
    }}>
      <Icon.Calendar width={15} height={15} /> {exporting ? 'Exporting…' : 'Export CSV'}
    </button>
  ), [days, exporting]);

  const revealRef = useReveal([data != null, days]);

  useEffect(() => {
    setData(null);
    api.get('/bookings/analytics/', { params: { days } })
      .then((r) => setData(r.data))
      .catch(() => setData(false));
  }, [days]);

  const statusTotal = useMemo(
    () => (data ? data.status_breakdown.reduce((a, s) => a + s.count, 0) : 0),
    [data],
  );

  const loading = data == null;
  const failed = data === false;
  const k = data && data.kpis;

  return (
    <div className="page" style={{ maxWidth: 1200 }} ref={revealRef}>
      <div className="page-head reveal">
        <span className="eyebrow">Insights</span>
        <h1>Reports</h1>
        <p>Booking activity and venue utilisation across the institution.</p>
      </div>

      <div className="filters reveal" style={{ marginBottom: '1.4rem' }}>
        {RANGES.map((r) => (
          <button key={r.days} className={`chip${days === r.days ? ' active' : ''}`} onClick={() => setDays(r.days)}>
            Last {r.label}
          </button>
        ))}
      </div>

      {failed && <div className="conflict reveal in"><Icon.X strokeWidth={2} /><span>Couldn't load analytics. Please try again.</span></div>}

      {!failed && (
        <>
          <div className="rp-kpis reveal" style={{ marginBottom: '1.4rem' }}>
            <Kpi label="Total bookings" value={loading ? '—' : k.total} />
            <Kpi label="Approved" value={loading ? '—' : k.approved} tone="var(--success)" />
            <Kpi label="Pending" value={loading ? '—' : k.pending} tone={!loading && k.pending ? 'var(--warn)' : undefined} />
            <Kpi label="Approval rate" value={loading || k.approval_rate == null ? '—' : k.approval_rate} suffix={!loading && k.approval_rate != null ? '%' : ''} />
            <Kpi label="Avg turnaround" value={loading || k.avg_turnaround_hours == null ? '—' : k.avg_turnaround_hours} suffix={!loading && k.avg_turnaround_hours != null ? 'h' : ''} />
            <Kpi label="Check-in rate" value={loading || k.checkin_rate == null ? '—' : k.checkin_rate} suffix={!loading && k.checkin_rate != null ? '%' : ''} />
          </div>

          <div className="rp-grid reveal">
            <div className="card card-pad">
              <h3 style={{ marginBottom: '1rem' }}>Bookings over time</h3>
              {loading ? <div className="skeleton" style={{ height: 140 }} />
                : <BarChart data={data.daily} labelKey="date" valueKey="count"
                    format={(d) => { const x = new Date(d + 'T00:00:00'); return x.getDate() === 1 || data.daily.length <= 14 ? x.toLocaleDateString('en', { day: 'numeric' }) : ''; }} />}
            </div>

            <div className="card card-pad">
              <h3 style={{ marginBottom: '1rem' }}>Busiest hours</h3>
              {loading ? <div className="skeleton" style={{ height: 140 }} />
                : <BarChart data={data.peak_hours} labelKey="hour" valueKey="count" format={(h) => (h % 2 === 0 ? String(h).padStart(2, '0') : '')} />}
            </div>

            <div className="card card-pad">
              <h3 style={{ marginBottom: '1rem' }}>Top venues</h3>
              {loading ? <div className="skeleton" style={{ height: 140 }} /> : <HBars data={data.top_venues} />}
            </div>

            <div className="card card-pad">
              <h3 style={{ marginBottom: '1rem' }}>Status breakdown</h3>
              {loading ? <div className="skeleton" style={{ height: 140 }} /> : (
                <>
                  <div className="rp-stack">
                    {data.status_breakdown.map((s) => s.count > 0 && (
                      <span key={s.status} className="rp-stack-seg" title={`${STATUS_LABEL[s.status]}: ${s.count}`}
                        style={{ width: `${(s.count / Math.max(1, statusTotal)) * 100}%`, background: STATUS_TONE[s.status] }} />
                    ))}
                  </div>
                  <div className="rp-legend">
                    {data.status_breakdown.map((s) => (
                      <span key={s.status} className="rp-legend-item">
                        <span className="rp-dot" style={{ background: STATUS_TONE[s.status] }} />
                        {STATUS_LABEL[s.status]} <b>{s.count}</b>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
