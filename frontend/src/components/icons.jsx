/* Inline stroke icons from the Blueprint handoff (venu.js). */

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBox: '0 0 24 24',
};

export const Icon = {
  Dash: (p) => (
    <svg {...base} {...p}><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
  ),
  Venues: (p) => (
    <svg {...base} {...p}><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3"/><path d="M9 9v.01M9 13v.01M9 17v.01"/></svg>
  ),
  Book: (p) => (
    <svg {...base} {...p}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="m9 15 2 2 4-4"/></svg>
  ),
  Approvals: (p) => (
    <svg {...base} {...p}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
  ),
  Manage: (p) => (
    <svg {...base} {...p}><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/><circle cx="12" cy="12" r="3"/></svg>
  ),
  Sun: (p) => (
    <svg {...base} {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
  ),
  Menu: (p) => (
    <svg {...base} strokeWidth={1.8} {...p}><path d="M3 6h18M3 12h18M3 18h18"/></svg>
  ),
  Logout: (p) => (
    <svg {...base} {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
  ),
  Plus: (p) => (
    <svg {...base} strokeWidth={2.2} {...p}><path d="M12 5v14M5 12h14"/></svg>
  ),
  Arrow: (p) => (
    <svg {...base} strokeWidth={2} {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>
  ),
  ArrowLeft: (p) => (
    <svg {...base} strokeWidth={2} {...p}><path d="M19 12H5M11 18l-6-6 6-6"/></svg>
  ),
  Check: (p) => (
    <svg {...base} strokeWidth={2.4} {...p}><path d="M20 6 9 17l-5-5"/></svg>
  ),
  X: (p) => (
    <svg {...base} strokeWidth={2.4} {...p}><path d="M18 6 6 18M6 6l12 12"/></svg>
  ),
  Search: (p) => (
    <svg {...base} strokeWidth={2} {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
  ),
  Clock: (p) => (
    <svg {...base} strokeWidth={1.8} {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
  ),
  Shield: (p) => (
    <svg {...base} strokeWidth={1.8} {...p}><path d="M12 2 4 6v6c0 5 8 8 8 8s8-3 8-8V6Z"/><path d="m9 12 2 2 4-4"/></svg>
  ),
  Clipboard: (p) => (
    <svg {...base} strokeWidth={1.8} {...p}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="m9 14 2 2 4-4"/></svg>
  ),
  Users: (p) => (
    <svg {...base} strokeWidth={1.8} {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ),
  Calendar: (p) => (
    <svg {...base} strokeWidth={1.8} {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></svg>
  ),
  Layers: (p) => (
    <svg {...base} strokeWidth={1.8} {...p}><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/></svg>
  ),
  Edit: (p) => (
    <svg {...base} strokeWidth={1.9} {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
  ),
  Eye: (p) => (
    <svg {...base} strokeWidth={1.9} {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
  ),
  Settings: (p) => (
    <svg {...base} strokeWidth={1.8} {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
  ),
  ChevronLeft: (p) => (
    <svg {...base} strokeWidth={2.2} {...p}><path d="M15 18l-6-6 6-6"/></svg>
  ),
  ChevronRight: (p) => (
    <svg {...base} strokeWidth={2.2} {...p}><path d="M9 18l6-6-6-6"/></svg>
  ),
};
