# VenU vs. the Market — One-Page Brief

**For:** Director review · **Re:** Campus venue booking for UHAS
**Built by:** in-house · **Hosting:** Vercel + Render + Neon Postgres

---

## The short version
VenU already **matches or beats** the booking systems universities buy
(25Live, Accruent EMS) and the suites they make do with (Microsoft 365,
Google Calendar) — at no per-seat licence cost. It is mobile-first, installable
as an app, and now carries the institutional-grade security that procurement
checks for.

---

## What VenU does that the incumbents don't
| Capability | VenU | 25Live / EMS | Microsoft 365 | Google Calendar |
|---|:--:|:--:|:--:|:--:|
| Mobile-first app (installable PWA, offline shell) | ✅ | ✕ (dated web) | partial | partial |
| Approval workflow (reasons, bulk, queue) | ✅ | ✅ | ✕ | ✕ |
| **AI venue suggestions on a clash** | ✅ | ✕ | ✕ | ✕ |
| QR check-in + no-show auto-release | ✅ | add-on | ✕ | ✕ |
| Live "find a free room" grid | ✅ | ✅ | ✅ | partial |
| Analytics dashboard + CSV export | ✅ | ✅ | ✕ | ✕ |
| Recurring bookings, waitlist, capacity rules | ✅ | ✅ | partial | partial |
| Push + email notifications | ✅ | ✅ | ✅ | ✅ |
| Role/per-venue access (staff/student) | ✅ | ✅ | partial | partial |

## Security & access (procurement checklist)
| Control | Status |
|---|:--:|
| HTTPS, HSTS + preload, secure cookies | ✅ |
| **Two-factor auth (TOTP) + backup codes** | ✅ |
| **Self-service password reset & change** | ✅ |
| Login throttling / brute-force protection | ✅ |
| JWT with refresh rotation + revocation | ✅ |
| Role-based authorisation, audit trail | ✅ |
| **SSO (Microsoft Entra ID, OIDC)** | ⚙️ built, config-only to enable |
| Automated test suite | ✅ 84 backend tests |

## Delivered this cycle
Self-service password reset · two-factor authentication · analytics &
reporting dashboard · cross-venue "find a room" timetable · SSO scaffold ·
mobile push notifications · access-aware AI suggestions · timezone/security
hardening.

## Honest roadmap (phase 2)
- **Enable SSO** against the UHAS Microsoft tenant (1–2 hrs of IT config; guide written).
- **Two-way Outlook/Google calendar sync** (we export iCal one-way today).
- **Native iOS/Android wrappers** (PWA already installable).
- **Service add-ons** (AV/catering) and deeper BI exports.

## Bottom line
VenU is **demo-ready and rollout-ready for pilot**. The remaining items are
integrations and phase-2 polish — not gaps in the core product. The capability
and UX already exceed what comparable institutions pay six figures a year for.
