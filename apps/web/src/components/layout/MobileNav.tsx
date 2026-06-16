import { NavLink } from 'react-router-dom';
import { Home, Search, Bell, Mail, User } from 'lucide-react';
import { useNotificationsStore } from '@/stores/notifications.store';

export default function MobileNav() {
  const { unreadCount } = useNotificationsStore();

  const items = [
    { to: '/',              icon: Home,   label: 'Home'          },
    { to: '/explore',       icon: Search, label: 'Explore'       },
    { to: '/notifications', icon: Bell,   label: 'Notifications', badge: unreadCount },
    { to: '/messages',      icon: Mail,   label: 'Messages'      },
    { to: '/profile',       icon: User,   label: 'Profile'       },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-black border-t border-gray-200 dark:border-gray-800 md:hidden">
      <div className="flex items-center justify-around px-2 py-2 safe-area-pb">
        {items.map(({ to, icon: Icon, label, badge }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors relative ${
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
      </div>
    </nav>
  );
}
