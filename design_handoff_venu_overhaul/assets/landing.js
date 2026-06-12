/* ════════════════════════════════════════════════════════════════
   VenU 2.0 — Landing page cinematic scroll engine
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const calm = () => document.documentElement.getAttribute('data-motion') === 'calm';

  // nav solidify
  const nav = document.querySelector('.lp-nav');
  // hero underline draw
  window.addEventListener('load', () => {
    document.querySelectorAll('.hero h1 .underline').forEach(u => u.classList.add('draw'));
  });

  // parallax elements
  const parallax = Array.from(document.querySelectorAll('[data-parallax]'));
  // step items
  const steps = Array.from(document.querySelectorAll('.step-item'));
  const bigNum = document.querySelector('.steps-sticky .big-num');
  const bigLabel = document.querySelector('.steps-sticky .big-label');
  // scale pin
  const scaleSec = document.querySelector('.scale-sec');
  const scaleBig = document.querySelector('.scale-pin .big');

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
        el.style.transform = 'translate3d(0,' + (y * sp * -1) + 'px,0)';
      }
    } else {
      for (const el of parallax) el.style.transform = '';
    }

    // steps active by viewport center
    if (steps.length) {
      const mid = y + vh * 0.42;
      let act = 0;
      steps.forEach((s, i) => {
        const top = s.offsetTop + (s.offsetParent ? s.offsetParent.offsetTop : 0);
        if (mid >= top) act = i;
      });
      steps.forEach((s, i) => s.classList.toggle('active', i === act));
      if (bigNum) { bigNum.textContent = '0' + (act + 1); }
      if (bigLabel) { bigLabel.textContent = ['Discover the space', 'Request a slot', 'Get the green light'][act] || ''; }
    }

    // scale pin
    if (scaleSec && scaleBig && !reduce) {
      const rect = scaleSec.getBoundingClientRect();
      const total = scaleSec.offsetHeight - vh;
      let p = Math.min(1, Math.max(0, -rect.top / total));
      const scale = 0.62 + p * 0.55;
      scaleBig.style.transform = 'scale(' + scale.toFixed(3) + ')';
      scaleBig.style.opacity = (0.25 + Math.min(1, p * 2.2) * 0.75).toFixed(3);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', update);
  update();

  // counters (rect-based trigger)
  const counters = Array.from(document.querySelectorAll('[data-count]'));
  function runCounter(el) {
    const target = parseFloat(el.dataset.count);
    const dec = (el.dataset.count.indexOf('.') > -1) ? 1 : 0;
    const suffix = el.dataset.suffix || '';
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
  if (counters.length) {
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
  }

  // magnetic buttons (microinteraction)
  if (!reduce) {
    document.querySelectorAll('[data-magnetic]').forEach(btn => {
      btn.addEventListener('mousemove', e => {
        const r = btn.getBoundingClientRect();
        const mx = e.clientX - r.left - r.width / 2;
        const my = e.clientY - r.top - r.height / 2;
        btn.style.transform = 'translate(' + mx * 0.18 + 'px,' + my * 0.28 + 'px)';
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });
  }
})();
