import { Outlet } from 'react-router-dom';
import Sidebar      from './Sidebar';
import RightPanel   from './RightPanel';
import MobileNav    from './MobileNav';
import MobileHeader from './MobileHeader';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Mobile header */}
      <MobileHeader />

      <div className="max-w-7xl mx-auto flex">
        {/* Left sidebar — hidden on mobile */}
        <aside className="hidden md:flex flex-col w-64 xl:w-72 sticky top-0 h-screen border-r border-gray-200 dark:border-gray-800">
          <Sidebar />
        </aside>

        {/* Main feed */}
        <main className="flex-1 min-h-screen border-r border-gray-200 dark:border-gray-800 max-w-[600px] pb-16 md:pb-0">
          <Outlet />
        </main>

        {/* Right panel — hidden on mobile and tablet */}
        <aside className="hidden lg:block w-80 xl:w-96 sticky top-0 h-screen overflow-y-auto">
          <RightPanel />
        </aside>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav />
    </div>
  );
}
