import { Link } from 'react-router-dom';
import { Sun, Moon, Menu } from 'lucide-react';
import { useThemeStore } from '@/stores/theme.store';
import { useAuthStore }  from '@/stores/auth.store';

export default function MobileHeader() {
  const { isDark, setTheme } = useThemeStore();
  const { user } = useAuthStore();

  return (
    <div className="md:hidden sticky top-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between">
      <Link to="/" className="text-xl font-bold text-brand">Nexus</Link>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTheme(isDark() ? 'light' : 'dark')}
          className="p-2 rounded-full text-gray-500 hover:text-brand hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          {isDark() ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        {user && (
          <Link to={`/${user.handle}`}>
            <img
              src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.handle}&background=1d9bf0&color=fff&size=32`}
              className="w-8 h-8 rounded-full object-cover"
              alt={user.handle}
            />
          </Link>
        )}
      </div>
    </div>
  );
}
