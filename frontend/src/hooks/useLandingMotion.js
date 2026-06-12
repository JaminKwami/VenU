import { useEffect } from 'react';

/*
 * Landing cinematic scroll engine (port of assets/landing.js):
 * nav solidify, parallax, sticky-step tracking, pinned scale headline,
 * count-ups and magnetic buttons. Parallax + magnetism are disabled by
 * prefers-reduced-motion and by the "Calm" motion setting.
 */
export function useLandingMotion(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const calm = () => document.documentElement.getAttribute('data-motion') === 'calm';

    const nav = root.querySelector('.lp-nav');
    const parallax = Array.from(root.querySelectorAll('[data-parallax]'));
    const steps = Array.from(root.querySelectorAll('.step-item'));
    const bigNum = root.querySelector('.steps-sticky .big-num');
    const bigLabel = root.querySelector('.steps-sticky .big-label');
    const scaleSec = root.querySelector('.scale-sec');
    const scaleBig = root.querySelector('.scale-pin .big');
    const STEP_LABELS = ['Discover the space', 'Request a slot', 'Get the green light'];

    // hero underline draw-in
    const underlines = root.querySelectorAll('.hero h1 .underline');
    const drawT = setTimeout(() => underlines.forEach(u => u.classList.add('draw')), 150);

    let ticking = false;
    function onScroll() {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }
    function update() {
      ticking = false;
      const y = window.scrollY;
      const vh = window.innerHeight;

      if (nav) nav.classList.toggle('solid', y > 40);

      if (!reduce && !calm()) {
        for (const el of parallax) {
          const sp = parseFloat(el.dataset.parallax) || 0.1;
          el.style.transform = `translate3d(0,${y * sp * -1}px,0)`;
        }
      } else {
        for (const el of parallax) el.style.transform = '';
      }

      if (steps.length) {
        const mid = y + vh * 0.42;
        let act = 0;
        steps.forEach((s, i) => {
          const top = s.getBoundingClientRect().top + y;
          if (mid >= top) act = i;
        });
        steps.forEach((s, i) => s.classList.toggle('active', i === act));
        if (bigNum) bigNum.textContent = '0' + (act + 1);
        if (bigLabel) bigLabel.textContent = STEP_LABELS[act] || '';
      }

      if (scaleSec && scaleBig && !reduce) {
        const rect = scaleSec.getBoundingClientRect();
        const total = scaleSec.offsetHeight - vh;
        const p = Math.min(1, Math.max(0, -rect.top / total));
        scaleBig.style.transform = `scale(${(0.62 + p * 0.55).toFixed(3)})`;
        scaleBig.style.opacity = (0.25 + Math.min(1, p * 2.2) * 0.75).toFixed(3);
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', update);
    update();

    // count-ups
    const counters = Array.from(root.querySelectorAll('[data-count]'));
    function runCounter(el) {
      const target = parseFloat(el.dataset.count);
      const dec = el.dataset.count.indexOf('.') > -1 ? 1 : 0;
      const suffix = el.dataset.suffix || '';
      if (reduce) { el.textContent = (dec ? target.toFixed(1) : String(target)) + suffix; return; }
      const dur = 1400; const t0 = performance.now();
      function tick(t) {
        const p = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        const val = target * e;
        el.textContent = (dec ? val.toFixed(1) : Math.round(val).toLocaleString()) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
    let pend = counters.slice();
    function checkCount() {
      const vh = window.innerHeight;
      pend = pend.filter(el => {
        const r = el.getBoundingClientRect();
        if (r.top < vh * 0.9 && r.bottom > 0) { runCounter(el); return false; }
        return true;
      });
      if (!pend.length) window.removeEventListener('scroll', checkCount);
    }
    window.addEventListener('scroll', checkCount, { passive: true });
    checkCount();

    // magnetic buttons
    const magnets = [];
    if (!reduce) {
      root.querySelectorAll('[data-magnetic]').forEach(btn => {
        const move = (e) => {
          if (calm()) { btn.style.transform = ''; return; }
          const r = btn.getBoundingClientRect();
          const mx = e.clientX - r.left - r.width / 2;
          const my = e.clientY - r.top - r.height / 2;
          btn.style.transform = `translate(${mx * 0.18}px,${my * 0.28}px)`;
        };
        const leave = () => { btn.style.transform = ''; };
        btn.addEventListener('mousemove', move);
        btn.addEventListener('mouseleave', leave);
        magnets.push([btn, move, leave]);
      });
    }

    return () => {
      clearTimeout(drawT);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', checkCount);
      magnets.forEach(([btn, move, leave]) => {
        btn.removeEventListener('mousemove', move);
        btn.removeEventListener('mouseleave', leave);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
