import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../api/axios';
import BottomTabBar from './BottomTabBar';

/*
 * Mobile shell — activates at ≤900px. Renders the active screen inside a
 * scroll container that slides in on navigation, with a fixed bottom tab bar.
 * The desktop sidebar Layout is used for ≥901px (see App.jsx <Shell/>).
 */
export default function MobileLayout() {
  const { user } = useAuthStore();
  const location = useLocation();
  const isAdmin = ['ADMIN', 'RECEPTIONIST'].includes(user?.role);
  const [pendingCount, setPendingCount] = useState(0);

  // Pending-approvals badge for admins — refresh on navigation.
  useEffect(() => {
    if (!isAdmin) return;
    api.get('/bookings/')
      .then((r) => {
        const data = r.data.results ?? r.data;
        setPendingCount(data.filter((b) => b.status === 'PENDING').length);
      })
      .catch(() => {});
  }, [isAdmin, location.pathname]);

  return (
    <div className="m-app">
      <main className="m-screens">
        {/* key on pathname remounts the screen so the slide-in animation fires */}
        <div className="m-screen" key={location.pathname}>
          <Outlet />
        </div>
      </main>
      <BottomTabBar isAdmin={isAdmin} pendingCount={pendingCount} />
    </div>
  );
}
