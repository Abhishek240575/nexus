import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id:           string;
  handle:       string;
  email:        string;
  display_name: string | null;
  avatar_url:   string | null;
  verified:     boolean;
  premium_tier: 'free' | 'pro' | 'creator';
}

interface AuthState {
  user:         AuthUser | null;
  accessToken:  string | null;
  refreshToken: string | null;
  isAuth:       boolean;

  setAuth:      (user: AuthUser, access: string, refresh: string) => void;
  setTokens:    (access: string, refresh: string) => void;
  setUser:      (user: Partial<AuthUser>) => void;
  logout:       () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:         null,
      accessToken:  null,
      refreshToken: null,
      isAuth:       false,

      setAuth: (user, access, refresh) =>
        set({ user, accessToken: access, refreshToken: refresh, isAuth: true }),

      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh }),

      setUser: (partial) =>
        set({ user: get().user ? { ...get().user!, ...partial } : null }),

      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuth: false }),
    }),
    {
      name:    'nexus-auth',
      partialize: (s) => ({
        user:         s.user,
        accessToken:  s.accessToken,
        refreshToken: s.refreshToken,
        isAuth:       s.isAuth,
      }),
    }
  )
);
