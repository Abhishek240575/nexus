import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: () => boolean;
}

const getSystemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

const applyTheme = (theme: Theme) => {
  const isDark = theme === 'dark' || (theme === 'system' && getSystemDark());
  document.documentElement.classList.toggle('dark', isDark);
};

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'system',
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      isDark: () => {
        const { theme } = get();
        return theme === 'dark' || (theme === 'system' && getSystemDark());
      },
    }),
    { name: 'Deemona-theme' }
  )
);

// Initialize on load
export const initTheme = () => {
  const stored = localStorage.getItem('Deemona-theme');
  const theme: Theme = stored ? JSON.parse(stored)?.state?.theme ?? 'system' : 'system';
  applyTheme(theme);

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const current = useThemeStore.getState().theme;
    if (current === 'system') applyTheme('system');
  });
};
