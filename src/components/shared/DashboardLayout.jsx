// DashboardLayout - the single app shell shared by every role dashboard
// (master-admin, org-admin, department-head, manager, staff).
//
// Before this existed each dashboard hand-rolled its own wrapper, header,
// identity block and logout button, which is why they drifted apart visually
// and why layout bugs had to be fixed five times. Every role now passes its
// own nav config + content here and gets identical chrome.
//
// Layout follows the reference: a narrow icon rail on the left holding only
// destinations, and a top bar that carries identity, greeting and the pill
// navigation. Labels live in tooltips on the rail so the content area keeps
// its full width — on a 1280px laptop the old 256px sidebar was taking 20% of
// the screen to repeat words already shown in the page title.

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LogOut, Menu, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/components/ui/use-toast';
import { reportError } from '@/lib/reportError';
import NotificationBell from '@/components/shared/NotificationBell';
import Brandmark from '@/components/shared/Brandmark';

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

/**
 * @param {string} subtitle       Small label under the greeting (e.g. "Admin Panel")
 * @param {Array}  menuItems      [{ id, label, icon }] — nav entries
 * @param {string} activeTab      currently selected menu item id
 * @param {Function} onTabChange  (id) => void
 * @param {string} title          page title shown above the content
 * @param {ReactNode} headerActions  optional buttons rendered in the header
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
  const { theme, toggleTheme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: 'Signed out', description: 'See you next time.' });
    } catch (error) {
      reportError(error, { title: 'Could not sign out' });
    }
  };

  const handleNavigate = (id) => {
    onTabChange?.(id);
    setIsSidebarOpen(false);
  };

  const firstName = (user?.name || user?.email || 'there').split(/[\s@]/)[0];
  const initial = (user?.name || user?.email || '?').charAt(0).toUpperCase();

  const Avatar = ({ size = 'md' }) => (
    <div
      className={`grid shrink-0 place-items-center rounded-full bg-primary font-bold text-primary-foreground ${
        size === 'sm' ? 'h-9 w-9 text-sm' : 'h-11 w-11 text-base'
      }`}
      aria-hidden="true"
    >
      {initial}
    </div>
  );

  // Desktop: icon-only rail. The label is the accessible name and the tooltip.
  const IconRail = () => (
    <TooltipProvider delayDuration={120}>
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col items-center border-r border-border bg-card pb-6 lg:flex"
        aria-label="Main navigation"
      >
        {/* Same h-20 band as the header, with the same bottom border, so the
            two rules meet as one continuous line across the top of the app and
            the mark sits on the greeting's centreline. Previously the rail's
            logo sat 6px low and the header's border stopped dead at the rail. */}
        <div className="flex h-20 w-full shrink-0 items-center justify-center border-b border-border">
          <Brandmark className="h-10 w-10" />
        </div>

        <nav className="flex flex-1 flex-col items-center gap-1 pt-4">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleNavigate(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    // Filled, not tinted: this is now the only place the current
                    // section is marked, so it has to be unmistakable at a glance.
                    className={`relative grid h-11 w-11 place-items-center rounded-xl transition-all duration-200 ease-premium ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-card'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="sr-only">{item.label}</span>
                    {isActive && (
                      <motion.span
                        layoutId="rail-active"
                        className="absolute -left-[13px] h-6 w-1 rounded-r-full bg-primary"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleLogout}
              className="grid h-11 w-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive"
            >
              <LogOut className="h-5 w-5" />
              <span className="sr-only">Sign out</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Sign out</TooltipContent>
        </Tooltip>
      </aside>
    </TooltipProvider>
  );

  // Mobile: the same destinations, but with labels — there is room in a drawer
  // and no hover to reveal a tooltip on a touch screen.
  const MobileNav = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border p-6">
        <Brandmark className="h-10 w-10" />
        <div className="min-w-0">
          <p className="text-base font-bold tracking-tight">MagnaFlow</p>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-primary-foreground'
              }`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="leading-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-muted/60 p-3">
          <Avatar size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user?.name || 'User'}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <Button variant="outline" className="w-full text-destructive" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:font-semibold focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <IconRail />

      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetContent side="left" className="w-[17rem] p-0">
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <MobileNav />
        </SheetContent>
      </Sheet>

      <div className="lg:pl-20">
        {/* Top bar: identity on the left, pill nav centre, actions right. */}
        {/* h-20 on the header itself (border-box) so its rule lands on exactly
            the same pixel as the rail's, instead of 1px lower. The blur is what
            makes the translucent bar readable over content scrolling under it. */}
        <header className="sticky top-0 z-20 h-20 border-b border-border bg-background/85 backdrop-blur-xl">
          <div className="flex h-full items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold leading-tight tracking-tight sm:text-xl">
                {greeting()},{' '}
                <span className="text-primary">{firstName}</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            </div>

            {/* There is deliberately no second navigation here.
                The reference carries a rail AND a top nav because it has two
                levels — app modules on the left, section tabs on top. This app
                has one flat list of eight destinations, so putting it in both
                places meant the two disagreed: the top bar was capped at five
                and an active item beyond that (Reports, Timeline, Tasks) lit
                up in the rail with nothing selected up top. The rail is the
                one that scales, so it is the only navigation. */}

            <div className="flex shrink-0 items-center gap-2">
              {headerActions}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
              <NotificationBell />
              <div className="hidden items-center gap-2 md:flex">
                <Avatar size="sm" />
              </div>
            </div>
          </div>
        </header>

        <main id="main-content" className="px-4 py-6 sm:px-6 lg:px-8">
          {title && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
            </div>
          )}
          <div className="animate-fade-up">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
