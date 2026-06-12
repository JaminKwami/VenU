# Handoff: VenU 2.0 — "Blueprint" UI/UX Overhaul

## Overview
VenU is a campus venue-booking platform (by AroLabs) for universities — students/staff
discover bookable spaces (lecture halls, studios, labs, outdoor areas), request time slots,
and facilities admins approve them. This package is a **complete visual + UX reinvention**
("Blueprint" design language) covering every screen: marketing landing page, auth, the
student app (dashboard, venue browse, venue detail, booking flow) and the admin app
(approvals queue, venue management).

It includes a full design system (tokens + components), light **and** dark themes, a
user-facing appearance control (theme / accent / motion), and cinematic scroll motion on
the landing page.

---

## About the Design Files
The files in this bundle are **design references built in plain HTML/CSS/JS** — prototypes
that demonstrate the intended look, layout, copy and interaction. **They are not meant to be
shipped as-is.** The task is to **recreate these designs inside the target codebase's existing
environment**, using its established conventions and libraries.

VenU's current stack (from the repo) is **React 18 + Vite + React Router + Zustand**, with
CSS Modules and a global `index.css`. The natural implementation path:
- Port the design tokens (below) into the global stylesheet / CSS custom properties.
- Rebuild each screen as a React route/component using the existing `react-router` + `axios`
  + `zustand` patterns already in the repo (`useAuthStore`, `api` client, `usePageTitle`).
- Replace the prototypes' hard-coded mock data with real API calls.
- The shared "app shell" (sidebar + topbar) maps to the existing `Layout.jsx`.

If implementing fresh with no environment, React + Vite (matching the repo) is the recommended
choice.

---

## Fidelity
**High-fidelity (hifi).** These are pixel-level mockups with final colors, typography,
spacing, radii, shadows, motion timing and real copy. Recreate the UI faithfully using the
codebase's component primitives. Exact values are documented in **Design Tokens** below and
live in `assets/venu.css`.

---

## Design Language — at a glance
- **Concept:** "Blueprint" — architectural/spatial, fit for a product about physical campus
  spaces. Hairline grids, isometric venue tiles, mono "coordinate/data" labels, calm editorial type.
- **Type:** `Bricolage Grotesque` (display/headlines), `Hanken Grotesk` (UI/body),
  `Space Mono` (labels, stats, coordinates). All via Google Fonts.
- **Color:** cool architectural paper, near-black ink, **cobalt** primary, **coral** signal accent.
- **Motion:** spring `cubic-bezier(0.34,1.56,0.64,1)` for interactions; cinematic scroll
  (parallax, pinned scale, reveal-on-scroll, counters) on the landing page. All entrance
  animations are written so content is never permanently hidden if animation frames are paused
  (`prefers-reduced-motion` fully respected).

---

## Design Tokens
All tokens are CSS custom properties in `assets/venu.css` (`:root` = light, `[data-theme="dark"]`
overrides). Accent is themeable via `[data-accent="…"]`.

### Color — Light (`:root`)
| Token | Value | Use |
|---|---|---|
| `--canvas` | `#f3f2ec` | app background |
| `--canvas-2` | `#e9e7df` | recessed/track fills |
| `--surface` | `#ffffff` | cards, sidebar, inputs |
| `--surface-2` | `#fbfaf6` | subtle raised/zebra |
| `--ink` | `#16171c` | primary text |
| `--ink-80 / 65 / 45 / 28` | rgba(22,23,28, .80/.62/.45/.28) | text tiers |
| `--line` | `rgba(22,23,28,.10)` | hairline borders |
| `--line-2` | `rgba(22,23,28,.16)` | stronger borders |
| `--grid-line` | `rgba(22,23,28,.045)` | blueprint grid |
| `--accent` (cobalt) | `#2a4ddb` | primary actions, active states |
| `--accent-2` | `#1b36a8` | hover/darker |
| `--accent-ink` | `#1b36a8` | accent text on light |
| `--accent-soft` | `rgba(42,77,219,.10)` | accent fills/tints |
| `--accent-line` | `rgba(42,77,219,.28)` | accent borders |
| `--coral` | `#ff5a36` | secondary signal |
| `--coral-soft` | `rgba(255,90,54,.12)` | coral tint |
| `--success` | `#1f7a4d` | approved/open |
| `--warn` | `#a9711a` | pending/maintenance |
| `--danger` | `#c13a2b` | rejected/declined |
| *(each semantic has a `-soft` tint variant)* | | badges, banners |

### Color — Dark (`[data-theme="dark"]`)
| Token | Value |
|---|---|
| `--canvas` | `#0d0e12` |
| `--canvas-2` | `#08090c` |
| `--surface` | `#15171e` |
| `--surface-2` | `#1b1e27` |
| `--ink` | `#eceae3` |
| `--line` | `rgba(236,234,227,.12)` |
| `--accent` (cobalt) | `#6a86ff` |
| `--accent-ink` | `#9db0ff` |
| `--coral` | `#ff7355` |

### Accent variants (`[data-accent="…"]`)
`cobalt` (default), `coral` `#ff5a36`, `evergreen` `#1f6c52`, `violet` `#6b3df0`,
`amber` `#d2861a`. Each redefines `--accent`, `--accent-2`, `--accent-ink`, `--accent-soft`,
`--accent-line`, `--sh-accent`, with brighter dark-mode counterparts.

### Radius
`--r-xs 5px` · `--r-sm 9px` · `--r-md 13px` · `--r-lg 20px` · `--r-xl 28px`

### Shadows
- `--sh-1` `0 1px 2px rgba(16,18,28,.06), 0 1px 1px rgba(16,18,28,.04)` (resting)
- `--sh-2` `0 6px 20px -6px rgba(16,18,28,.14)` (raised)
- `--sh-3` `0 22px 60px -16px rgba(16,18,28,.26)` (hover lift / overlays)
- `--sh-accent` `0 12px 30px -10px rgba(42,77,219,.45)` (primary buttons)

### Motion
- `--spring` `cubic-bezier(0.34,1.56,0.64,1)` — buttons, toggles, springy microinteractions
- `--ease` `cubic-bezier(0.22,0.61,0.36,1)` — fades, color/theme transitions
- Entrance reveals: `opacity 0→1` + `translateY(26px)→0` over `0.9s`, staggered via
  `data-d="1..5"` (delay 0.08s steps).
- Theme change: body `background`/`color` transition `0.5s var(--ease)`.

### Type scale
- Display sizes are fluid via `clamp()`. Headlines `font-display`, weight 600, letter-spacing
  ~`-0.02em` to `-0.035em`, line-height ~0.98–1.04.
- Body 0.92–1.0rem, `font-sans`.
- Micro-labels / eyebrows: `font-mono`, 0.6–0.72rem, weight 700, `letter-spacing 0.1–0.14em`,
  uppercase. Eyebrow color `--accent-ink`; label color `--ink-45`.
- Minimum body text 0.82rem; never smaller than ~13px.

### Spacing
Page padding `2.2rem` desktop / `1.4rem` mobile. Card padding `1.4–1.6rem`. Grid gaps
`1.0–1.6rem`. Sidebar width `--sidebar-w: 256px`.

---

## Shared App Shell
Built by `assets/venu.js` (`buildShell()`), injected from a host element
`<main class="main" data-shell="<active-nav-id>" data-title="…" data-user="…" data-role="…">`.
Maps to the existing `Layout.jsx`.

- **Sidebar** (fixed, 256px, `--surface`, right hairline): brand (cobalt rounded "V" mark +
  "VenU" in Bricolage) → nav groups (`WORKSPACE`: Dashboard, Venues, New Booking · `ADMINISTRATION`:
  Approvals [count badge], Manage Venues) → user block (avatar initials, name, role, logout).
  Active link: `--accent-ink` text, `--accent-soft` bg, 3px cobalt indicator on the left edge.
- **Topbar** (sticky, blurred `--canvas` 80%): page title (Bricolage 1.32rem) on the left;
  on the right the page's own actions, then a notification bell (coral unread dot), then the
  **appearance control** (sun icon → popover).
- **Mobile** (≤900px): sidebar slides off-canvas behind a scrim; a `.mobile-bar` with a hamburger
  replaces the topbar. Drawer animates with `--spring`.

### Appearance control (`venu.js`)
Sun icon opens a popover with: **Theme** segmented [Light · Dark], **Accent** swatches
[cobalt, coral, evergreen, violet, amber], **Motion** segmented [Cinematic · Calm].
State persists to `localStorage` key `venu_appearance_v1` (`{theme, accent, motion}`) and is
applied pre-paint by a tiny inline `<head>` script on every page (prevents FOUC). In the app
this should become a user Settings/Appearance preference.

---

## Screens / Views

### 1. Landing page — `index.html`
- **Purpose:** Marketing entry; convert visitors to sign up / browse.
- **Layout:** Full-bleed sections, max content width 1200–1280px centered.
- **Sections (top→bottom):**
  1. **Fixed nav** — transparent, gains blurred `--canvas` background + hairline on scroll
     (`.solid`, toggled past 40px). Brand left; center links (How it works / Venues / Features /
     Browse); right: appearance control + "Log in" (ghost) + "Get started" (primary, magnetic).
  2. **Hero** (min 100vh) — blueprint grid backdrop (masked radial), two soft glows (cobalt +
     coral) — all parallax (`data-parallax` speeds 0.06–0.30, translateY on scroll). Left:
     pill eyebrow ("Campus venue booking · AroLabs" with pulsing dot), `h1` clamp(2.7→5.1rem)
     "Book any space on campus before the idea *cools*." (coral underline draws in on load),
     sub-paragraph, two CTAs, and a 4-stat meta row with **count-up** animation
     (240+, 18, 12k, 4.9). Right: 3 floating "blueprint" venue cards (parallax depth) — hidden
     below 980px. Scroll cue at the bottom.
  3. **Trust strip** — full-width ink band, horizontally scrolling mono marquee of space types.
  4. **How it works** (`#how`) — 2-col; left is a **sticky** big number (`01/02/03`) + label that
     updates as you scroll; right is 3 step cards (Discover / Request / Confirmed) that
     activate (cobalt border + lift) as their section reaches viewport center.
  5. **Featured venues** (`#venues`, `.alt` surface band) — section head with "View all" CTA +
     3 venue cards (gradient+iso-grid header, status badge, capacity, amenity hint; hover lifts
     and scales the grid).
  6. **Features** (`#features`) — 3×2 grid of feature cards (icon tile rotates on hover, title,
     copy): Live availability, Conflict detection, Approvals that flow, Capacity-aware,
     Calendar at a glance, Role-based access.
  7. **Scale statement** — 200vh pinned section; the headline "Built for how campus *actually*
     works." scales from 0.62→1.17 and fades in as you scroll through.
  8. **Quote** (`.alt` band) — centered facilities-director testimonial with avatar.
  9. **CTA** — ink rounded box with masked grid, "Your next booking is 30 seconds away." + CTAs.
  10. **Footer** — brand, link row, mono copyright.
- **Reveal-on-scroll** applied to most blocks via `.reveal` (+ `data-d` stagger).

### 2. Login / Signup — `login.html`
- **Purpose:** Authenticate; toggle between log in and sign up.
- **Layout:** 2-col split (1.1fr aside / 1fr form). Aside hidden ≤860px.
- **Aside:** ink panel, masked blueprint grid + cobalt glow, brand top, headline "The whole
  campus, bookable.", lede, 3 stat chips (240+, 18, 4.9★), mono copyright.
- **Form (max 380px, centered):** top row "Home" ghost button + appearance control; title +
  subtitle; **segmented tabs** [Log in · Sign up]; fields (Full name — sign-up only; University
  email; Password; sign-up hides "remember me / forgot"); primary submit (label swaps);
  "or continue with" divider; SSO grid [University SSO · Google]. Form entrance: slide-up.

### 3. Dashboard — `dashboard.html` (student)
- **Purpose:** Student home — upcoming bookings, pending requests, quick actions, activity.
- **Layout:** page-head greeting → 4-col stat row → 2-col grid (1.6fr main / 1fr aside).
  Stats collapse to 2-col, grid to 1-col ≤1040px.
- **Components:**
  - **Stat cards** (×4): colored left accent strip, mono label, big Bricolage value, sub-note —
    Upcoming (4), Pending (2, warn), Hours/term (36, success), Most booked (Briggs Studio, coral).
  - **Upcoming bookings** card: header + "Book another"; rows = date chip (day/month) + title +
    "venue · time · cap" + status badge (Approved/Pending). 4 realistic rows.
  - **This week** card: 7-day strip, today highlighted (cobalt), dots mark booked days.
  - **Quick actions** card: 3 large rows (New booking, Browse venues, Review approvals) — icon
    tile + title + desc; hover slides right + accent tint.
  - **Recent activity** card: colored-dot timeline (approved/requested/hold/declined) + mono timestamps.

### 4. Venues browse — `venues.html`
- **Purpose:** Discover/filter all spaces.
- **Layout:** page-head → filter bar (search box, building select, capacity select, "showing
  X of Y") → type chips row → responsive card grid `repeat(auto-fill,minmax(290px,1fr))`.
- **Venue card:** gradient + iso-grid visual (scales on hover), status badge (Open/Filling/
  Fully booked) top-left, "CAP n" pill bottom-right; body = name, "building · type" mono meta,
  amenity pills, footer rating (★) + "View & book". Whole card links to `venue.html`.
- Cards are rendered from a `VENUES` data array (9 seeded). Status→badge map:
  open→approved, filling→pending, full→cancelled.

### 5. Venue detail — `venue.html` (NEW screen)
- **Purpose:** Full venue info + request a slot.
- **Layout:** breadcrumb → hero banner (280px, gradient + iso-grid + bottom shade; status +
  rating badges top, name + "building · level · type" bottom) → 2-col (1.7fr / 1fr).
- **Left:** 4 spec tiles (Capacity 420, Floor area 540m², Setup Tiered, Min notice 48hrs);
  "About this space"; "Amenities" 2-col list w/ icons; "Availability" card — 3-day slot grid
  (available / booked / your-hold legend, slots scale on hover).
- **Right (sticky `book-panel`):** "Request this space"; date input; **time-slot pill grid**
  (one selected, some disabled); summary lines (slot, capacity, approver, status "Will hold");
  primary "Continue to request" → `book.html`; ghost "Save to favourites".

### 6. New booking flow — `book.html`
- **Purpose:** 4-step request wizard.
- **Layout:** page-head → **stepper** (Space · Schedule · Details · Confirm; numbered circles
  go on→done with cobalt/success) → 2-col (1.6fr card / 1fr sticky summary).
- **Steps** (`.step-panel`, slide-in on change):
  1. **Space** — 2-col venue picker (selectable, cobalt when active) + "browse all" link.
  2. **Schedule** — date input, 4-col start-time grid (busy slots disabled), duration select,
     and a **conflict banner** (`ok` green / warn) that updates live per slot — e.g. 09:00 &
     13:00 simulate a clash and suggest "nearest free 14:00".
  3. **Details** — purpose, attendees (number), department select, notes textarea, policy checkbox.
  4. **Confirm** — success ring (pops), "Request submitted!", reference `#VENU-4821`, CTAs to
     dashboard / book another.
- **Summary card (sticky):** venue, location, date, time, attendees, approver; updates live as
  the user picks a venue / time / attendee count. Nav row: Back (hidden on step 1) + Continue
  (becomes "Submit request" on step 3; nav row hidden on step 4).

### 7. Approvals — `approvals.html` (admin)
- **Purpose:** Facilities admin reviews/actions the request queue. (User shown: "Dana Reyes ·
  Facilities · Admin".)
- **Layout:** page-head ("6 pending") → 4 stat cards (Pending 6, Approved today 14, Declined 2,
  Avg response 2.4h) → filter chips → 2-col (1.5fr list / 1fr sticky detail).
- **Request list:** rows = requester avatar, title, "venue · who", mono when, Pending badge,
  and inline approve (✓) / decline (✗) mini-buttons (hover green/red). Clicking a row selects
  it (cobalt rail + tint) and fills the detail panel.
- **Detail panel (sticky):** venue thumb + title; requested-by / department / when / attendees;
  **capacity bar** (turns warn >90%); italic request note; primary "Approve request" + "Comment"
  + danger "Decline". Actioning a row flips its badge to Approved/Declined, hides mini-buttons,
  dims it. Data from a `REQS` array (6 seeded).

### 8. Manage venues — `manage.html` (admin)
- **Purpose:** Admin catalogue management.
- **Layout:** page-head → 4 stat cards (Total 240, Bookable 228, Maintenance 12, Avg
  utilisation 68%) → toolbar (search + building/status selects) → data table.
- **Table columns:** Venue (thumb + name + location), Type (badge, hidden ≤980px), Capacity
  (mono), Utilisation (mini cap-bar + %, hidden ≤980px; bar turns warn >90%), Status
  (Live/Maintenance badge), Bookable (custom **toggle** switch, springy), Actions (edit / view
  icon buttons). Topbar action: "Add venue". Data from a `ROWS` array (9 seeded).

---

## Interactions & Behavior
- **Navigation:** every CTA/nav/card links across pages with relative hrefs (landing → login →
  dashboard → venues → venue → book → approvals → manage). In React these become routes.
- **Landing scroll engine** (`assets/landing.js`): nav solidify; parallax (`data-parallax`);
  sticky-step active tracking; pinned scale headline; count-ups (rect-triggered); magnetic
  buttons (`data-magnetic`, translate toward cursor). All gated on `prefers-reduced-motion`
  and the "Calm" motion setting (disables parallax/magnetism).
- **Reveals** (`assets/venu.js` `initReveals`): rect-based on scroll/resize with a safety
  timeout that force-shows content if frames are paused — so nothing can get stuck invisible.
  Reimplement in React with IntersectionObserver **plus** an equivalent visible-by-default
  fallback.
- **Booking wizard:** step state (1–4), per-step panel show/hide, live summary binding, simulated
  conflict detection on time selection.
- **Approvals:** selected-row state, approve/decline mutate row status locally.
- **Toggles / pills / chips / tabs:** active state toggling with spring transitions.
- **Hover/active:** buttons lift `translateY(-2px)` + shadow on hover, `scale(0.96)` on active;
  cards lift `translateY(-4..6px)` to `--sh-3`; icon tiles rotate slightly.

## State Management (for the React port)
- **Appearance:** `{ theme, accent, motion }` — global (Zustand store or context), persisted to
  `localStorage`, applied to `<html data-theme data-accent data-motion>`; set pre-hydration to
  avoid FOUC.
- **Auth/role:** existing `useAuthStore`; gate the Administration nav group + admin routes by role.
- **Per-screen:** venues filter/search state; venue-detail selected date/slot; booking wizard
  (step, venue, date, time, duration, purpose, attendees, dept, notes, agree); approvals
  (selected id, per-request status); manage (search/filters, per-row bookable + status).
- **Data fetching:** replace all seeded arrays (`VENUES`, `REQS`, `ROWS`, dashboard lists) with
  the existing `api` (axios) client; statuses map to the badge classes above.

## Responsive behavior
- Sidebar → off-canvas drawer + mobile bar ≤900px.
- Stat rows 4→2 col, main grids →1 col ≤980–1040px.
- Hero side cards / auth aside hidden on small screens.
- Venue grid is intrinsically responsive (`auto-fill minmax`).

---

## Assets
- **Fonts:** Google Fonts — Bricolage Grotesque, Hanken Grotesk, Space Mono (imported at the top
  of `assets/venu.css`). Self-host in production if preferred.
- **Icons:** inline SVG (stroke style, 1.7–2 weight) — in `venu.js` (nav/topbar) and inline per
  page. Swap for the codebase's icon set (e.g. Lucide — these match its visual style).
- **Imagery:** none. Venue "photos" are intentionally rendered as CSS gradient + isometric grid
  tiles ("blueprint" motif). Replace with real images later by dropping `<img>`/background into
  the `.vis` / `.v-vis` / `v-hero` containers — keep the iso-grid overlay if desired.
- **No external image files** are required by the design.

---

## Files (in this bundle)
| File | Screen |
|---|---|
| `index.html` | Landing page |
| `login.html` | Login / Signup |
| `dashboard.html` | Student dashboard |
| `venues.html` | Venue browse |
| `venue.html` | Venue detail (new) |
| `book.html` | Booking wizard |
| `approvals.html` | Admin approvals |
| `manage.html` | Admin manage venues |
| `assets/venu.css` | **Design system** — all tokens, components, themes, shell, responsive |
| `assets/venu.js` | App shell builder + appearance control + reveals |
| `assets/landing.css` | Landing-only styles |
| `assets/landing.js` | Landing cinematic scroll engine |

Open `index.html` and click through to experience the full flow and all motion. Toggle the
sun icon (top-right) for dark mode / accent / motion.
