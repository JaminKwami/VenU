import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import api from './api/axios';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import VenuesPage from './pages/VenuesPage';
import VenueDetailPage from './pages/VenueDetailPage';
import VenueCalendarPage from './pages/VenueCalendarPage';
import BookingPage from './pages/BookingPage';
import TimetablePage from './pages/TimetablePage';
import ApprovalsPage from './pages/ApprovalsPage';
import ManageVenuesPage from './pages/ManageVenuesPage';
import ManageUsersPage from './pages/ManageUsersPage';
import ReportsPage from './pages/ReportsPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import CheckInKioskPage from './pages/CheckInKioskPage';
import NotFoundPage from './pages/NotFoundPage';
import { useAuthStore } from './store/authStore';
import { useIsMobile } from './hooks/useIsMobile';

// Mobile-first layer (activates ≤900px)
import MobileLayout from './mobile/MobileLayout';
import HomeScreen from './mobile/HomeScreen';
import VenueGrid from './mobile/VenueGrid';
import BookFlow from './mobile/BookFlow';
import MyBookings from './mobile/MyBookings';
import ApprovalQueue from './mobile/ApprovalQueue';
import ProfileScreen from './mobile/ProfileScreen';
import VenueDetail from './mobile/VenueDetail';

function PrivateRoute() {
  const { accessToken } = useAuthStore();
  return accessToken ? <Outlet /> : <Navigate to='/login' replace />;
}

function AdminRoute() {
  const { user, accessToken } = useAuthStore();
  if (!accessToken) return <Navigate to='/login' replace />;
  const canAccess = ['ADMIN', 'RECEPTIONIST'].includes(user?.role);
  return canAccess ? <Outlet /> : <Navigate to='/dashboard' replace />;
}

function SuperAdminRoute() {
  const { user, accessToken } = useAuthStore();
  if (!accessToken) return <Navigate to='/login' replace />;
  return user?.role === 'ADMIN' ? <Outlet /> : <Navigate to='/dashboard' replace />;
}

/* Chrome: mobile bottom-nav shell ≤900px, desktop sidebar ≥901px. */
function Shell() {
  return useIsMobile() ? <MobileLayout /> : <Layout />;
}

/* Picks the right component for the current viewport. */
function Responsive({ mobile, desktop }) {
  return useIsMobile() ? mobile : desktop;
}

export default function App() {
  const { accessToken, user, setUser } = useAuthStore();
  const [authReady, setAuthReady] = useState(false);

  // On a fresh load (e.g. page refresh) only the tokens are rehydrated from
  // localStorage — the `user` object is not persisted. Re-fetch it before
  // rendering any routes, otherwise role-gated guards see a null user and
  // wrongly bounce the admin to /dashboard (looks like a logout).
  useEffect(() => {
    let cancelled = false;
    if (accessToken && !user) {
      api.get('/auth/me/')
        .then(({ data }) => { if (!cancelled) setUser(data); })
        .catch(() => { /* 401 → interceptor refreshes or logs out */ })
        .finally(() => { if (!cancelled) setAuthReady(true); });
    } else {
      setAuthReady(true);
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!authReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <div
          aria-label="Loading"
          style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '3px solid var(--ink-15, #e2e2e2)',
            borderTopColor: 'var(--accent, #18181B)',
            animation: 'venu-spin 0.8s linear infinite',
          }}
        />
        <style>{'@keyframes venu-spin { to { transform: rotate(360deg); } }'}</style>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<LandingPage />} />
        <Route path='/login' element={<LoginPage />} />
        {/* Public kiosk — no auth, designed for security desk tablets */}
        <Route path='/checkin' element={<CheckInKioskPage />} />

        <Route element={<PrivateRoute />}>
          <Route element={<Shell />}>
            <Route path='/dashboard' element={<Responsive mobile={<HomeScreen />} desktop={<DashboardPage />} />} />
            <Route path='/venues'    element={<Responsive mobile={<VenueGrid />} desktop={<VenuesPage />} />} />
            <Route path='/venues/:id' element={<Responsive mobile={<VenueDetail />} desktop={<VenueDetailPage />} />} />
            <Route path='/venues/:id/calendar' element={<VenueCalendarPage />} />
            <Route path='/book'      element={<Responsive mobile={<BookFlow />} desktop={<BookingPage />} />} />
            <Route path='/timetable' element={<TimetablePage />} />

            {/* Mobile-only screens (desktop folds these into the dashboard) */}
            <Route path='/my-bookings' element={<Responsive mobile={<MyBookings />} desktop={<Navigate to='/dashboard' replace />} />} />
            <Route path='/profile'     element={<Responsive mobile={<ProfileScreen />} desktop={<Navigate to='/dashboard' replace />} />} />

            {/* ADMIN + RECEPTIONIST */}
            <Route element={<AdminRoute />}>
              {/* Mobile approval queue lives at /approvals; desktop uses /admin/approvals */}
              <Route path='/approvals' element={<Responsive mobile={<ApprovalQueue />} desktop={<Navigate to='/admin/approvals' replace />} />} />
              <Route path='/admin/approvals' element={<ApprovalsPage />} />
            </Route>

            {/* ADMIN only */}
            <Route element={<SuperAdminRoute />}>
              <Route path='/admin/venues'   element={<ManageVenuesPage />} />
              <Route path='/admin/users'    element={<ManageUsersPage />} />
              <Route path='/admin/reports'  element={<ReportsPage />} />
              <Route path='/admin/settings' element={<AdminSettingsPage />} />
            </Route>

            <Route path='*' element={<NotFoundPage />} />
          </Route>
        </Route>

      </Routes>
    </BrowserRouter>
  );
}
