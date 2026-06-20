// Push notification service — registers service worker and subscribes to push

export const initPushNotifications = async (): Promise<void> => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    console.log('[SW] registered:', reg.scope);

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    // Check if already subscribed
    const existing = await reg.pushManager.getSubscription();
    if (existing) return;

    // Subscribe (VAPID key must be set on server)
    const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!VAPID_PUBLIC) return;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });

    // Send subscription to backend
    await fetch('/api/notifications/subscribe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(sub),
    });
  } catch (err) {
    console.warn('[Push] setup failed:', err);
  }
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding  = '='.repeat((4 - base64String.length % 4) % 4);
  const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData  = window.atob(base64);
  const output   = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}
