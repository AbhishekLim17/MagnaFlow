import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  CheckSquare, 
  BarChart3, 
  LogOut, 
  Plus,
  Search,
  Filter,
  TrendingUp,
  Award,
  Target,
  Clock,
  Menu,
  X,
  Briefcase
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import StaffManagement from '@/components/admin/StaffManagement';
import TaskManagement from '@/components/admin/TaskManagement';
import PerformanceReports from '@/components/admin/PerformanceReports';
import DesignationsManagement from '@/components/admin/DesignationsManagement';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const path = location.pathname.split('/admin/')[1] || 'dashboard';
    setActiveTab(path === '' ? 'dashboard' : path);
  }, [location]);
  
  const handleLogout = () => {
    logout();
    toast({
      title: "Logged out successfully",
      description: "See you next time!",
    });
  };

  const navigateToTab = (tab) => {
    setActiveTab(tab);
    navigate(`/admin/${tab === 'dashboard' ? '' : tab}`);
    setIsSidebarOpen(false);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'staff', label: 'Staff', icon: Users },
    { id: 'designations', label: 'Designations', icon: Briefcase },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ];

  const dashboardStats = [
    { title: 'Total Projects', value: '24', change: '+12%', icon: Target, color: 'from-blue-500 to-cyan-500' },
    { title: 'Active Tasks', value: '156', change: '+8%', icon: CheckSquare, color: 'from-green-500 to-emerald-500' },
    { title: 'Team Members', value: '18', change: '+2%', icon: Users, color: 'from-purple-500 to-pink-500' },
    { title: 'Completion Rate', value: '87%', change: '+5%', icon: Award, color: 'from-orange-500 to-red-500' },
  ];

  const recentActivities = [
    { user: 'Sarah Johnson', action: 'completed task', task: 'UI Design Review', time: '2 hours ago' },
    { user: 'Mike Chen', action: 'started task', task: 'Database Migration', time: '4 hours ago' },
    { user: 'Emma Davis', action: 'submitted report', task: 'Weekly Analytics', time: '6 hours ago' },
    { user: 'Alex Rodriguez', action: 'updated task', task: 'API Integration', time: '8 hours ago' },
  ];

  const SidebarContent = () => (
    <>
      <div className="p-6">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold gradient-text">ProjectFlow</h2>
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
                  ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-blue-300'
                  : 'hover:bg-white/10 text-gray-300 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </motion.button>
          ))}
        </nav>
      </div>
      <div className="absolute bottom-6 left-6 right-6">
        <div className="glass-effect p-4 rounded-lg mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
              {user?.name?.charAt(0)}
            </div>
            <div>
              <p className="font-medium text-white">{user?.name}</p>
              <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
            </div>
          </div>
        </div>
        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full border-red-500/30 text-red-400 hover:bg-red-500/20"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      <div className="hidden lg:block fixed left-0 top-0 h-full w-64 glass-effect border-r border-white/20 z-50">
        <SidebarContent />
      </div>

      <div className="lg:ml-64">
        {/* Mobile Header */}
        <div className="lg:hidden p-4 flex justify-between items-center glass-effect sticky top-0 z-40">
           <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 glass-effect border-r-0">
               <SidebarContent />
            </SheetContent>
          </Sheet>
          <div className="text-center">
            <h2 className="text-lg font-bold gradient-text">ProjectFlow</h2>
          </div>
          <div className="w-10"></div>
        </div>

        {/* Main Content */}
        <main className="p-4 sm:p-8">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">
                      Welcome back, {user?.name}! 👋
                    </h1>
                    <p className="text-gray-300">Here's what's happening with your projects today.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {dashboardStats.map((stat, index) => (
                      <motion.div
                        key={stat.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Card className="glass-effect p-6 card-hover">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-gray-400 text-sm mb-1">{stat.title}</p>
                              <p className="text-2xl font-bold text-white">{stat.value}</p>
                              <p className="text-green-400 text-sm flex items-center mt-1">
                                <TrendingUp className="w-3 h-3 mr-1" />
                                {stat.change}
                              </p>
                            </div>
                            <div className={`w-12 h-12 bg-gradient-to-r ${stat.color} rounded-lg flex items-center justify-center`}>
                              <stat.icon className="w-6 h-6 text-white" />
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card className="glass-effect p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-semibold text-white">Recent Activities</h3>
                        <Button variant="outline" size="sm" className="border-white/20">
                          <Filter className="w-4 h-4 mr-2" />
                          Filter
                        </Button>
                      </div>
                      <div className="space-y-4">
                        {recentActivities.map((activity, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-center space-x-4 p-3 rounded-lg hover:bg-white/5 transition-colors"
                          >
                            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                              {activity.user.charAt(0)}
                            </div>
                            <div className="flex-1">
                              <p className="text-white text-sm">
                                <span className="font-medium">{activity.user}</span> {activity.action}{' '}
                                <span className="text-blue-300">"{activity.task}"</span>
                              </p>
                              <p className="text-gray-400 text-xs flex items-center mt-1">
                                <Clock className="w-3 h-3 mr-1" />
                                {activity.time}
                              </p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </Card>
                    <Card className="glass-effect p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-semibold text-white">Quick Actions</h3>
                      </div>
                      <div className="space-y-4">
                        <Button className="w-full justify-start bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700" onClick={() => navigateToTab('tasks')}>
                          <Plus className="w-4 h-4 mr-2" />
                          Create New Task
                        </Button>
                        <Button className="w-full justify-start bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700" onClick={() => navigateToTab('staff')}>
                          <Users className="w-4 h-4 mr-2" />
                          Manage Staff
                        </Button>
                        <Button className="w-full justify-start bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700" onClick={() => navigateToTab('reports')}>
                          <BarChart3 className="w-4 h-4 mr-2" />
                          View Reports
                        </Button>
                      </div>
                    </Card>
                  </div>
                </motion.div>
              } />
              <Route path="/staff" element={<StaffManagement />} />
              <Route path="/designations" element={<DesignationsManagement />} />
              <Route path="/tasks" element={<TaskManagement />} />
              <Route path="/reports" element={<PerformanceReports />} />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;