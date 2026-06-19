import { useNavigate, useLocation } from 'react-router-dom';
import { Icon } from '../components/icons';

/*
 * Bottom tab bar with a centre "Book" FAB.
 * Tab order is role-aware:
 *   Student/Staff:  Home | Venues | [+] | Bookings | Profile
 *   Admin/Recept.:  Home | Queue  | [+] | Venues   | Profile
 */
const STUDENT_TABS = [
  { id: 'home',     label: 'Home',     Icon: Icon.Home,     path: '/dashboard' },
  { id: 'venues',   label: 'Venues',   Icon: Icon.Venues,   path: '/venues' },
  { id: 'book',     label: null,       Icon: null,          path: '/book', isCta: true },
  { id: 'bookings', label: 'Bookings', Icon: Icon.Calendar, path: '/my-bookings' },
  { id: 'profile',  label: 'Profile',  Icon: Icon.Profile,  path: '/profile' },
];

const ADMIN_TABS = [
  { id: 'home',     label: 'Home',    Icon: Icon.Home,      path: '/dashboard' },
  { id: 'queue',    label: 'Queue',   Icon: Icon.Approvals, path: '/approvals', badge: true },
  { id: 'book',     label: null,      Icon: null,           path: '/book', isCta: true },
  { id: 'venues',   label: 'Venues',  Icon: Icon.Venues,    path: '/venues' },
  { id: 'profile',  label: 'Profile', Icon: Icon.Profile,   path: '/profile' },
];

export default function BottomTabBar({ isAdmin, pendingCount = 0 }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const tabs = isAdmin ? ADMIN_TABS : STUDENT_TABS;

  const isActive = (path) =>
    path === '/dashboard'
      ? pathname === '/dashboard'
      : pathname === path || pathname.startsWith(path + '/');

  return (
    <nav className="m-tab-bar" aria-label="Primary">
      {tabs.map((t) => {
        if (t.isCta) {
          return (
            <button
              key={t.id}
              className="m-tab m-tab-cta"
              aria-label="Book a room"
              onClick={() => navigate('/book')}
            >
              <span className="m-book-fab"><Icon.Plus width={26} height={26} /></span>
            </button>
          );
        }
        const active = isActive(t.path);
        const showBadge = t.badge && pendingCount > 0;
        return (
          <button
            key={t.id}
            className={`m-tab${active ? ' active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => navigate(t.path)}
          >
            <t.Icon className="m-tab-svg" width={24} height={24} />
            <span className="m-tab-lbl">{t.label}</span>
            {showBadge && <span className="m-badge-dot" aria-hidden="true" />}
          </button>
        );
      })}
    </nav>
  );
}
