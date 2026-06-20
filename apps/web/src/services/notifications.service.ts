import { api } from '@/services/api.client';

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationsService = {
  getAll:     (cursor?: string) =>
    api.get('/api/notifications', { params: cursor ? { cursor } : {} }),
  getUnread:  () => api.get('/api/notifications/unread-count'),
  markAllRead:() => api.post('/api/notifications/mark-read'),
};

// ─── Messages ─────────────────────────────────────────────────────────────────
export const messagesService = {
  getConversations: () => api.get('/api/messages/conversations'),
  getMessages:      (conversationId: string, cursor?: string) =>
    api.get(`/api/messages/conversations/${conversationId}`, { params: cursor ? { cursor } : {} }),
  sendMessage:      (conversationId: string, content: string) =>
    api.post(`/api/messages/conversations/${conversationId}`, { content }),
  startConversation:(handle: string) =>
    api.post('/api/messages/conversations', { handle }),
};

// ─── Push Notifications ───────────────────────────────────────────────────────
export const initPushNotifications = async (): Promise<void> => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const existing = await reg.pushManager.getSubscription();
    if (existing) return;

    const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!VAPID_PUBLIC) return;

    const padding  = '='.repeat((4 - VAPID_PUBLIC.length % 4) % 4);
    const base64   = (VAPID_PUBLIC + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData  = window.atob(base64);
    const key      = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) key[i] = rawData.charCodeAt(i);

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: key.buffer as ArrayBuffer,
    });

    await fetch('/api/notifications/subscribe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(sub),
    });
  } catch {
    // Push not supported or permission denied — silent fail
  }
};
