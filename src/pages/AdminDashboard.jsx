// Admin Dashboard - org-admin interface: overview, staff, departments/projects,
// designations, tasks, timeline and reports. Chrome comes from DashboardLayout.

import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  BarChart3,
  Briefcase,
  Shield,
  Building2,
  GanttChartSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTasks } from '@/contexts/TasksContext';
import DashboardLayout from '@/components/shared/DashboardLayout';

// Import admin components
import StaffManagement from '@/components/admin/StaffManagementNew';
import TaskManagement from '@/components/admin/TaskManagementNew';
import PerformanceReports from '@/components/admin/PerformanceReports';
import DesignationsManagement from '@/components/admin/DesignationsManagement';
import AdminManagement from '@/components/admin/AdminManagement';
import DepartmentsProjectsManagement from '@/components/admin/DepartmentsProjectsManagement';
import ProjectTimeline from '@/components/admin/ProjectTimeline';
import { AdminCommandCenter } from '@/components/admin/AdminCommandCenter';

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'staff', label: 'Staff Management', icon: Users },
  { id: 'admins', label: 'Dept. Heads & Managers', icon: Shield },
  { id: 'departments', label: 'Departments & Projects', icon: Building2 },
  { id: 'designations', label: 'Designations', icon: Briefcase },
  { id: 'tasks', label: 'Task Management', icon: CheckSquare },
  { id: 'timeline', label: 'Project Timeline', icon: GanttChartSquare },
  { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
];

const AdminDashboard = () => {
  const { statistics } = useTasks();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Keep the highlighted nav item in sync with the URL.
  useEffect(() => {
    const path = location.pathname.split('/admin/')[1] || 'dashboard';
    setActiveTab(path === '' ? 'dashboard' : path);
  }, [location]);

  const navigateToTab = (tab, search = '') => {
    setActiveTab(tab);
    navigate(`/admin/${tab === 'dashboard' ? '' : tab}${search}`);
  };

  const DashboardOverview = () => (
    <div className="space-y-6">
      <AdminCommandCenter
        onCreateTask={() => navigateToTab('tasks', '?new=1')}
        onViewReports={() => navigateToTab('reports')}
        onManageStaff={() => navigateToTab('staff')}
      />

      {statistics && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Task Priority Distribution</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted rounded-xl">
                <p className="text-2xl font-bold text-destructive">{statistics.byPriority?.critical || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">Critical</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-xl">
                <p className="text-2xl font-bold text-warning">{statistics.byPriority?.high || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">High</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-xl">
                <p className="text-2xl font-bold text-warning">{statistics.byPriority?.medium || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">Medium</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-xl">
                <p className="text-2xl font-bold text-success">{statistics.byPriority?.low || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">Low</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button onClick={() => navigateToTab('staff')} className="h-auto py-4 flex flex-col items-center space-y-2">
              <Users className="w-6 h-6" />
              <span>Manage Staff</span>
            </Button>
            <Button onClick={() => navigateToTab('tasks')} className="h-auto py-4 flex flex-col items-center space-y-2">
              <CheckSquare className="w-6 h-6" />
              <span>Manage Tasks</span>
            </Button>
            <Button onClick={() => navigateToTab('designations')} className="h-auto py-4 flex flex-col items-center space-y-2">
              <Briefcase className="w-6 h-6" />
              <span>Manage Roles</span>
            </Button>
            <Button onClick={() => navigateToTab('reports')} className="h-auto py-4 flex flex-col items-center space-y-2">
              <BarChart3 className="w-6 h-6" />
              <span>View Reports</span>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );

  return (
    <DashboardLayout
      subtitle="Admin Panel"
      menuItems={menuItems}
      activeTab={activeTab}
      onTabChange={navigateToTab}
      title={menuItems.find((item) => item.id === activeTab)?.label || 'Dashboard'}
    >
      <Routes>
        <Route path="/" element={<DashboardOverview />} />
        <Route path="/staff" element={<StaffManagement />} />
        <Route path="/admins" element={<AdminManagement />} />
        <Route path="/departments" element={<DepartmentsProjectsManagement />} />
        <Route path="/designations" element={<DesignationsManagement />} />
        <Route path="/tasks" element={<TaskManagement />} />
        <Route path="/timeline" element={<ProjectTimeline />} />
        <Route path="/reports" element={<PerformanceReports />} />
      </Routes>
    </DashboardLayout>
  );
};

export default AdminDashboard;
