// Admin Dashboard - Main admin interface with navigation and routing
// Displays overview, staff management, task management, reports, and designations

import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  CheckSquare, 
  BarChart3, 
  LogOut, 
  Briefcase,
  Menu,
  X,
  Target,
  Clock,
  TrendingUp,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/contexts/TasksContext';
import { useToast } from '@/components/ui/use-toast';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

// Import admin components
import StaffManagement from '@/components/admin/StaffManagementNew';
import TaskManagement from '@/components/admin/TaskManagementNew';
import PerformanceReports from '@/components/admin/PerformanceReports';
import DesignationsManagement from '@/components/admin/DesignationsManagement';
import AdminManagement from '@/components/admin/AdminManagement';
import NotificationBell from '@/components/shared/NotificationBell';
import { getAllUsers } from '@/services/userService';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const { statistics } = useTasks();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [staffCount, setStaffCount] = useState(0);

  // Set active tab based on route
  useEffect(() => {
    const path = location.pathname.split('/admin/')[1] || 'dashboard';
    setActiveTab(path === '' ? 'dashboard' : path);
  }, [location]);

  // Load staff count
  useEffect(() => {
    loadStaffCount();
  }, []);

  const loadStaffCount = async () => {
    try {
      const users = await getAllUsers({ role: 'staff' });
      setStaffCount(users.length);
    } catch (error) {
      console.error('Error loading staff count:', error);
    }
  };

  const handleLogout = async () => {
    await logout();
    toast({
      title: "Logged out successfully",
      description: "See you next time!",
    });
    navigate('/login');
  };

  const navigateToTab = (tab) => {
    setActiveTab(tab);
    navigate(`/admin/${tab === 'dashboard' ? '' : tab}`);
    setIsSidebarOpen(false);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'staff', label: 'Staff Management', icon: Users },
    { id: 'admins', label: 'Admin Management', icon: Shield },
    { id: 'designations', label: 'Designations', icon: Briefcase },
    { id: 'tasks', label: 'Task Management', icon: CheckSquare },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
  ];

  // Dashboard statistics cards - Professional Theme
  const dashboardStats = [
    { 
      title: 'Total Tasks', 
      value: statistics?.total || 0, 
      icon: Target, 
      color: 'from-blue-600 to-blue-700',
      description: 'All tasks in system'
    },
    { 
      title: 'Pending Tasks', 
      value: statistics?.pending || 0, 
      icon: Clock, 
      color: 'from-slate-600 to-slate-700',
      description: 'Awaiting action'
    },
    { 
      title: 'In Progress', 
      value: statistics?.inProgress || 0, 
      icon: TrendingUp, 
      color: 'from-indigo-600 to-indigo-700',
      description: 'Currently active'
    },
    { 
      title: 'Completed', 
      value: statistics?.completed || 0, 
      icon: CheckSquare, 
      color: 'from-teal-600 to-teal-700',
      description: 'Successfully done'
    },
    { 
      title: 'Team Members', 
      value: staffCount, 
      icon: Users, 
      color: 'from-gray-600 to-gray-700',
      description: 'Active staff'
    },
  ];

  // Sidebar component
  const SidebarContent = () => (
    <>
      <div className="p-6">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold gradient-text">MagnaFlow</h2>
            <p className="text-xs text-gray-400">Admin Panel</p>
          </div>
        </div>
        
        <nav className="space-y-2">
          {menuItems.map((item) => (
            <motion.button
              key={item.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigateToTab(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                activeTab === item.id
                  ? 'bg-blue-600/20 border border-blue-500/30 text-blue-300'
                  : 'hover:bg-gray-800/50 text-gray-300 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium whitespace-nowrap">{item.label}</span>
            </motion.button>
          ))}
        </nav>
      </div>

      <div className="p-6 border-t border-gray-800">
        <div className="flex items-center space-x-3 mb-4 p-3 bg-gray-800/50 rounded-lg">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
            {user?.name?.charAt(0) || 'A'}
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">{user?.name || 'Admin'}</p>
            <p className="text-xs text-gray-400">{user?.email}</p>
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

  // Dashboard overview component
  const DashboardOverview = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold gradient-text mb-2">Dashboard Overview</h1>
        <p className="text-gray-400">Welcome back, {user?.name || 'Admin'}! Here's your system overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {dashboardStats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="glass-effect border-gray-800 hover:border-gray-700 transition-all duration-300">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-lg bg-${stat.color.split(' ')[1].replace('to-', '')} flex items-center justify-center`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">{stat.value}</h3>
                <p className="text-sm text-gray-400">{stat.title}</p>
                <p className="text-xs text-gray-500 mt-2">{stat.description}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Priority distribution */}
      {statistics && (
        <Card className="glass-effect border-gray-800">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Task Priority Distribution</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-800/30 rounded-lg">
                <p className="text-2xl font-bold text-red-400">{statistics.byPriority?.critical || 0}</p>
                <p className="text-sm text-gray-400 mt-1">Critical</p>
              </div>
              <div className="text-center p-4 bg-gray-800/30 rounded-lg">
                <p className="text-2xl font-bold text-orange-400">{statistics.byPriority?.high || 0}</p>
                <p className="text-sm text-gray-400 mt-1">High</p>
              </div>
              <div className="text-center p-4 bg-gray-800/30 rounded-lg">
                <p className="text-2xl font-bold text-yellow-400">{statistics.byPriority?.medium || 0}</p>
                <p className="text-sm text-gray-400 mt-1">Medium</p>
              </div>
              <div className="text-center p-4 bg-gray-800/30 rounded-lg">
                <p className="text-2xl font-bold text-green-400">{statistics.byPriority?.low || 0}</p>
                <p className="text-sm text-gray-400 mt-1">Low</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="glass-effect border-gray-800">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              onClick={() => navigateToTab('staff')}
              className="h-auto py-4 flex flex-col items-center space-y-2"
            >
              <Users className="w-6 h-6" />
              <span>Manage Staff</span>
            </Button>
            <Button 
              onClick={() => navigateToTab('tasks')}
              className="h-auto py-4 flex flex-col items-center space-y-2"
            >
              <CheckSquare className="w-6 h-6" />
              <span>Manage Tasks</span>
            </Button>
            <Button 
              onClick={() => navigateToTab('designations')}
              className="h-auto py-4 flex flex-col items-center space-y-2"
            >
              <Briefcase className="w-6 h-6" />
              <span>Manage Roles</span>
            </Button>
            <Button 
              onClick={() => navigateToTab('reports')}
              className="h-auto py-4 flex flex-col items-center space-y-2"
            >
              <BarChart3 className="w-6 h-6" />
              <span>View Reports</span>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 fixed h-screen bg-gray-900/50 backdrop-blur-xl border-r border-gray-800">
          <SidebarContent />
        </aside>

        {/* Mobile Sidebar */}
        <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <SheetContent side="left" className="w-64 p-0 bg-gray-900 border-gray-800">
            <SidebarContent />
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64">
          {/* Header */}
          <header className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setIsSidebarOpen(true)}
                >
                  <Menu className="w-5 h-5" />
                </Button>
                <h1 className="text-xl font-bold">
                  {menuItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
                </h1>
              </div>
              <div className="flex items-center space-x-4">
                <NotificationBell />
                <div className="hidden md:flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {user?.name?.charAt(0) || 'A'}
                  </div>
                  <span className="text-sm font-medium">{user?.name}</span>
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <div className="p-6">
            <Routes>
              <Route path="/" element={<DashboardOverview />} />
              <Route path="/staff" element={<StaffManagement />} />
              <Route path="/admins" element={<AdminManagement />} />
              <Route path="/designations" element={<DesignationsManagement />} />
              <Route path="/tasks" element={<TaskManagement />} />
              <Route path="/reports" element={<PerformanceReports />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
