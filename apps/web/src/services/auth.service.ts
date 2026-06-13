import { api } from './api.client';

export const authService = {
  register: (data: {
    handle: string; email: string; password: string; display_name?: string;
  }) => api.post('/api/auth/register', data),

  login: (data: { identifier: string; password: string }) =>
    api.post('/api/auth/login', data),

  logout: () => api.post('/api/auth/logout'),

  refreshToken: (refresh_token: string) =>
    api.post('/api/auth/refresh', { refresh_token }),

  verifyEmail: (token: string) =>
    api.get(`/api/auth/verify-email?token=${token}`),

  forgotPassword: (email: string) =>
    api.post('/api/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post('/api/auth/reset-password', { token, password }),

  getMe: () => api.get('/api/auth/me'),
};
