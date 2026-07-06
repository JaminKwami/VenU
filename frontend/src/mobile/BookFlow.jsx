import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { usePageTitle } from '../hooks/usePageTitle';
import { Icon } from '../components/icons';
import { hm, todayISO, venueGradient } from '../utils/venueUi';
import ConfettiCanvas from './ConfettiCanvas';
import { useFeedback } from './MobileFeedback';

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
const DURATIONS = [1, 2, 3];
const pad = (h) => `${String(h).padStart(2, '0')}:00`;

function overlaps(taken, startH, durH) {
  const s = pad(startH);
  const e = pad(startH + durH);
  return (taken || []).some((t) => hm(t.start_time) < e && hm(t.end_time) > s);
}

export default function BookFlow() {
  usePageTitle('Book');
  const navigate = useNavigate();
  const { state } = useLocation();

  const [step, setStep] = useState(1);
  const [venues, setVenues] = useState([]);
  const [venueId, setVenueId] = useState(state?.venueId ?? null);
  const [date, setDate] = useState(state?.date || (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  })());
  const [hour, setHour] = useState(state?.hour ?? null);
  const [duration, setDuration] = useState(2);
  const [taken, setTaken] = useState([]);
  const [purpose, setPurpose] = useState('');
  const [attendees, setAttendees] = useState('');
  const [notes, setNotes] = useState('');
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const [loadingAlt, setLoadingAlt] = useState(false);
  const [repeatOn, setRepeatOn] = useState(false);
  const [repeatFreq, setRepeatFreq] = useState('weekly');
  const [repeatUntil, setRepeatUntil] = useState('');
  const { toast } = useFeedback();
  const [waitlisted, setWaitlisted] = useState(false);

  useEffect(() => {
    api.get('/venues/').then((r) => {
      const data = r.data.results ?? r.data;
      setVenues(data);
      if (!venueId && data.length) setVenueId(data[0].id);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!venueId || !date) { setTaken([]); return; }
    let stale = false;
    api.get('/bookings/availability/', { params: { venue: venueId, date } })
      .then((r) => { if (!stale) setTaken(r.data.taken_slots || []); })
      .catch(() => { if (!stale) setTaken([]); });
    return () => { stale = true; };
  }, [venueId, date]);

  const venue = venues.find((v) => v.id === Number(venueId));
  const clash = hour != null && overlaps(taken, hour, duration);
  const nearestFree = useMemo(() => {
    if (!clash) return null;
    return HOURS.find((h) => !overlaps(taken, h, duration) && h !== hour) ?? null;
  }, [clash, taken, duration, hour]);
  const overCap = venue && attendees && Number(attendees) > venue.capacity;

  // AI suggestions: when the chosen slot clashes, fetch similar venues that
  // ARE free at this time, ranked by capacity + amenities + building match.
  useEffect(() => {
    if (!clash || !venue || hour == null) { setAlternatives([]); return; }
    let stale = false;
    setLoadingAlt(true);
    api.get('/venues/alternatives/', {
      params: {
        date,
        start_time: pad(hour),
        end_time: pad(hour + duration),
        current_venue_id: venue.id,
        min_capacity: attendees ? Number(attendees) : 1,
      },
    })
      .then((r) => { if (!stale) setAlternatives(r.data); })
      .catch(() => { if (!stale) setAlternatives([]); })
      .finally(() => { if (!stale) setLoadingAlt(false); });
    return () => { stale = true; };
  }, [clash, venue, hour, duration, date, attendees]);

  useEffect(() => { setWaitlisted(false); }, [venueId, date, hour, duration]);

  function selectAlternative(alt) {
    setVenues((prev) => (prev.some((v) => v.id === alt.id) ? prev : [...prev, alt]));
    setVenueId(alt.id);
    setAlternatives([]);
    setHour(null);
  }

  async function joinWaitlist() {
    try {
      await api.post('/bookings/waitlist/', {
        venue: venue.id,
        date,
        start_time: pad(hour),
        end_time: pad(hour + duration),
      });
      setWaitlisted(true);
      toast('Added to the waitlist');
    } catch (err) {
      toast(err.response?.data?.detail || 'Could not join the waitlist.');
    }
  }

  async function submit() {
    if (!agree) { setError('Please agree to the venue use policy.'); return; }
    if (overCap) { setError(`Attendee count exceeds the venue capacity of ${venue.capacity}.`); return; }
    if (repeatOn && !repeatUntil) { setError('Pick an end date for the repeat, or turn repeating off.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/bookings/', {
        venue: venue.id,
        date,
        start_time: pad(hour),
        end_time: pad(hour + duration),
        purpose,
        notes,
        attendee_count: attendees ? Number(attendees) : null,
        ...(repeatOn && repeatUntil ? { repeat: { frequency: repeatFreq, until: repeatUntil } } : {}),
      });
      setCreated(res.data);
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not submit the request — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep(1); setHour(null); setPurpose(''); setAttendees(''); setNotes('');
    setAgree(false); setCreated(null); setError('');
    setRepeatOn(false); setRepeatUntil('');
  }

  // ── Step indicator ──
  const StepDots = ({ active }) => (
    <div className="m-step-indicator">
      {[1, 2, 3].map((n) => (
        <span key={n} className={`m-step-dot${n < active ? ' done' : ''}${n === active ? ' active' : ''}`} />
      ))}
    </div>
  );

  return (
    <div className="m-book">
      {/* Step 1 — Space */}
      {step === 1 && (
        <div className="m-book-step">
          <div className="m-book-header">
            <StepDots active={1} />
            <h2>Pick a space</h2>
            <p className="m-book-hint">Swipe to see all venues.</p>
          </div>
          <div className="m-venue-pick-row">
            {venues.map((v) => {
              const mono = v.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
              return (
                <button
                  key={v.id}
                  className={`m-vp-card${v.id === Number(venueId) ? ' on' : ''}`}
                  onClick={() => { setVenueId(v.id); setHour(null); }}
                >
                  <div className="m-vp-vis">
                    <div className="m-vt-fill" style={{ background: venueGradient(v.id) }} />
                    <div className="m-iso" />
                    <span className="m-vp-mono">{mono}</span>
                  </div>
                  <div className="m-vp-body">
                    <div className="m-vp-name">{v.name}</div>
                    <div className="m-vp-meta">{v.building || v.location} · {v.capacity} cap</div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="m-book-fields">
            <div className="field">
              <label htmlFor="m-book-date">Date</label>
              <input id="m-book-date" className="input" type="date" min={todayISO()} value={date} onChange={(e) => { setDate(e.target.value); setHour(null); }} />
            </div>
          </div>
          <div className="m-book-footer">
            <button className="btn btn-primary btn-block" disabled={!venue} onClick={() => setStep(2)}>
              Choose a time <Icon.Arrow width={18} height={18} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Time */}
      {step === 2 && (
        <div className="m-book-step">
          <div className="m-book-header">
            <StepDots active={2} />
            <h2>Pick a time</h2>
            <p className="m-book-hint">Select a start time.</p>
          </div>
          <div className="m-time-grid">
            {HOURS.map((h) => {
              const busy = overlaps(taken, h, duration);
              return (
                <button
                  key={h}
                  className={`m-time-btn${hour === h ? ' on' : ''}${busy ? ' busy' : ''}`}
                  disabled={busy}
                  onClick={() => setHour(h)}
                >
                  {pad(h)}
                </button>
              );
            })}
          </div>

          {hour != null && (
            <div className={`m-conflict-box ${clash ? 'err' : 'ok'}`}>
              {clash
                ? <Icon.X width={18} height={18} />
                : <Icon.Check width={18} height={18} />}
              <span>
                {clash
                  ? `${pad(hour)} overlaps an existing booking.${nearestFree != null ? ` Nearest free slot: ${pad(nearestFree)}.` : ''}`
                  : `${pad(hour)}–${pad(hour + duration)} is free. No conflicts detected.`}
              </span>
            </div>
          )}

          {clash && (
            <div className="m-alt">
              {loadingAlt ? (
                <div className="m-alt-row">
                  {[1, 2].map((i) => <div className="skel" key={i} style={{ minWidth: 150, height: 96, borderRadius: 16 }} />)}
                </div>
              ) : alternatives.length > 0 ? (
                <>
                  <div className="m-alt-head"><Icon.Search width={14} height={14} /> Similar spaces free at this time</div>
                  <div className="m-alt-row">
                    {alternatives.map((alt) => (
                      <button key={alt.id} className="m-alt-card" onClick={() => selectAlternative(alt)}>
                        <div className="m-alt-vis" style={{ background: venueGradient(alt.id) }}>
                          {alt.similarity_score != null && <span className="m-alt-score">{Math.round(alt.similarity_score)}% match</span>}
                        </div>
                        <div className="m-alt-body">
                          <div className="m-alt-name">{alt.name}</div>
                          <div className="m-alt-meta">{alt.building || alt.location} · {alt.capacity} cap</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="m-alt-empty">
                  <span>{waitlisted
                    ? `You're on the waitlist — we'll email you if ${pad(hour)}–${pad(hour + duration)} frees up.`
                    : 'No similar space is free then. Join the waitlist and we’ll email you if it opens.'}</span>
                  {!waitlisted && (
                    <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={joinWaitlist}>Join waitlist</button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="m-book-fields">
            <div className="field">
              <label htmlFor="m-book-dur">Duration</label>
              <select id="m-book-dur" className="input m-select" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {DURATIONS.map((d) => <option key={d} value={d}>{d} hour{d > 1 ? 's' : ''}</option>)}
              </select>
            </div>
          </div>

          <div className="m-book-footer m-book-footer-split">
            <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={hour == null || clash} onClick={() => setStep(3)}>
              Add details <Icon.Arrow width={18} height={18} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Details */}
      {step === 3 && (
        <div className="m-book-step">
          <div className="m-book-header">
            <StepDots active={3} />
            <h2>A few details</h2>
            <p className="m-book-hint">Everything here is optional.</p>
          </div>
          <div className="m-book-fields m-book-fields-stack">
            <div className="field">
              <label htmlFor="m-purpose">What's it for? <span className="m-opt">optional</span></label>
              <input id="m-purpose" className="input" placeholder="e.g. Robotics showcase" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
              <span className="m-field-hint">A short purpose helps approvers decide faster.</span>
            </div>
            <div className="field">
              <label htmlFor="m-attend">Attendees <span className="m-opt">optional</span></label>
              <input id="m-attend" className="input" type="number" min="1" max={venue?.capacity} placeholder={venue ? `Up to ${venue.capacity}` : 'How many people?'} value={attendees} onChange={(e) => setAttendees(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="m-notes">Notes for facilities <span className="m-opt">optional</span></label>
              <textarea id="m-notes" className="input" rows={2} placeholder="Equipment, layout, access needs…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="m-repeat">
              <label className="m-repeat-toggle">
                <span>Repeat this booking</span>
                <input type="checkbox" className="m-repeat-check" checked={repeatOn} onChange={(e) => setRepeatOn(e.target.checked)} />
              </label>
              {repeatOn && (
                <div className="m-repeat-fields">
                  <div className="field">
                    <label htmlFor="m-freq">Frequency</label>
                    <select id="m-freq" className="input m-select" value={repeatFreq} onChange={(e) => setRepeatFreq(e.target.value)}>
                      <option value="weekly">Every week</option>
                      <option value="biweekly">Every two weeks</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="m-until">Until</label>
                    <input id="m-until" className="input" type="date" min={date} value={repeatUntil} onChange={(e) => setRepeatUntil(e.target.value)} />
                  </div>
                  <span className="m-field-hint">Dates that clash or fall in a break are skipped automatically.</span>
                </div>
              )}
            </div>

            {overCap && (
              <div className="m-conflict-box err"><Icon.X width={18} height={18} /><span>Attendee count exceeds the venue capacity of {venue.capacity}.</span></div>
            )}
            <label className="m-policy">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              I agree to the venue use policy and cancellation terms.
            </label>
            {error && <div className="m-conflict-box err"><Icon.X width={18} height={18} /><span>{error}</span></div>}
          </div>
          <div className="m-book-footer m-book-footer-split">
            <button className="btn btn-ghost" onClick={() => setStep(2)}>Back</button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={!agree || submitting || (repeatOn && !repeatUntil)} onClick={submit}>
              {submitting ? 'Submitting…' : <>Submit request <Icon.Check width={18} height={18} /></>}
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — Confirmation */}
      {step === 4 && created && (
        <>
          <ConfettiCanvas />
          <div className="m-confirm">
            <div className="m-success-ring"><Icon.Check width={44} height={44} /></div>
            <h2>Request sent!</h2>
            <span className="m-ref">#VENU-{String(created.id).padStart(4, '0')}</span>
            <p className="m-what-next">
              {created.series_count > 1
                ? `${created.series_count} recurring requests are in the queue. You'll hear back soon — most are decided the same day.`
                : "Your hold is in the queue. You'll hear back within a few hours — most requests are decided the same day."}
            </p>
            {created.skipped_dates?.length > 0 && (
              <p className="m-what-next" style={{ fontSize: 13, opacity: .85 }}>
                {created.skipped_dates.length} {created.skipped_dates.length === 1 ? 'date was' : 'dates were'} skipped (already booked or in a break).
              </p>
            )}
            <div className="m-confirm-actions">
              <button className="btn btn-primary btn-block" onClick={() => navigate('/dashboard')}>Back to home</button>
              <button className="btn btn-ghost btn-block" onClick={reset}>Book another room</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
