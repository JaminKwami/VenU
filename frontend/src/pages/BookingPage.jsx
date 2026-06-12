import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../api/axios';
import { usePageTitle } from '../hooks/usePageTitle';
import { useReveal } from '../hooks/useReveal';
import { useTopbar } from '../components/TopbarContext';
import { Icon } from '../components/icons';
import { venueGradient, hm, prettyDate, todayISO } from '../utils/venueUi';

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
const DURATIONS = [1, 2, 3];
const STEPS = ['Space', 'Schedule', 'Details', 'Confirm'];

const pad = h => `${String(h).padStart(2, '0')}:00`;

function overlaps(taken, startH, durH) {
  const s = pad(startH);
  const e = pad(startH + durH);
  return (taken || []).some(t => hm(t.start_time) < e && hm(t.end_time) > s);
}

export default function BookingPage() {
  usePageTitle('New Booking');
  useTopbar('New Booking');
  const { state } = useLocation();

  const [step, setStep] = useState(1);
  const [venues, setVenues] = useState([]);
  const [venueId, setVenueId] = useState(state?.venueId ?? null);
  const [date, setDate] = useState(state?.date || todayISO());
  const [hour, setHour] = useState(state?.hour ?? null);
  const [duration, setDuration] = useState(2);
  const [taken, setTaken] = useState([]);
  const [purpose, setPurpose] = useState('');
  const [attendees, setAttendees] = useState('');
  const [department, setDepartment] = useState('');
  const [notes, setNotes] = useState('');
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);
  const [waitlisted, setWaitlisted] = useState(false);
  const [repeatOn, setRepeatOn] = useState(false);
  const [repeatFreq, setRepeatFreq] = useState('weekly');
  const [repeatUntil, setRepeatUntil] = useState('');
  const revealRef = useReveal([venues.length > 0]);

  useEffect(() => {
    api.get('/venues/').then(r => {
      setVenues(r.data);
      if (!venueId && r.data.length) setVenueId(r.data[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!venueId || !date) { setTaken([]); return; }
    let stale = false;
    api.get('/bookings/availability/', { params: { venue: venueId, date } })
      .then(r => { if (!stale) setTaken(r.data.taken_slots); })
      .catch(() => { if (!stale) setTaken([]); });
    return () => { stale = true; };
  }, [venueId, date]);

  // These derivations only depend on state/props already declared above,
  // so they must live before the effects that reference them in their dep arrays.
  const venue = venues.find(v => v.id === Number(venueId));
  const clash = hour != null && overlaps(taken, hour, duration);
  const nearestFree = useMemo(() => {
    if (!clash) return null;
    return HOURS.find(h => !overlaps(taken, h, duration) && h !== hour) ?? null;
  }, [clash, taken, duration, hour]);
  const overCap = venue && attendees && Number(attendees) > venue.capacity;

  useEffect(() => {
    if (!clash || !venue || hour === null) {
      setAlternatives([]);
      return;
    }
    setLoadingAlternatives(true);
    const startTime = pad(hour);
    const endTime = pad(hour + duration);
    api.get('/venues/alternatives/', {
      params: {
        date,
        start_time: startTime,
        end_time: endTime,
        current_venue_id: venue.id,
        min_capacity: attendees ? Number(attendees) : 1,
      },
    })
      .then(r => setAlternatives(r.data))
      .catch(() => setAlternatives([]))
      .finally(() => setLoadingAlternatives(false));
  }, [clash, venue, hour, duration, date, attendees]);

  useEffect(() => { setWaitlisted(false); }, [venueId, date, hour, duration]);

  const canContinue =
    step === 1 ? !!venue :
    step === 2 ? hour != null && !clash :
    step === 3 ? agree && !overCap && !submitting && (!repeatOn || !!repeatUntil) :
    false;

  async function next() {
    setError('');
    if (step < 3) { setStep(step + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    // submit
    setSubmitting(true);
    try {
      const res = await api.post('/bookings/', {
        venue: venue.id,
        date,
        start_time: pad(hour),
        end_time: pad(hour + duration),
        purpose,
        department,
        notes,
        attendee_count: attendees ? Number(attendees) : null,
        ...(repeatOn && repeatUntil ? { repeat: { frequency: repeatFreq, until: repeatUntil } } : {}),
      });
      setCreated(res.data);
      setStep(4);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not submit the request — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep(1); setHour(null); setPurpose(''); setAttendees(''); setDepartment(''); setNotes(''); setAgree(false); setCreated(null); setError('');
    setRepeatOn(false); setRepeatUntil(''); setWaitlisted(false);
  }

  function selectAlternativeVenue(altVenue) {
    setVenues(prev => prev.some(v => v.id === altVenue.id) ? prev : [...prev, altVenue]);
    setVenueId(altVenue.id);
    setAlternatives([]);
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
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not join the waitlist.');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 1200 }} ref={revealRef}>
      <div className="page-head reveal">
        <span className="eyebrow">Request a space</span>
        <h1>New booking</h1>
      </div>

      <div className="stepper reveal">
        {STEPS.map((lb, i) => (
          <span key={lb} style={{ display: 'contents' }}>
            {i > 0 && <span className="stp-line" />}
            <div className={`stp${step === i + 1 ? ' on' : ''}${step > i + 1 ? ' done' : ''}`}>
              <span className="n">{step > i + 1 ? '✓' : i + 1}</span><span className="lb">{lb}</span>
            </div>
          </span>
        ))}
      </div>

      <div className="book-grid reveal">
        <div className="card card-pad">
          {/* Step 1 — Space */}
          {step === 1 && (
            <div className="step-panel active">
              <h2 style={{ fontSize: '1.3rem', marginBottom: '.4rem' }}>Choose a space</h2>
              <p className="muted" style={{ marginBottom: '1.2rem', fontSize: '.92rem' }}>Pick a venue, or browse the full catalogue first.</p>
              <div className="venue-pick">
                {venues.slice(0, 6).map(v => (
                  <button key={v.id} className={`vp${v.id === Number(venueId) ? ' on' : ''}`} onClick={() => { setVenueId(v.id); setHour(null); }}>
                    <span className="vpi" style={{ background: venueGradient(v.id) }} />
                    <div>
                      <div className="vpn">{v.name}</div>
                      <div className="vpm">{v.building || v.location} · {v.capacity} cap</div>
                    </div>
                  </button>
                ))}
              </div>
              <Link className="btn btn-outline" to="/venues" style={{ marginTop: '1rem' }}>Browse all venues</Link>
            </div>
          )}

          {/* Step 2 — Schedule */}
          {step === 2 && (
            <div className="step-panel active">
              <h2 style={{ fontSize: '1.3rem', marginBottom: '.4rem' }}>Pick a date &amp; time</h2>
              <p className="muted" style={{ marginBottom: '1.2rem', fontSize: '.92rem' }}>We'll flag any clashes before you submit.</p>
              <div className="field" style={{ marginBottom: '1.2rem', maxWidth: 260 }}>
                <label>Date</label>
                <input className="input" type="date" min={todayISO()} value={date} onChange={e => { setDate(e.target.value); setHour(null); }} />
              </div>
              <span className="label" style={{ display: 'block', marginBottom: '.5rem' }}>Start time</span>
              <div className="time-grid">
                {HOURS.map(h => {
                  const busy = overlaps(taken, h, duration);
                  return (
                    <button key={h} className={`${hour === h ? 'on' : ''}${busy ? ' busy' : ''}`} disabled={busy} onClick={() => setHour(h)}>
                      {pad(h)}
                    </button>
                  );
                })}
              </div>
              <div className="field" style={{ marginTop: '1.2rem', maxWidth: 260 }}>
                <label>Duration</label>
                <select className="select" value={duration} onChange={e => setDuration(Number(e.target.value))}>
                  {DURATIONS.map(d => <option key={d} value={d}>{d} hour{d > 1 ? 's' : ''}</option>)}
                </select>
              </div>
              {hour != null && (
                <div>
                  <div className={`conflict${clash ? '' : ' ok'}`}>
                    {clash ? <Icon.X strokeWidth={2} /> : <Icon.Approvals strokeWidth={2} />}
                    <span>
                      {clash
                        ? `${pad(hour)}–${pad(hour + duration)} overlaps an existing booking.${nearestFree != null ? ` Nearest free slot: ${pad(nearestFree)}.` : ''}`
                        : `${pad(hour)}–${pad(hour + duration)} is free. No clashes detected for this slot.`}
                    </span>
                  </div>

                  {clash && (
                    <div className="alternatives">
                      {loadingAlternatives ? (
                        <div className="skeleton" style={{ height: 72 }} />
                      ) : alternatives.length > 0 ? (
                        <>
                          <div className="alt-head">Similar spaces free at this time</div>
                          <div className="alt-grid">
                            {alternatives.map(alt => (
                              <button key={alt.id} className="alt-card" onClick={() => selectAlternativeVenue(alt)}>
                                <div className="alt-name">{alt.name}</div>
                                <div className="alt-specs">{alt.building || alt.location} · {alt.capacity} cap</div>
                                {alt.amenities?.length > 0 && (
                                  <div className="alt-amenities">
                                    {alt.amenities.slice(0, 3).map(a => <span key={a}>{a}</span>)}
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="alt-empty">
                          <span>
                            {waitlisted
                              ? `You're on the waitlist — we'll email you if ${pad(hour)}–${pad(hour + duration)} frees up.`
                              : 'No similar space is free at this time. Join the waitlist and we’ll email you if the slot opens.'}
                          </span>
                          {!waitlisted && (
                            <button type="button" className="btn btn-outline btn-sm" onClick={joinWaitlist}>
                              Join waitlist
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3 — Details */}
          {step === 3 && (
            <div className="step-panel active">
              <h2 style={{ fontSize: '1.3rem', marginBottom: '.4rem' }}>Booking details</h2>
              <p className="muted" style={{ marginBottom: '1.2rem', fontSize: '.92rem' }}>Help the approver understand your request.</p>
              <div className="stack" style={{ gap: '1rem' }}>
                <div className="field">
                  <label>Purpose / event name</label>
                  <input className="input" placeholder="e.g. Robotics Showcase 2026" value={purpose} onChange={e => setPurpose(e.target.value)} />
                </div>
                <div className="row" style={{ gap: '1rem', flexWrap: 'wrap' }}>
                  <div className="field" style={{ flex: 1, minWidth: 160 }}>
                    <label>Expected attendees</label>
                    <input className="input" type="number" min="1" max={venue?.capacity} placeholder={venue ? `Up to ${venue.capacity}` : ''} value={attendees} onChange={e => setAttendees(e.target.value)} />
                  </div>
                  <div className="field" style={{ flex: 1, minWidth: 160 }}>
                    <label>Department</label>
                    <input className="input" placeholder="e.g. Engineering" value={department} onChange={e => setDepartment(e.target.value)} />
                  </div>
                </div>
                <div className="field">
                  <label>Notes for facilities (optional)</label>
                  <textarea className="input" rows={3} placeholder="Equipment, layout or access requests…" value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
                <div className="field" style={{ gap: '.7rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '.6rem', textTransform: 'none', letterSpacing: 0, fontFamily: 'inherit', fontSize: '.9rem', fontWeight: 500, color: 'var(--ink-65)' }}>
                    <input type="checkbox" checked={repeatOn} onChange={e => setRepeatOn(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                    Repeat this booking
                  </label>
                  {repeatOn && (
                    <div className="row" style={{ gap: '1rem', flexWrap: 'wrap' }}>
                      <div className="field" style={{ flex: 1, minWidth: 150 }}>
                        <label>Frequency</label>
                        <select className="select" value={repeatFreq} onChange={e => setRepeatFreq(e.target.value)}>
                          <option value="weekly">Every week</option>
                          <option value="biweekly">Every two weeks</option>
                        </select>
                      </div>
                      <div className="field" style={{ flex: 1, minWidth: 150 }}>
                        <label>Until</label>
                        <input className="input" type="date" min={date} value={repeatUntil} onChange={e => setRepeatUntil(e.target.value)} />
                      </div>
                    </div>
                  )}
                  {repeatOn && !repeatUntil && (
                    <span style={{ fontSize: '.8rem', color: 'var(--ink-45)' }}>Pick an end date — clashing dates are skipped automatically.</span>
                  )}
                </div>
                {overCap && (
                  <div className="conflict"><Icon.X strokeWidth={2} /><span>Attendee count exceeds the venue capacity of {venue.capacity}.</span></div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: '.6rem', fontSize: '.9rem', color: 'var(--ink-65)' }}>
                  <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                  I agree to the venue use policy &amp; cancellation terms.
                </label>
                {error && <div className="conflict"><Icon.X strokeWidth={2} /><span>{error}</span></div>}
              </div>
            </div>
          )}

          {/* Step 4 — Confirm */}
          {step === 4 && created && (
            <div className="step-panel active">
              <div className="success-wrap">
                <div className="success-ring"><Icon.Check /></div>
                <h2 style={{ fontSize: '1.6rem' }}>Request submitted!</h2>
                <p className="muted" style={{ maxWidth: '42ch', margin: '.6rem auto 0' }}>
                  {created.series_count > 1
                    ? <>Your <b style={{ color: 'var(--ink)' }}>{created.series_count} recurring requests</b> for <b style={{ color: 'var(--ink)' }}>{created.venue.name}</b> are in the approvals queue.</>
                    : <>Your request for <b style={{ color: 'var(--ink)' }}>{created.venue.name}</b> is in the approvals queue — the outcome will appear on your dashboard.</>}
                  {' '}Reference <span className="mono" style={{ color: 'var(--accent-ink)' }}>#VENU-{created.id}</span>.
                </p>
                {created.skipped_dates?.length > 0 && (
                  <p className="muted" style={{ maxWidth: '46ch', margin: '.8rem auto 0', fontSize: '.85rem' }}>
                    {created.skipped_dates.length} {created.skipped_dates.length === 1 ? 'date was' : 'dates were'} skipped because the venue is already booked: {created.skipped_dates.join(', ')}.
                  </p>
                )}
                <div className="row" style={{ gap: '.7rem', justifyContent: 'center', marginTop: '1.6rem' }}>
                  <Link className="btn btn-primary" to="/dashboard">Go to dashboard</Link>
                  <button className="btn btn-ghost" onClick={reset}>Book another</button>
                </div>
              </div>
            </div>
          )}

          {step < 4 && (
            <div className="nav-row">
              <button className="btn btn-ghost" style={{ visibility: step === 1 ? 'hidden' : 'visible' }} onClick={() => setStep(s => Math.max(1, s - 1))}>
                Back
              </button>
              <button className="btn btn-primary" disabled={!canContinue} onClick={next}>
                {step === 3 ? (submitting ? 'Submitting…' : 'Submit request') : <>Continue <Icon.Arrow width={16} height={16} /></>}
              </button>
            </div>
          )}
        </div>

        <aside>
          <div className="card sum-card">
            <h3>Summary</h3>
            <div className="sum-line"><span className="k">Venue</span><span className="v">{venue?.name || '—'}</span></div>
            <div className="sum-line"><span className="k">Location</span><span className="v">{venue ? `${venue.building || venue.location} · ${venue.capacity} cap` : '—'}</span></div>
            <div className="sum-line"><span className="k">Date</span><span className="v">{prettyDate(date)}</span></div>
            <div className="sum-line"><span className="k">Time</span><span className="v">{hour != null ? `${pad(hour)} – ${pad(hour + duration)}` : '—'}</span></div>
            <div className="sum-line"><span className="k">Attendees</span><span className="v">{attendees || '—'}</span></div>
            <div className="sum-line"><span className="k">Approval</span><span className="v">Facilities admin</span></div>
            <div style={{ marginTop: '1.1rem', padding: '.9rem 1rem', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', border: '1px solid var(--line)', fontSize: '.84rem', color: 'var(--ink-65)', display: 'flex', gap: '.6rem', alignItems: 'center' }}>
              <Icon.Clock width={18} height={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              Conflicts are checked live as you pick a slot.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
