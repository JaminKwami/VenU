/* ════════════════════════════════════════════════════════════════
   VenU 2.0 — shared runtime: app shell, appearance, scroll reveals
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Persisted appearance ───────────────────────────────────────
  const STORE = 'venu_appearance_v1';
  const defaults = { theme: 'light', accent: 'cobalt', motion: 'cinematic' };
  function load() { try { return Object.assign({}, defaults, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) { return Object.assign({}, defaults); } }
  function save(s) { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) {} }
  let state = load();

  function apply() {
    const r = document.documentElement;
    r.setAttribute('data-theme', state.theme);
    r.setAttribute('data-accent', state.accent === 'cobalt' ? '' : state.accent);
    if (state.accent === 'cobalt') r.removeAttribute('data-accent');
    r.setAttribute('data-motion', state.motion);
  }
  apply();
  window.VenU = { get: () => state, set: (k, v) => { state[k] = v; save(state); apply(); document.dispatchEvent(new CustomEvent('venu:appearance', { detail: state })); } };

  // ── Icons ──────────────────────────────────────────────────────
  const I = {
    dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    venues: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3"/><path d="M9 9v.01M9 13v.01M9 17v.01"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="m9 15 2 2 4-4"/></svg>',
    approvals: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    manage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/><circle cx="12" cy="12" r="3"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>'
  };

  const NAV = [
    { sec: 'Workspace' },
    { id: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: I.dash },
    { id: 'venues', label: 'Venues', href: 'venues.html', icon: I.venues },
    { id: 'book', label: 'New Booking', href: 'book.html', icon: I.book },
    { sec: 'Administration' },
    { id: 'approvals', label: 'Approvals', href: 'approvals.html', icon: I.approvals, badge: '6' },
    { id: 'manage', label: 'Manage Venues', href: 'manage.html', icon: I.manage }
  ];

  const ACCENTS = [
    { id: 'cobalt', color: '#2a4ddb' },
    { id: 'coral', color: '#ff5a36' },
    { id: 'evergreen', color: '#1f6c52' },
    { id: 'violet', color: '#6b3df0' },
    { id: 'amber', color: '#d2861a' }
  ];

  // ── Appearance popover markup ──────────────────────────────────
  function appearanceControl() {
    const wrap = document.createElement('div');
    wrap.className = 'pos-rel';
    wrap.innerHTML =
      '<button class="icon-btn" id="appearBtn" aria-label="Appearance" title="Appearance">' + I.sun + '</button>' +
      '<div class="appear-pop" id="appearPop">' +
        '<div class="appear-row"><span class="label">Theme</span>' +
          '<div class="seg" data-seg="theme"><button data-v="light">Light</button><button data-v="dark">Dark</button></div>' +
        '</div>' +
        '<div class="appear-row"><span class="label">Accent</span>' +
          '<div class="swatches">' + ACCENTS.map(a => '<button class="swatch" data-accent="' + a.id + '" style="background:' + a.color + '"></button>').join('') + '</div>' +
        '</div>' +
        '<div class="appear-row"><span class="label">Motion</span>' +
          '<div class="seg" data-seg="motion"><button data-v="cinematic">Cinematic</button><button data-v="calm">Calm</button></div>' +
        '</div>' +
      '</div>';
    return wrap;
  }

  function syncControl() {
    document.querySelectorAll('[data-seg="theme"] button').forEach(b => b.classList.toggle('on', b.dataset.v === state.theme));
    document.querySelectorAll('[data-seg="motion"] button').forEach(b => b.classList.toggle('on', b.dataset.v === state.motion));
    document.querySelectorAll('.swatch').forEach(b => b.classList.toggle('on', b.dataset.accent === state.accent));
  }

  function wireControl(root) {
    const btn = root.querySelector('#appearBtn');
    const pop = root.querySelector('#appearPop');
    if (!btn) return;
    btn.addEventListener('click', e => { e.stopPropagation(); pop.classList.toggle('open'); syncControl(); });
    document.addEventListener('click', e => { if (!root.contains(e.target)) pop.classList.remove('open'); });
    root.querySelectorAll('[data-seg="theme"] button').forEach(b => b.addEventListener('click', () => { window.VenU.set('theme', b.dataset.v); syncControl(); }));
    root.querySelectorAll('[data-seg="motion"] button').forEach(b => b.addEventListener('click', () => { window.VenU.set('motion', b.dataset.v); syncControl(); }));
    root.querySelectorAll('.swatch').forEach(b => b.addEventListener('click', () => { window.VenU.set('accent', b.dataset.accent); syncControl(); }));
  }

  // ── Build app shell ────────────────────────────────────────────
  function buildShell() {
    const host = document.querySelector('[data-shell]');
    if (!host) return;
    const active = host.getAttribute('data-shell');
    const title = host.getAttribute('data-title') || '';
    const user = host.getAttribute('data-user') || 'Maya Chen';
    const role = host.getAttribute('data-role') || 'Student · Engineering';
    const initials = user.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    const navHtml = NAV.map(n => {
      if (n.sec) return '<div class="sb-section">' + n.sec + '</div>';
      const on = n.id === active ? ' active' : '';
      const badge = n.badge ? '<span class="badge badge-accent" style="margin-left:auto;font-size:.6rem;padding:.15em .5em">' + n.badge + '</span>' : '';
      return '<a class="sb-link' + on + '" href="' + n.href + '">' + n.icon + '<span>' + n.label + '</span>' + badge + '</a>';
    }).join('');

    const sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';
    sidebar.id = 'sidebar';
    sidebar.innerHTML =
      '<a class="sb-brand" href="index.html"><span class="sb-mark">V</span><span class="sb-word">VenU</span></a>' +
      '<nav class="sb-nav">' + navHtml + '</nav>' +
      '<div class="sb-user"><span class="avatar">' + initials + '</span>' +
        '<div style="min-width:0;flex:1"><div class="nm">' + user + '</div><div class="rl">' + role + '</div></div>' +
        '<a class="icon-btn" href="login.html" title="Log out" style="width:32px;height:32px;border:none;background:transparent">' + I.logout + '</a>' +
      '</div>';

    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.id = 'scrim';

    document.body.prepend(scrim);
    document.body.prepend(sidebar);

    // topbar appearance control + bell
    const tbActions = host.querySelector('.tb-actions');
    if (tbActions) {
      const bell = document.createElement('button');
      bell.className = 'icon-btn';
      bell.setAttribute('aria-label', 'Notifications');
      bell.innerHTML = I.bell + '<span style="position:absolute;top:8px;right:8px;width:7px;height:7px;border-radius:50%;background:var(--coral);border:1.5px solid var(--canvas)"></span>';
      bell.style.position = 'relative';
      const ac = appearanceControl();
      tbActions.prepend(ac);
      tbActions.prepend(bell);
      wireControl(ac);
    }
    const tbTitle = host.querySelector('.tb-title');
    if (tbTitle && !tbTitle.textContent) tbTitle.textContent = title;

    // mobile bar
    const mbar = document.createElement('div');
    mbar.className = 'mobile-bar';
    mbar.innerHTML = '<button class="icon-btn" id="menuBtn" aria-label="Menu">' + I.menu + '</button>' +
      '<a class="sb-brand" style="padding:0" href="index.html"><span class="sb-mark" style="width:26px;height:26px;font-size:.95rem">V</span><span class="sb-word" style="font-size:1.1rem">VenU</span></a>' +
      '<span style="width:40px"></span>';
    host.prepend(mbar);

    function toggle(open) { sidebar.classList.toggle('open', open); scrim.classList.toggle('show', open); }
    mbar.querySelector('#menuBtn').addEventListener('click', () => toggle(!sidebar.classList.contains('open')));
    scrim.addEventListener('click', () => toggle(false));
  }

  // ── Scroll reveals (rect-based; robust across embed contexts) ──
  function initReveals() {
    const els = Array.from(document.querySelectorAll('.reveal'));
    if (!els.length) return;
    let pending = els;
    function check() {
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const trigger = vh * 0.92;
      pending = pending.filter(el => {
        const r = el.getBoundingClientRect();
        if (r.top < trigger && r.bottom > 0) { el.classList.add('in'); return false; }
        return true;
      });
      if (!pending.length) { window.removeEventListener('scroll', onScr); window.removeEventListener('resize', onScr); }
    }
    let tk = false;
    function onScr() { if (!tk) { requestAnimationFrame(() => { tk = false; check(); }); tk = true; } }
    window.addEventListener('scroll', onScr, { passive: true });
    window.addEventListener('resize', onScr);
    check();
    // safety: if frames are paused (offscreen embeds), force final visible state.
    // Harmless in foreground — all entrance transitions complete by ~1.3s.
    setTimeout(() => {
      els.forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.top < (window.innerHeight || 800) && r.bottom > -200 && parseFloat(getComputedStyle(el).opacity) < 0.99) {
          el.style.transition = 'none';
          el.style.opacity = '1';
          el.style.transform = 'none';
        }
        el.classList.add('in');
      });
    }, 1500);
  }

  document.addEventListener('DOMContentLoaded', function () {
    buildShell();
    initReveals();
    // standalone appearance control (e.g. landing/login) marked [data-appear-host]
    document.querySelectorAll('[data-appear-host]').forEach(h => { const c = appearanceControl(); h.appendChild(c); wireControl(c); });
  });
})();
