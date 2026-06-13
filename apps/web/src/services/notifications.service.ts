import { api } from './api.client';

export const notificationsService = {
  getAll:       (cursor?: string) =>
    api.get('/api/notifications', { params: { cursor, limit: 20 } }),
  getUnread:    () => api.get('/api/notifications/unread'),
  markAllRead:  () => api.patch('/api/notifications/read-all'),
  markOneRead:  (id: string) => api.patch(`/api/notifications/${id}/read`),
};

export const messagesService = {
  getConversations:       () => api.get('/api/messages'),
  getOrCreateConversation:(userId: string) => api.post(`/api/messages/with/${userId}`),
  getMessages:            (conversationId: string, cursor?: string) =>
    api.get(`/api/messages/${conversationId}`, { params: { cursor } }),
  sendMessage:            (conversationId: string, content: string) =>
    api.post(`/api/messages/${conversationId}`, { content }),
};
