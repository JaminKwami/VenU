import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import VenuesPage from './pages/VenuesPage';
import VenueDetailPage from './pages/VenueDetailPage';
import VenueCalendarPage from './pages/VenueCalendarPage';
import BookingPage from './pages/BookingPage';
import ApprovalsPage from './pages/ApprovalsPage';
import ManageVenuesPage from './pages/ManageVenuesPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import CheckInKioskPage from './pages/CheckInKioskPage';
import NotFoundPage from './pages/NotFoundPage';
import { useAuthStore } from './store/authStore';

function PrivateRoute() {
  const { accessToken } = useAuthStore();
  return accessToken ? <Outlet /> : <Navigate to='/login' replace />;
}

function AdminRoute() {
  const { user, accessToken } = useAuthStore();
  if (!accessToken) return <Navigate to='/login' replace />;
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'STAFF';
  return isAdmin ? <Outlet /> : <Navigate to='/dashboard' replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<LandingPage />} />
        <Route path='/login' element={<LoginPage />} />
        {/* Public kiosk — no auth, designed for security desk tablets */}
        <Route path='/checkin' element={<CheckInKioskPage />} />

        <Route element={<PrivateRoute />}>
          <Route element={<Layout />}>
            <Route path='/dashboard' element={<DashboardPage />} />
            <Route path='/venues'    element={<VenuesPage />} />
            <Route path='/venues/:id' element={<VenueDetailPage />} />
            <Route path='/venues/:id/calendar' element={<VenueCalendarPage />} />
            <Route path='/book'      element={<BookingPage />} />

            <Route element={<AdminRoute />}>
              <Route path='/admin/approvals' element={<ApprovalsPage />} />
              <Route path='/admin/venues'    element={<ManageVenuesPage />} />
              <Route path='/admin/settings'  element={<AdminSettingsPage />} />
            </Route>

            <Route path='*' element={<NotFoundPage />} />
          </Route>
        </Route>

      </Routes>
    </BrowserRouter>
  );
}
