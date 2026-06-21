import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePageTitle } from '../hooks/usePageTitle';
import { useReveal } from '../hooks/useReveal';
import { useLandingMotion } from '../hooks/useLandingMotion';
import AppearanceControl from '../components/AppearanceControl';
import { Icon } from '../components/icons';
import '../styles/landing.css';

const FEATURES = [
  { icon: <Icon.Clock />, title: 'Live availability', body: 'Pick a venue and date and the taken slots appear instantly — before you lift a finger.' },
  { icon: <Icon.Shield />, title: 'Conflict detection', body: 'VenU catches overlaps the instant you pick a slot — and points you to the nearest free window.' },
  { icon: <Icon.Clipboard />, title: 'Approvals that flow', body: 'A clean queue for facilities staff — approve or decline with full context, in seconds.' },
  { icon: <Icon.Users />, title: 'Capacity-aware', body: "Attendee counts are checked against each room's limit, so you never overbook a space." },
  { icon: <Icon.Calendar />, title: 'Calendar at a glance', body: 'Your bookings, requests and decisions laid out on one timeline you can actually read.' },
  { icon: <Icon.Layers />, title: 'Role-based access', body: 'Students request, staff approve, admins manage the catalogue — everyone sees exactly what they should.' },
];

const STEPS = [
  { n: 1, title: 'Discover', body: 'Filter spaces by capacity, building and type. Every venue shows its details up front, so you never request a dead end.' },
  { n: 2, title: 'Request', body: 'Pick a date and time. VenU surfaces conflicts before you submit and shows you the slots already taken. Add your purpose, attendee count and notes — then send it in one tap.' },
  { n: 3, title: 'Confirmed', body: 'Facilities approvers see your request in a clean queue with everything they need to decide. The outcome — and the reason, if declined — lands on your dashboard.' },
];

const SPACE_TYPES = ['Lecture halls', 'Design studios', 'Research labs', 'Music rooms', 'Sports courts', 'Quad lawns', 'Seminar pods', 'Maker spaces'];

const CATEGORIES = [
  { title: 'Lecture halls & auditoria', meta: 'Keynotes · showcases · lectures', tags: 'Tiered · AV · Capacity-checked', g: 'linear-gradient(150deg,#27272a,#0f0f10)', badge: ['badge-approved', 'Bookable'] },
  { title: 'Studios & labs', meta: 'Crits · sessions · workshops', tags: 'Amenities listed per room', g: 'linear-gradient(150deg,#52525b,#27272a)', badge: ['badge-approved', 'Bookable'] },
  { title: 'Outdoor & event spaces', meta: 'Fairs · socials · ceremonies', tags: 'Big capacities · conflict-free', g: 'linear-gradient(150deg,#334155,#0f172a)', badge: ['badge-approved', 'Bookable'] },
];

export default function LandingPage() {
  usePageTitle('Book any space on campus');
  const { accessToken } = useAuthStore();
  const rootRef = useRef(null);
  useLandingMotion(rootRef);
  const revealRef = useReveal();

  const authed = !!accessToken;
  const cta = authed ? '/dashboard' : '/login';

  return (
    <div className="lp" ref={rootRef}>
      <div ref={revealRef}>
        {/* ── Nav ── */}
        <nav className="lp-nav">
          <Link className="lp-brand" to="/"><span className="sb-mark">V</span><span className="sb-word">VenU</span></Link>
          <div className="lp-nav-links">
            <a className="navlink" href="#how">How it works</a>
            <a className="navlink" href="#venues">Venues</a>
            <a className="navlink" href="#features">Features</a>
          </div>
          <div className="lp-nav-cta">
            <AppearanceControl />
            {authed ? (
              <Link className="btn btn-primary btn-sm" to="/dashboard" data-magnetic>Open dashboard</Link>
            ) : (
              <>
                <Link className="btn btn-ghost btn-sm" to="/login">Log in</Link>
                <Link className="btn btn-primary btn-sm" to="/login" data-magnetic>Log in</Link>
              </>
            )}
          </div>
        </nav>

        {/* ── Hero ── */}
        <header className="hero">
          <div className="hero-grid" data-parallax="0.06" />
          <div className="hero-glow g1" data-parallax="0.12" />
          <div className="hero-glow g2" data-parallax="0.08" />

          <div className="hero-inner">
            <div className="hero-copy">
              <span className="hero-eyebrow">
                <span className="pin" />
                <span className="eyebrow" style={{ color: 'var(--ink-65)' }}>Campus venue booking · AroLabs</span>
              </span>
              <h1>Book any space<br />on campus before<br />the idea <em>cools<span className="underline" /></em>.</h1>
              <p className="hero-sub">
                VenU puts every lecture hall, lab, studio and quad in one bookable catalogue.
                Check availability, request a slot, get approved — without the email chains.
              </p>
              <div className="hero-cta">
                <Link className="btn btn-primary btn-lg" to={cta} data-magnetic>
                  {authed ? 'Start booking' : 'Request access'} <Icon.Arrow />
                </Link>
                <a className="btn btn-ghost btn-lg" href="#how">How it works</a>
              </div>
              <div className="hero-meta">
                <div className="hm"><b><span data-count="3">0</span></b><span>Steps to booked</span></div>
                <div className="hm"><b><span data-count="100" data-suffix="%">0</span></b><span>Conflict-checked</span></div>
                <div className="hm"><b><span data-count="24" data-suffix="/7">0</span></b><span>Request anytime</span></div>
                <div className="hm"><b><span data-count="0">0</span></b><span>Email chains</span></div>
              </div>
            </div>

            {/* Illustrative product-UI vignettes (decorative) */}
            <div className="hero-stage" aria-hidden="true">
              <div className="float-card fc-1" data-parallax="0.16">
                <div className="fc-top"><span className="fc-name">Auditorium</span><span className="badge badge-approved"><span className="dot" />Approved</span></div>
                <div className="fc-img"><div className="grad" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(150deg,#27272a,#0f0f10)' }} /><div className="iso" /></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="fc-coord">CAP 420 · 14:00–16:00</span><span className="fc-coord" style={{ color: 'var(--accent-ink)' }}>HELD</span></div>
              </div>
              <div className="float-card fc-2" data-parallax="0.30">
                <div className="fc-top"><span className="fc-name">Design studio</span></div>
                <div className="fc-img" style={{ height: 70 }}><div className="grad" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(150deg,#5C3A1A,#C8460A)' }} /><div className="iso" /></div>
                <div className="cap-bar" style={{ marginTop: '.3rem' }}><span style={{ width: '72%' }} /></div>
                <div className="fc-coord" style={{ marginTop: '.5rem' }}>32 / 40 ATTENDEES</div>
              </div>
              <div className="float-card fc-3" data-parallax="0.22">
                <div className="fc-top"><span className="fc-name">Quad lawn</span><span className="fc-coord">13:00</span></div>
                <div className="row" style={{ gap: '.4rem', marginTop: '.6rem' }}>
                  <span className="badge badge-pending" style={{ fontSize: '.55rem' }}><span className="dot" />Pending</span>
                  <span className="fc-coord">AWAITING APPROVAL</span>
                </div>
              </div>
            </div>
          </div>

          <div className="scroll-cue"><span className="tx">Scroll</span><span className="ln" /></div>
        </header>

        {/* ── Trust strip ── */}
        <div className="strip">
          <div className="marquee">
            {[...SPACE_TYPES, ...SPACE_TYPES].map((s, i) => <span key={i}>{s}</span>)}
          </div>
        </div>

        {/* ── How it works ── */}
        <section className="section" id="how">
          <div className="section-inner">
            <div className="section-head reveal">
              <span className="eyebrow">The flow</span>
              <h2>From "where can we meet?" to confirmed in three moves.</h2>
              <p>No more chasing facilities over email. VenU collapses discovery, request and approval into one calm, trackable flow.</p>
            </div>
            <div className="steps">
              <div className="steps-sticky">
                <div>
                  <div className="big-num">01</div>
                  <div className="big-label">Discover the space</div>
                </div>
              </div>
              <div className="step-list">
                {STEPS.map((s, i) => (
                  <div key={s.n} className={`step-item reveal${i === 0 ? ' active' : ''}`} data-d={i || undefined}>
                    <h3><span className="st-i">{s.n}</span>{s.title}</h3>
                    <p>{s.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Space categories ── */}
        <section className="section alt" id="venues">
          <div className="section-inner">
            <div className="section-head reveal" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', maxWidth: 'none', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ maxWidth: 560 }}>
                <span className="eyebrow">One catalogue</span>
                <h2>Every kind of space, one queue.</h2>
              </div>
              <Link className="btn btn-outline" to={authed ? '/venues' : '/login'}>Browse venues</Link>
            </div>
            <div className="venue-row">
              {CATEGORIES.map((c, i) => (
                <article key={c.title} className="v-card reveal" data-d={i || undefined}>
                  <div className="v-vis">
                    <div className="grad" style={{ background: c.g }} />
                    <div className="iso-grid" />
                    <span className={`v-badge badge ${c.badge[0]}`}><span className="dot" />{c.badge[1]}</span>
                  </div>
                  <div className="v-body">
                    <h3>{c.title}</h3>
                    <div className="v-meta">{c.meta}</div>
                    <div className="v-foot">
                      <span className="badge badge-neutral">Capacity-checked</span>
                      <span className="mono" style={{ fontSize: '.72rem', color: 'var(--accent-ink)' }}>{c.tags}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="section" id="features">
          <div className="section-inner">
            <div className="section-head reveal">
              <span className="eyebrow">Why VenU</span>
              <h2>Quietly powerful, where it counts.</h2>
              <p>Every detail is built around the messy reality of shared campus space — overlapping requests, capacity limits and approval chains.</p>
            </div>
            <div className="feat-grid">
              {FEATURES.map((f, i) => (
                <div key={f.title} className="feat reveal" data-d={(i % 3) || undefined}>
                  <div className="fi">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Scale statement ── */}
        <section className="scale-sec">
          <div className="scale-pin">
            <div>
              <div className="big">Built for how<br />campus <span className="hl">actually</span> works.</div>
              <p className="sub">Shared rooms. Competing requests. Real people who just need somewhere to meet. VenU handles the chaos so you don't have to.</p>
            </div>
          </div>
        </section>

        {/* ── Principle ── */}
        <section className="section alt">
          <div className="quote-blk reveal">
            <div className="qmark">"</div>
            <blockquote>One catalogue. One queue. Zero double-bookings.</blockquote>
            <div className="qby">
              <span className="avatar">A</span>
              <div style={{ textAlign: 'left' }}><div className="nm">The principle behind VenU</div><div className="rl">AroLabs</div></div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="cta-sec">
          <div className="cta-box reveal">
            <div className="cta-grid" />
            <h2>Your next booking is 30 seconds away.</h2>
            <p>Sign in with the account your institution gave you and request your first space.</p>
            <div className="hero-cta">
              <Link className="btn btn-primary btn-lg" to={cta} data-magnetic>
                {authed ? 'Open dashboard' : 'Sign in'} <Icon.Arrow />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="lp-foot">
          <div className="lp-foot-inner">
            <Link className="lp-brand" to="/"><span className="sb-mark">V</span><span className="sb-word">VenU</span></Link>
            <div className="lp-foot-links">
              <Link to={authed ? '/venues' : '/login'}>Venues</Link>
              <Link to={authed ? '/dashboard' : '/login'}>Dashboard</Link>
              <Link to="/login">Log in</Link>
              <a href="#features">Features</a>
            </div>
            <span className="mono">© {new Date().getFullYear()} VENU · A PRODUCT OF AROLABS</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
