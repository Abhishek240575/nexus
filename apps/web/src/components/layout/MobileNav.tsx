import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Home, Search, Bell, Mail, User, Menu, X,
         Bookmark, Users, Swords, TrendingUp, Radio,
         BarChart2, List, Shield, Settings, FileText,
         LogOut, Sun, Moon, Crown, Gift } from 'lucide-react';
import { useNotificationsStore } from '@/stores/notifications.store';
import { useAuthStore }          from '@/stores/auth.store';
import { useThemeStore }         from '@/stores/theme.store';
import { useNavigate }           from 'react-router-dom';

const ALL_FEATURES = [
  { to: '/premium',    icon: Crown,      label: 'Premium'     },
  { to: '/earnings',   icon: Gift,       label: 'Earnings'    },
  { to: '/bookmarks',  icon: Bookmark,   label: 'Bookmarks'   },
  { to: '/lists',      icon: List,       label: 'Lists'       },
  { to: '/communities',icon: Users,      label: 'Communities' },
  { to: '/debates',    icon: Swords,     label: 'Debates'     },
  { to: '/trending',   icon: TrendingUp, label: 'Trending'    },
  { to: '/spaces',     icon: Radio,      label: 'Spaces'      },
  { to: '/analytics',  icon: BarChart2,  label: 'Analytics'   },
  { to: '/moderation', icon: Shield,     label: 'Moderation'  },
  { to: '/settings',   icon: Settings,   label: 'Settings'    },
  { to: '/legal',      icon: FileText,   label: 'Legal'       },
];

export default function MobileNav() {
  const { unreadCount }          = useNotificationsStore();
  const { user, logout }         = useAuthStore();
  const { isDark, setTheme }     = useThemeStore();
  const navigate                 = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = async () => {
    setDrawerOpen(false);
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/',              icon: Home,   label: 'Home',          end: true },
    { to: '/explore',       icon: Search, label: 'Explore'                  },
    { to: '/notifications', icon: Bell,   label: 'Notifications', badge: unreadCount },
    { to: '/messages',      icon: Mail,   label: 'Messages'                 },
    { to: '/profile',       icon: User,   label: 'Profile'                  },
  ];

  return (
    <>
      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-black border-t border-gray-200 dark:border-gray-800 md:hidden">
        <div className="flex items-center justify-around px-1 py-2">
          {navItems.map(({ to, icon: Icon, label, badge, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-colors relative ${
                  isActive ? 'text-brand' : 'text-gray-500'
                }`
              }>
              <div className="relative">
                <Icon size={22} />
                {badge && badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium">{label}</span>
            </NavLink>
          ))}

          {/* Hamburger */}
          <button onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-gray-500 transition-colors">
            <Menu size={22} />
            <span className="text-xs font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)} />

          {/* Drawer */}
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-950 rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full" />
            </div>

            {/* User info */}
            {user && (
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <img src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.handle}&background=1d9bf0&color=fff&size=44`}
                  className="w-11 h-11 rounded-full object-cover" alt={user.handle} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white truncate">{user.display_name || user.handle}</p>
                  <p className="text-sm text-gray-500 truncate">@{user.handle}</p>
                </div>
                <button onClick={() => setDrawerOpen(false)} className="text-gray-400 p-1">
                  <X size={20} />
                </button>
              </div>
            )}

            {/* Feature grid */}
            <div className="px-4 py-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">Features</p>
              <div className="grid grid-cols-3 gap-2">
                {ALL_FEATURES.map(({ to, icon: Icon, label }) => (
                  <Link key={to} to={to} onClick={() => setDrawerOpen(false)}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-gray-50 dark:bg-gray-900 hover:bg-brand/10 dark:hover:bg-brand/20 transition-colors">
                    <Icon size={22} className="text-brand" />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center">{label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Dark mode toggle */}
            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => setTheme(isDark() ? 'light' : 'dark')}
                className="w-full flex items-center justify-between py-3 px-4 rounded-2xl bg-gray-50 dark:bg-gray-900 transition-colors">
                <div className="flex items-center gap-3">
                  {isDark() ? <Sun size={18} className="text-brand" /> : <Moon size={18} className="text-brand" />}
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {isDark() ? 'Switch to Light mode' : 'Switch to Dark mode'}
                  </span>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors ${isDark() ? 'bg-brand' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${isDark() ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
              </button>
            </div>

            {/* Logout */}
            <div className="px-5 pb-8">
              <button onClick={handleLogout}
                className="w-full flex items-center gap-3 py-3 px-4 rounded-2xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                <LogOut size={18} />
                <span className="text-sm font-medium">Log out @{user?.handle}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
