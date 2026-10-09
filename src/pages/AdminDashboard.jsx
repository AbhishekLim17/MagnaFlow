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
  GanttChartSquare,
  Globe,
  DollarSign,
  History,
  Inbox,
  HeartPulse,
  Gauge,
  Zap,
  ListPlus,
  CalendarClock,
  FileText,
  Palmtree,
  ShieldAlert,
  BookOpen,
  Target,
  Flag,
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
import ClientsManagement from '@/components/admin/ClientsManagement';
import BudgetTracker from '@/components/admin/BudgetTracker';
import ActivityLog from '@/components/admin/ActivityLog';
import ClientRequestsInbox from '@/components/admin/ClientRequestsInbox';
import PortfolioHealth from '@/components/admin/PortfolioHealth';
import WorkloadPlanner from '@/components/admin/WorkloadPlanner';
import AutomationsPage from '@/components/admin/AutomationsPage';
import CustomFieldsPage from '@/components/admin/CustomFieldsPage';
import TimesheetsPage from '@/components/admin/TimesheetsPage';
import InvoicesPage from '@/components/admin/InvoicesPage';
import LeavePage from '@/components/shared/LeavePage';
import RaidPage from '@/components/admin/RaidPage';
import WikiPage from '@/components/shared/WikiPage';
import GoalsPage from '@/components/shared/GoalsPage';
import SprintsPage from '@/components/admin/SprintsPage';

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'staff', label: 'Staff Management', icon: Users },
  { id: 'admins', label: 'Dept. Heads & Managers', icon: Shield },
  { id: 'departments', label: 'Departments & Projects', icon: Building2 },
  { id: 'designations', label: 'Designations', icon: Briefcase },
  { id: 'tasks', label: 'Task Management', icon: CheckSquare },
  { id: 'timeline', label: 'Project Timeline', icon: GanttChartSquare },
  { id: 'sprints', label: 'Sprints', icon: Flag },
  { id: 'pages', label: 'Project Pages', icon: BookOpen },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'portfolio', label: 'Portfolio Health', icon: HeartPulse },
  { id: 'risks', label: 'Risks & Issues', icon: ShieldAlert },
  { id: 'workload', label: 'Workload', icon: Gauge },
  { id: 'timesheets', label: 'Timesheets', icon: CalendarClock },
  { id: 'leave', label: 'Leave & Holidays', icon: Palmtree },
  { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
  { id: 'clients', label: 'Client Portal', icon: Globe },
  { id: 'requests', label: 'Client Requests', icon: Inbox },
  { id: 'budget', label: 'Budget Tracker', icon: DollarSign },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'fields', label: 'Task Fields', icon: ListPlus },
  { id: 'automations', label: 'Automations', icon: Zap },
  { id: 'activity', label: 'Activity Log', icon: History },
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
            <h2 className="text-lg font-semibold mb-4">Task Priority Distribution</h2>
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
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
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
        <Route path="/portfolio" element={<PortfolioHealth />} />
        <Route path="/workload" element={<WorkloadPlanner />} />
        <Route path="/timesheets" element={<TimesheetsPage />} />
        <Route path="/leave" element={<LeavePage />} />
        <Route path="/risks" element={<RaidPage />} />
        <Route path="/pages" element={<WikiPage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/sprints" element={<SprintsPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/reports" element={<PerformanceReports />} />
        <Route path="/clients" element={<ClientsManagement />} />
        <Route path="/requests" element={<ClientRequestsInbox />} />
        <Route path="/budget" element={<BudgetTracker />} />
        <Route path="/fields" element={<CustomFieldsPage />} />
        <Route path="/automations" element={<AutomationsPage />} />
        <Route path="/activity" element={<ActivityLog />} />
      </Routes>
    </DashboardLayout>
  );
};

export default AdminDashboard;

