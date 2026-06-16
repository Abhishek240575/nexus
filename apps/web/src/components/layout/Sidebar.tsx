import { NavLink, useNavigate }    from 'react-router-dom';
import { Home, Search, Bell, Mail, Bookmark, User,
         BarChart2, Users, Radio, Settings, LogOut, Swords, TrendingUp, List, Sun, Moon } from 'lucide-react';
import { useThemeStore } from '@/stores/theme.store';
import { useAuthStore }   from '@/stores/auth.store';
import { authService }    from '@/services/auth.service';
import { disconnectSocket } from '@/services/socket';
import { useNotificationsStore } from '@/stores/notifications.store';
import { useQuery }       from '@tanstack/react-query';
import { notificationsService } from '@/services/notifications.service';
import clsx from 'clsx';

export default function Sidebar() {
  const { user, logout }    = useAuthStore();
  const navigate            = useNavigate();
  const { unreadCount, setUnreadCount } = useNotificationsStore();
  const { theme, setTheme, isDark } = useThemeStore();

  useQuery({
    queryKey: ['notifications-unread'],
    queryFn:  async () => {
      const res = await notificationsService.getUnread();
      setUnreadCount(res.data?.data?.count ?? 0);
      return res;
    },
    refetchInterval: 30000,
    enabled: !!user,
  });

  const navItems = [
    { to: '/',              icon: Home,      label: 'Home'          },
    { to: '/explore',       icon: Search,    label: 'Explore'       },
    { to: '/notifications', icon: Bell,      label: 'Notifications', badge: unreadCount },
    { to: '/messages',      icon: Mail,      label: 'Messages'      },
    { to: '/bookmarks',     icon: Bookmark,  label: 'Bookmarks'     },
    { to: '/lists',         icon: List,      label: 'Lists'         },
    { to: '/communities',   icon: Users,     label: 'Communities'   },
    { to: '/debates',       icon: Swords,      label: 'Debates'       },
    { to: '/trending',      icon: TrendingUp,  label: 'Trending'      },
    { to: '/spaces',        icon: Radio,       label: 'Spaces'        },
    { to: '/analytics',     icon: BarChart2, label: 'Analytics'     },
    { to: `/${user?.handle}`, icon: User,    label: 'Profile'       },
    { to: '/settings',      icon: Settings,  label: 'Settings'      },
  ];

  const handleLogout = async () => {
    try { await authService.logout(); } catch {}
    disconnectSocket();
    logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-full px-3 py-4">
      <div className="px-3 py-2 mb-2 text-2xl font-bold text-brand">Nexus</div>

      <nav className="flex-1 space-y-1">
        {navItems.map(({ to, icon: Icon, label, badge }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => clsx(
              'flex items-center gap-4 px-3 py-3 rounded-full text-[15px] transition-colors relative',
              isActive
                ? 'font-semibold text-gray-900 dark:text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900'
            )}>
            <div className="relative">
              <Icon size={22} />
              {badge && badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </div>
            <span className="hidden xl:block">{label}</span>
          </NavLink>
        ))}
      </nav>

      <button className="mt-2 mb-4 bg-brand hover:bg-brand-dark text-white font-semibold py-3 px-6 rounded-full transition-colors xl:w-full text-center">
        <span className="hidden xl:block">Post</span>
        <span className="xl:hidden text-xl">+</span>
      </button>

      {user && (
        <div className="flex items-center gap-3 px-3 py-3 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer group">
          <img
            src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.handle}&background=1d9bf0&color=fff`}
            alt={user.handle} className="w-9 h-9 rounded-full object-cover" />
          <div className="hidden xl:flex flex-col flex-1 min-w-0">
            <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.display_name || user.handle}</span>
            <span className="text-xs text-gray-500 truncate">@{user.handle}</span>
          </div>
          <button onClick={handleLogout} className="hidden xl:block opacity-0 group-hover:opacity-100 transition-opacity" title="Log out">
            <LogOut size={16} className="text-gray-400 hover:text-red-500" />
          </button>
        </div>
      )}
      <NavLink to="/legal" className="px-3 py-1 text-xs text-gray-400 hover:text-brand transition-colors block">
        Legal & Compliance
      </NavLink>
      <button
        onClick={() => setTheme(isDark() ? 'light' : 'dark')}
        className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:text-brand transition-colors w-full">
        {isDark() ? <Sun size={14} /> : <Moon size={14} />}
        {isDark() ? 'Light mode' : 'Dark mode'}
      </button>
    </div>
  );
}
