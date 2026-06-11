import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePageTitle } from '../hooks/usePageTitle';
import styles from './LandingPage.module.css';

/* Reveal-on-scroll: adds a class when the element enters the viewport. */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add(styles.revealed);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, delay = 0, as: Tag = 'div', className = '' }) {
  const ref = useReveal();
  return (
    <Tag ref={ref} className={`${styles.reveal} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

const FEATURES = [
  {
    title: 'Browse every space',
    body: 'Lecture halls, labs and event rooms in one searchable catalogue, each with its location and capacity.',
    icon: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" />,
  },
  {
    title: 'See availability first',
    body: 'Pick a venue and date and the taken slots appear before you submit — no blind requests, no surprises.',
    icon: <path d="M12 8v4l3 3 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />,
  },
  {
    title: 'No double bookings',
    body: 'Every request is checked for time conflicts against pending and approved bookings, automatically.',
    icon: <path d="M9 12l2 2 4-4 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />,
  },
  {
    title: 'Clear approval flow',
    body: 'Requests go to administrators for review. Approvals and rejections come back with a reason attached.',
    icon: <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3" />,
  },
  {
    title: 'Cancel when plans change',
    body: 'Withdraw a pending or approved booking up to the day of the event and the slot frees up instantly.',
    icon: <path d="M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />,
  },
  {
    title: 'A record of every decision',
    body: 'Who approved, who rejected, and when — each booking keeps its history for accountability.',
    icon: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" />,
  },
];

const STEPS = [
  { n: '01', title: 'Find a space', body: 'Search venues by name or location and check the capacity fits your group.' },
  { n: '02', title: 'Request a slot', body: 'Choose a date and time — VenU shows what’s already taken so you pick a free window.' },
  { n: '03', title: 'Get the decision', body: 'An administrator reviews your request. You’ll see the outcome (and any reason) on your dashboard.' },
];

export default function LandingPage() {
  usePageTitle('Venue booking for institutions');
  const { accessToken } = useAuthStore();
  const heroRef = useRef(null);

  /* Parallax: drive a unitless CSS var from scroll position. */
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--sy', String(Math.min(window.scrollY, 900)));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);

  const cta = accessToken ? '/dashboard' : '/login';
  const ctaLabel = accessToken ? 'Open dashboard' : 'Sign in';

  return (
    <div className={styles.page} ref={heroRef}>
      {/* ── Top bar ── */}
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <div className={styles.logoRow}>
            <span className={styles.logoMark}>V</span>
            <span className={styles.logoText}>VenU</span>
          </div>
          <Link to={cta} className="btn btn-primary" style={{ padding: '0.5rem 1.1rem' }}>
            {ctaLabel}
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={`${styles.blob} ${styles.blobA}`} aria-hidden="true" />
        <div className={`${styles.blob} ${styles.blobB}`} aria-hidden="true" />

        <div className={styles.heroInner}>
          <p className={styles.kicker}>Venue booking for institutions</p>
          <h1 className={styles.heroTitle}>
            Book campus spaces<br />
            <em>without the back-and-forth.</em>
          </h1>
          <p className={styles.heroSub}>
            VenU puts your institution&rsquo;s venues, availability and approvals in one place —
            so a room request takes a minute, not a chain of emails.
          </p>
          <div className={styles.heroCtas}>
            <Link to={cta} className={`btn btn-primary ${styles.heroBtn}`}>
              {ctaLabel}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={styles.arrow}>
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
            <a href="#how" className={`btn btn-ghost ${styles.heroBtn}`}>How it works</a>
          </div>
          <p className={styles.heroNote}>Accounts are issued by your institution&rsquo;s administrators.</p>
        </div>

        {/* Floating preview cards — parallax at different depths */}
        <div className={styles.floats} aria-hidden="true">
          <div className={`${styles.float} ${styles.floatSlow}`}>
            <div className={styles.miniCard}>
              <div className={styles.miniTitle}>Main Auditorium</div>
              <div className={styles.miniMeta}>North Campus · seats 400</div>
              <div className={styles.miniBar}><span style={{ width: '78%' }} /></div>
            </div>
          </div>
          <div className={`${styles.float} ${styles.floatFast}`}>
            <div className={`${styles.miniCard} ${styles.miniPill}`}>
              <span className={styles.dotApproved} /> Booking approved · 10:00–12:00
            </div>
          </div>
          <div className={`${styles.float} ${styles.floatMid}`}>
            <div className={`${styles.miniCard} ${styles.miniPill}`}>
              <span className={styles.dotPending} /> Pending review
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className={styles.section}>
        <Reveal>
          <h2 className={styles.sectionTitle}>Everything a booking actually needs</h2>
        </Reveal>
        <div className={styles.featureGrid}>
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 60} className={styles.featureCard}>
              <span className={styles.featureIcon}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{f.icon}</svg>
              </span>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureBody}>{f.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className={`${styles.section} ${styles.sectionAlt}`} id="how">
        <Reveal>
          <h2 className={styles.sectionTitle}>Three steps, start to finish</h2>
        </Reveal>
        <div className={styles.steps}>
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 90} className={styles.step}>
              <span className={styles.stepNum}>{s.n}</span>
              <h3 className={styles.featureTitle}>{s.title}</h3>
              <p className={styles.featureBody}>{s.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className={styles.ctaBand}>
        <Reveal>
          <h2 className={styles.ctaTitle}>Ready to book a space?</h2>
          <p className={styles.ctaSub}>Sign in with the account your institution gave you and make your first request.</p>
          <Link to={cta} className={`btn ${styles.ctaBtn}`}>{ctaLabel} →</Link>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.logoRow}>
            <span className={styles.logoMark}>V</span>
            <span className={styles.logoText}>VenU</span>
          </div>
          <p className={styles.footerNote}>
            A product of <strong>AroLabs</strong> · © {new Date().getFullYear()} AroLabs
          </p>
        </div>
      </footer>
    </div>
  );
}
