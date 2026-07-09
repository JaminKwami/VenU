import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Icon } from './icons';
import { relTime } from '../utils/venueUi';

const POLL_MS = 45000;

/* Bell icon → unread-count badge → dropdown of recent notifications.
   Polls unread count in the background; fetches the full list only when
   opened, so idle screens aren't repeatedly pulling notification bodies. */
export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const [unread, setUnread] = useState(0);
  const rootRef = useRef(null);

  function refreshUnread() {
    api.get('/notifications/', { params: { limit: 1 } })
      .then(r => setUnread(r.data.unread_count || 0))
      .catch(() => {});
  }

  useEffect(() => {
    refreshUnread();
    const id = setInterval(refreshUnread, POLL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    api.get('/notifications/', { params: { limit: 20 } })
      .then(r => { setItems(r.data.results); setUnread(r.data.unread_count || 0); })
      .catch(() => setItems([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function openNotification(n) {
    if (!n.read_at) {
      api.post(`/notifications/${n.id}/read/`).catch(() => {});
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x));
      setUnread(u => Math.max(0, u - 1));
    }
    setOpen(false);
    if (n.url) navigate(n.url);
  }

  function markAllRead() {
    api.post('/notifications/read-all/').catch(() => {});
    setItems(prev => prev?.map(x => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
    setUnread(0);
  }

  return (
    <div className="pos-rel" ref={rootRef}>
      <button className="icon-btn notif-bell" aria-label="Notifications" title="Notifications" onClick={() => setOpen(o => !o)}>
        <Icon.Bell />
        {unread > 0 && <span className="notif-dot">{unread > 9 ? '9+' : unread}</span>}
      </button>
      <div className={`notif-pop${open ? ' open' : ''}`}>
        <div className="notif-pop-head">
          <span>Notifications</span>
          {unread > 0 && <button className="notif-markall" onClick={markAllRead}>Mark all read</button>}
        </div>
        <div className="notif-list">
          {items == null && <div className="notif-empty">Loading…</div>}
          {items != null && items.length === 0 && <div className="notif-empty">No notifications yet.</div>}
          {items?.map(n => (
            <button key={n.id} className={`notif-item${n.read_at ? '' : ' unread'}`} onClick={() => openNotification(n)}>
              {!n.read_at && <span className="notif-item-dot" />}
              <div className="notif-item-body">
                <div className="notif-item-title">{n.title}</div>
                {n.body && <div className="notif-item-text">{n.body}</div>}
                <div className="notif-item-time">{relTime(n.created_at)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
