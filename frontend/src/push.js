import api from './api/axios';

/*
 * Web Push subscription helpers. The service worker (registered in main.jsx)
 * handles the actual `push` and `notificationclick` events; these functions
 * manage the browser subscription and sync it with the backend.
 *
 * Push requires a registered service worker, which only runs in production
 * builds (and over HTTPS / localhost) — see main.jsx.
 */

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * Subscribe this device to push. Throws an Error with a known `code`:
 *   'unsupported' | 'no-sw' | 'not-configured' | 'denied'
 */
export async function enablePush() {
  if (!pushSupported()) throw Object.assign(new Error('Push not supported'), { code: 'unsupported' });

  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) throw Object.assign(new Error('No service worker'), { code: 'no-sw' });

  if (Notification.permission !== 'granted') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw Object.assign(new Error('Permission denied'), { code: 'denied' });
  }

  const { data } = await api.get('/push/vapid-public-key/');
  if (!data.configured || !data.public_key) {
    throw Object.assign(new Error('Server not configured'), { code: 'not-configured' });
  }

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.public_key),
    });
  }
  await api.post('/push/subscribe/', sub.toJSON());
}

/** Unsubscribe this device. Best-effort; never throws. */
export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    const sub = reg && (await reg.pushManager.getSubscription());
    if (sub) {
      await api.post('/push/unsubscribe/', { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } catch {
    /* ignore */
  }
}
