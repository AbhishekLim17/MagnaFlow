// DashboardLayout - the single app shell shared by every role dashboard
// (master-admin, org-admin, department-head, manager, staff).
//
// Before this existed each dashboard hand-rolled its own wrapper, header,
// identity block and logout button, which is why they drifted apart visually
// and why layout bugs had to be fixed five times. Every role now passes its
// own nav config + content here and gets identical chrome.

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import NotificationBell from '@/components/shared/NotificationBell';

/**
 * @param {string} subtitle       Small label under the MagnaFlow wordmark (e.g. "Admin Panel")
 * @param {Array}  menuItems      [{ id, label, icon }] — sidebar nav entries
 * @param {string} activeTab      currently selected menu item id
 * @param {Function} onTabChange  (id) => void
 * @param {string} title          page title shown in the sticky header
 * @param {ReactNode} headerActions  optional buttons rendered in the header (e.g. "Provision Organization")
 * @param {ReactNode} children    page content
 */
const DashboardLayout = ({
  subtitle = 'Dashboard',
  menuItems = [],
  activeTab,
  onTabChange,
  title,
  headerActions = null,
  children,
}) => {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: 'Logged out successfully', description: 'See you next time!' });
    } catch (error) {
      console.error('Logout failed:', error);
      toast({ title: 'Logout failed', description: 'Please try again.', variant: 'destructive' });
    }
  };

  const handleNavigate = (id) => {
    onTabChange?.(id);
    setIsSidebarOpen(false);
  };

  const initial = (user?.name || user?.email || '?').charAt(0).toUpperCase();

  const SidebarContent = () => (
    <>
      <div className="p-6">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold gradient-text">MagnaFlow</h2>
            <p className="text-xs text-gray-400 truncate">{subtitle}</p>
          </div>
        </div>

        <nav className="space-y-2">
          {menuItems.map((item) => (
            <motion.button
              key={item.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleNavigate(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                activeTab === item.id
                  ? 'bg-blue-600/20 border border-blue-500/30 text-blue-300'
                  : 'hover:bg-gray-800/50 text-gray-300 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium text-left leading-tight">{item.label}</span>
            </motion.button>
          ))}
        </nav>
      </div>

      <div className="p-6 border-t border-gray-800">
        <div className="flex items-center space-x-3 mb-4 p-3 bg-gray-800/50 rounded-lg">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{user?.name || 'User'}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Keyboard users can jump past the nav straight to the page content. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-3 focus:left-3 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-blue-600 focus:text-white"
      >
        Skip to main content
      </a>
      <div className="flex">
        {/* Desktop sidebar */}
        <aside
          className="hidden lg:block w-64 fixed h-screen overflow-y-auto bg-gray-900/50 backdrop-blur-xl border-r border-gray-800"
          aria-label="Main navigation"
        >
          <SidebarContent />
        </aside>

        {/* Mobile sidebar */}
        <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <SheetContent side="left" className="w-64 p-0 bg-gray-900 border-gray-800 overflow-y-auto">
            <SheetTitle className="sr-only">Navigation menu</SheetTitle>
            <SidebarContent />
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <main className="flex-1 lg:ml-64 min-w-0">
          <header className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800 px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center space-x-3 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden flex-shrink-0"
                  onClick={() => setIsSidebarOpen(true)}
                  aria-label="Open navigation menu"
                >
                  <Menu className="w-5 h-5" />
                </Button>
                <h1 className="text-lg sm:text-xl font-bold truncate">{title}</h1>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                {headerActions}
                <NotificationBell />
                <div className="hidden md:flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {initial}
                  </div>
                  <span className="text-sm font-medium max-w-[10rem] truncate">{user?.name}</span>
                </div>
              </div>
            </div>
          </header>

          <div id="main-content" className="p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
