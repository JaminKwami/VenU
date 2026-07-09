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
// A "full day" booking spans the venue's whole operating window rather than
// a specific hour range — still just start/end times under the hood, so
// every existing conflict/suggestion mechanism works unchanged.
const FULL_DAY_START = 8;
const FULL_DAY_END = 20;
const FULL_DAY_DURATION = FULL_DAY_END - FULL_DAY_START;

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
  // `hour` only ever holds a confirmed-free slot — a busy slot can never
  // become "selected". Clicking a busy slot instead sets `triedHour`, which
  // drives the conflict message and suggestions, so the user is redirected
  // to a working time/venue the moment they hit a clash, not at submission.
  const [hour, setHour] = useState(state?.hour ?? null);
  const [triedHour, setTriedHour] = useState(null);
  const [duration, setDuration] = useState(2);
  const [isFullDay, setIsFullDay] = useState(false);
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
  // Bumped to force a re-fetch of availability after a submit-time conflict
  // (someone else grabbed the slot between page load and Submit) so the
  // time grid reflects reality before the user picks another slot.
  const [availabilityNonce, setAvailabilityNonce] = useState(0);
  const revealRef = useReveal([venues.length > 0]);

  useEffect(() => {
    api.get('/venues/').then(r => {
      const data = r.data.results ?? r.data;
      setVenues(data);
      if (!venueId && data.length) setVenueId(data[0].id);
    }).catch(() => setError('Could not load venues — please refresh the page.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!venueId || !date) { setTaken([]); return; }
    let stale = false;
    api.get('/bookings/availability/', { params: { venue: venueId, date } })
      .then(r => { if (!stale) setTaken(r.data.taken_slots); })
      .catch(() => { if (!stale) setTaken([]); });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId, date, availabilityNonce]);

  // These derivations only depend on state/props already declared above,
  // so they must live before the effects that reference them in their dep arrays.
  const venue = venues.find(v => v.id === Number(venueId));
  const overCap = venue && attendees && Number(attendees) > venue.capacity;

  // If a duration change or a fresh availability fetch turns the currently
  // selected hour into a clash, demote it immediately rather than letting an
  // invalid slot sit there looking "selected".
  useEffect(() => {
    if (hour != null && overlaps(taken, hour, duration)) {
      setTriedHour(hour);
      setHour(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taken, duration]);

  function pickHour(h) {
    if (overlaps(taken, h, duration)) {
      setHour(null);
      setTriedHour(h);
    } else {
      setHour(h);
      setTriedHour(null);
    }
  }

  function toggleFullDay(on) {
    setIsFullDay(on);
    if (!on) { setHour(null); setTriedHour(null); setDuration(2); }
  }

  // While "book the whole day" is on, re-check the fixed operating window
  // every time the venue/date's availability changes — same clash-first
  // invariant as pickHour, just for one fixed slot instead of 12 buttons.
  useEffect(() => {
    if (!isFullDay) return;
    setDuration(FULL_DAY_DURATION);
    if (overlaps(taken, FULL_DAY_START, FULL_DAY_DURATION)) {
      setHour(null);
      setTriedHour(FULL_DAY_START);
    } else {
      setHour(FULL_DAY_START);
      setTriedHour(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullDay, taken]);

  // Up to 3 free slots for the same venue, ranked by closeness to the hour the
  // user actually tried — so the first suggestion is the least disruptive.
  // Doesn't apply to a full-day clash: there's only one full-day slot to try
  // on this venue, so the only useful suggestion is a different venue.
  const nearestFreeSlots = useMemo(() => {
    if (triedHour == null || isFullDay) return [];
    return HOURS
      .filter(h => h !== triedHour && !overlaps(taken, h, duration))
      .sort((a, b) => Math.abs(a - triedHour) - Math.abs(b - triedHour) || a - b)
      .slice(0, 3);
  }, [triedHour, taken, duration, isFullDay]);

  useEffect(() => {
    if (triedHour == null || !venue) {
      setAlternatives([]);
      return;
    }
    setLoadingAlternatives(true);
    const startTime = pad(triedHour);
    const endTime = pad(triedHour + duration);
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
  }, [triedHour, venue, duration, date, attendees]);

  useEffect(() => { setWaitlisted(false); }, [venueId, date, triedHour, duration]);

  const canContinue =
    step === 1 ? !!venue :
    step === 2 ? hour != null :
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
        is_full_day: isFullDay,
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
      if (err.response?.status === 409) {
        // Someone else grabbed this slot between page load and Submit.
        // Send the user straight back into the same clash-resolution flow
        // used for a live pick, instead of a dead-end error message.
        setTriedHour(hour);
        setHour(null);
        setAvailabilityNonce(n => n + 1);
        setStep(2);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setError(err.response?.data?.detail || 'Could not submit the request — please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep(1); setHour(null); setTriedHour(null); setIsFullDay(false); setPurpose(''); setAttendees(''); setDepartment(''); setNotes(''); setAgree(false); setCreated(null); setError('');
    setRepeatOn(false); setRepeatUntil(''); setWaitlisted(false);
  }

  function selectAlternativeVenue(altVenue) {
    setVenues(prev => prev.some(v => v.id === altVenue.id) ? prev : [...prev, altVenue]);
    setVenueId(altVenue.id);
    setAlternatives([]);
    // The alternative was suggested because it's free at triedHour — confirm it.
    if (triedHour != null) { setHour(triedHour); setTriedHour(null); }
  }

  async function joinWaitlist() {
    try {
      await api.post('/bookings/waitlist/', {
        venue: venue.id,
        date,
        start_time: pad(triedHour),
        end_time: pad(triedHour + duration),
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
                {venues.slice(0, 6).map(v => {
                  const mono = v.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
                  return (
                    <button key={v.id} className={`vp${v.id === Number(venueId) ? ' on' : ''}`} onClick={() => { setVenueId(v.id); setHour(null); setTriedHour(null); }}>
                      <span className="vpi" style={{ background: venueGradient(v.id) }}>
                        <span className="vpi-mono">{mono}</span>
                      </span>
                      <div>
                        <div className="vpn">{v.name}</div>
                        <div className="vpm">{v.building || v.location} · {v.capacity} cap</div>
                      </div>
                    </button>
                  );
                })}
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
                <label htmlFor="book-date">Date</label>
                <input id="book-date" className="input" type="date" min={todayISO()} value={date} onChange={e => { setDate(e.target.value); setHour(null); setTriedHour(null); }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '.6rem', fontSize: '.9rem', fontWeight: 500, color: 'var(--ink-65)', marginBottom: '1.2rem' }}>
                <input type="checkbox" checked={isFullDay} onChange={e => toggleFullDay(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                Book the whole day ({pad(FULL_DAY_START)}–{pad(FULL_DAY_END)})
              </label>
              {!isFullDay && (
                <>
                  <span className="label" style={{ display: 'block', marginBottom: '.5rem' }}>Start time</span>
                  <div className="time-grid">
                    {HOURS.map(h => {
                      const busy = overlaps(taken, h, duration);
                      return (
                        <button key={h} className={`${hour === h ? 'on' : ''}${busy ? ' busy' : ''}${triedHour === h ? ' tried' : ''}`} onClick={() => pickHour(h)}>
                          {pad(h)}
                        </button>
                      );
                    })}
                  </div>
                  <div className="field" style={{ marginTop: '1.2rem', maxWidth: 260 }}>
                    <label htmlFor="book-duration">Duration</label>
                    <select id="book-duration" className="select" value={duration} onChange={e => setDuration(Number(e.target.value))}>
                      {DURATIONS.map(d => <option key={d} value={d}>{d} hour{d > 1 ? 's' : ''}</option>)}
                    </select>
                  </div>
                </>
              )}
              {hour != null && (
                <div className="conflict ok">
                  <Icon.Approvals strokeWidth={2} />
                  <span>{pad(hour)}–{pad(hour + duration)} is free. No clashes detected for this slot.</span>
                </div>
              )}

              {triedHour != null && (
                <div>
                  <div className="conflict">
                    <Icon.X strokeWidth={2} />
                    <span>{pad(triedHour)}–{pad(triedHour + duration)} is already booked. Pick another time or venue below.</span>
                  </div>

                  <div className="alternatives">
                    {nearestFreeSlots.length > 0 && (
                      <>
                        <div className="alt-head">Try a different time for {venue?.name}</div>
                        <div className="alt-time-row">
                          {nearestFreeSlots.map(h => (
                            <button key={h} type="button" className="alt-time-chip" onClick={() => pickHour(h)}>
                              {pad(h)}–{pad(h + duration)}
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {loadingAlternatives ? (
                      <div className="skeleton" style={{ height: 72, marginTop: nearestFreeSlots.length > 0 ? '1.1rem' : 0 }} />
                    ) : alternatives.length > 0 ? (
                      <>
                        <div className="alt-head" style={{ marginTop: nearestFreeSlots.length > 0 ? '1.1rem' : 0 }}>
                          Or try another venue at {pad(triedHour)}–{pad(triedHour + duration)}
                        </div>
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
                    ) : nearestFreeSlots.length === 0 ? (
                      <div className="alt-empty">
                        <span>
                          {waitlisted
                            ? `You're on the waitlist — we'll email you if ${pad(triedHour)}–${pad(triedHour + duration)} frees up.`
                            : 'Nothing else is free at this time. Join the waitlist and we’ll email you if the slot opens.'}
                        </span>
                        {!waitlisted && (
                          <button type="button" className="btn btn-outline btn-sm" onClick={joinWaitlist}>
                            Join waitlist
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
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
                  <label htmlFor="book-purpose">Purpose / event name <span className="opt-label">(optional)</span></label>
                  <input id="book-purpose" className="input" placeholder="e.g. Robotics Showcase 2026" value={purpose} onChange={e => setPurpose(e.target.value)} />
                </div>
                <div className="row" style={{ gap: '1rem', flexWrap: 'wrap' }}>
                  <div className="field" style={{ flex: 1, minWidth: 160 }}>
                    <label htmlFor="book-attendees">Expected attendees <span className="opt-label">(optional)</span></label>
                    <input id="book-attendees" className="input" type="number" min="1" max={venue?.capacity} placeholder={venue ? `Up to ${venue.capacity}` : ''} value={attendees} onChange={e => setAttendees(e.target.value)} />
                  </div>
                  <div className="field" style={{ flex: 1, minWidth: 160 }}>
                    <label htmlFor="book-dept">Department <span className="opt-label">(optional)</span></label>
                    <input id="book-dept" className="input" placeholder="e.g. Engineering" value={department} onChange={e => setDepartment(e.target.value)} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="book-notes">Notes for facilities (optional)</label>
                  <textarea id="book-notes" className="input" rows={3} placeholder="Equipment, layout or access requests…" value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
                <div className="field" style={{ gap: '.7rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '.6rem', textTransform: 'none', letterSpacing: 0, fontFamily: 'inherit', fontSize: '.9rem', fontWeight: 500, color: 'var(--ink-65)' }}>
                    <input type="checkbox" checked={repeatOn} onChange={e => setRepeatOn(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                    Repeat this booking <span className="opt-label">(e.g. a multi-day event)</span>
                  </label>
                  {repeatOn && (
                    <div className="row" style={{ gap: '1rem', flexWrap: 'wrap' }}>
                      <div className="field" style={{ flex: 1, minWidth: 150 }}>
                        <label htmlFor="book-freq">Frequency</label>
                        <select id="book-freq" className="select" value={repeatFreq} onChange={e => setRepeatFreq(e.target.value)}>
                          <option value="daily">Every day (e.g. a 3-day summit)</option>
                          <option value="weekly">Every week</option>
                          <option value="biweekly">Every two weeks</option>
                        </select>
                      </div>
                      <div className="field" style={{ flex: 1, minWidth: 150 }}>
                        <label htmlFor="book-until">Until</label>
                        <input id="book-until" className="input" type="date" min={date} value={repeatUntil} onChange={e => setRepeatUntil(e.target.value)} />
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
                <h2 style={{ fontSize: '1.6rem' }}>You're in the queue.</h2>
                <p className="muted" style={{ maxWidth: '44ch', margin: '.6rem auto 0' }}>
                  {created.series_count > 1
                    ? <><b style={{ color: 'var(--ink)' }}>{created.series_count} recurring requests</b> for <b style={{ color: 'var(--ink)' }}>{created.venue.name}</b> have been sent to facilities for review.</>
                    : <>Your request for <b style={{ color: 'var(--ink)' }}>{created.venue.name}</b> has been sent to facilities for review. You'll be notified once a decision is made.</>}
                </p>
                <div style={{ display: 'inline-block', marginTop: '1rem', padding: '.5rem 1rem', borderRadius: 'var(--r-md)', background: 'var(--canvas-2)', border: '1px solid var(--line)', fontFamily: 'var(--font-mono)', fontSize: '.75rem', color: 'var(--ink-45)', letterSpacing: '.04em' }}>
                  REF #{String(created.id).padStart(4, '0')}
                </div>
                {created.skipped_dates?.length > 0 && (
                  <p className="muted" style={{ maxWidth: '46ch', margin: '.8rem auto 0', fontSize: '.82rem' }}>
                    {created.skipped_dates.length} {created.skipped_dates.length === 1 ? 'date was' : 'dates were'} skipped due to existing bookings: {created.skipped_dates.join(', ')}.
                  </p>
                )}
                <div className="row" style={{ gap: '.7rem', justifyContent: 'center', marginTop: '1.6rem' }}>
                  <Link className="btn btn-primary" to="/dashboard">View on dashboard</Link>
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
            <div className="sum-line"><span className="k">Time</span><span className="v">{hour != null ? (isFullDay ? `All day (${pad(hour)}–${pad(hour + duration)})` : `${pad(hour)} – ${pad(hour + duration)}`) : '—'}</span></div>
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
