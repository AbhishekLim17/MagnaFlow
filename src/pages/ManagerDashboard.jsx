import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Users, CheckSquare, BarChart3, LogOut, Plus,
  Filter, TrendingUp, Award, Target, Clock, Menu, Eye, Building2, AlertCircle
} from 'lucide-react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/firebase-config';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useDepartments } from '@/contexts/DepartmentsContext';
import { useToast } from '@/components/ui/use-toast';
import UserCard from '@/components/UserCard';
import TaskManagement from '@/components/manager/TaskManagement';
import DepartmentOverview from '@/components/manager/DepartmentOverview';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const ManagerDashboard = () => {
  const { user, logout, canAccessDepartment } = useAuth();
  const { getDepartmentById, departments } = useDepartments();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // State to hold dashboard data
  const [myDepartmentTasks, setMyDepartmentTasks] = useState([]);
  const [otherDepartmentsSummary, setOtherDepartmentsSummary] = useState([]);
  const [departmentStaff, setDepartmentStaff] = useState([]);

  const userDepartment = getDepartmentById(user?.department);

  useEffect(() => {
    if (user?.role !== 'manager' || !user?.department) return;

    const fetchManagerData = async () => {
      try {
        // Fetch tasks from manager's department
        const myDeptTasksQuery = query(
          collection(db, 'tasks'), 
          where('department', '==', user.department)
        );
        const myDeptTasksSnapshot = await getDocs(myDeptTasksQuery);
        const myDeptTasks = myDeptTasksSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          dueDate: doc.data().dueDate?.toDate(),
          createdAt: doc.data().createdAt?.toDate()
        }));
        setMyDepartmentTasks(myDeptTasks);

        // Fetch summary data for other departments (read-only)
        const otherDepartments = departments.filter(dept => dept.id !== user.department);
        const summaryPromises = otherDepartments.map(async (dept) => {
          const tasksQuery = query(collection(db, 'tasks'), where('department', '==', dept.id));
          const tasksSnapshot = await getDocs(tasksQuery);
          const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          return {
            department: dept,
            totalTasks: tasks.length,
            completedTasks: tasks.filter(task => task.status === 'completed').length,
            inProgressTasks: tasks.filter(task => task.status === 'in-progress').length,
            pendingTasks: tasks.filter(task => task.status === 'pending').length
          };
        });

        const summaryData = await Promise.all(summaryPromises);
        setOtherDepartmentsSummary(summaryData);

        // Fetch staff in manager's department
        const staffQuery = query(
          collection(db, 'users'), 
          where('department', '==', user.department),
          where('role', '==', 'staff')
        );
        const staffSnapshot = await getDocs(staffQuery);
        const staff = staffSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setDepartmentStaff(staff);

      } catch (error) {
        console.error('Error fetching manager data:', error);
        toast({
          title: "Error",
          description: "Failed to load dashboard data.",
          variant: "destructive"
        });
      }
    };

    fetchManagerData();
  }, [user, departments, toast]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: '/manager'
    },
    {
      id: 'tasks',
      label: 'My Department Tasks',
      icon: CheckSquare,
      path: '/manager/tasks'
    },
    {
      id: 'staff',
      label: 'Department Staff',
      icon: Users,
      path: '/manager/staff'
    },
    {
      id: 'overview',
      label: 'Other Departments',
      icon: Eye,
      path: '/manager/overview'
    }
  ];

  const stats = {
    totalTasks: myDepartmentTasks.length,
    completedTasks: myDepartmentTasks.filter(task => task.status === 'completed').length,
    inProgressTasks: myDepartmentTasks.filter(task => task.status === 'in-progress').length,
    pendingTasks: myDepartmentTasks.filter(task => task.status === 'pending').length,
    staffCount: departmentStaff.length
  };

  const Sidebar = ({ isMobile = false }) => (
    <div className={`${isMobile ? 'w-full' : 'w-64'} bg-gray-900 text-white flex flex-col h-full`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Manager Portal</h1>
            <p className="text-sm text-gray-400">{userDepartment?.name}</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium">
              {user?.name?.charAt(0)?.toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium">{user?.name}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id);
              if (isMobile) setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
              activeTab === item.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-700">
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </Button>
      </div>
    </div>
  );

  const DashboardContent = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {userDepartment?.name} Department Dashboard
          </h2>
          <p className="text-gray-600">Manage your department and view company overview</p>
        </div>
      </div>

      {/* Department Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Tasks</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalTasks}</p>
            </div>
            <CheckSquare className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">{stats.completedTasks}</p>
            </div>
            <Target className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.inProgressTasks}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-red-600">{stats.pendingTasks}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Staff Members</p>
              <p className="text-2xl font-bold text-gray-900">{stats.staffCount}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </Card>
      </div>

      {/* Other Departments Summary */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Other Departments Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {otherDepartmentsSummary.map((summary) => (
            <div key={summary.department.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">{summary.department.name}</h4>
                <Badge variant="secondary">{summary.totalTasks} tasks</Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Completed:</span>
                  <span className="text-green-600 font-medium">{summary.completedTasks}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">In Progress:</span>
                  <span className="text-yellow-600 font-medium">{summary.inProgressTasks}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Pending:</span>
                  <span className="text-red-600 font-medium">{summary.pendingTasks}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="lg:hidden fixed top-4 left-4 z-40">
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar isMobile={true} />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && <DashboardContent />}
              {activeTab === 'tasks' && (
                <TaskManagement 
                  departmentId={user?.department} 
                  isManager={true}
                />
              )}
              {activeTab === 'staff' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        {userDepartment?.name} Team Members
                      </h2>
                      <p className="text-gray-600">Manage your department staff and view their information</p>
                    </div>
                  </div>

                  {/* Team Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Staff</p>
                          <p className="text-2xl font-bold text-gray-900">{departmentStaff.length}</p>
                        </div>
                        <Users className="h-8 w-8 text-blue-600" />
                      </div>
                    </Card>
                    
                    <Card className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Active Members</p>
                          <p className="text-2xl font-bold text-green-600">
                            {departmentStaff.filter(staff => staff.isActive).length}
                          </p>
                        </div>
                        <Target className="h-8 w-8 text-green-600" />
                      </div>
                    </Card>

                    <Card className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Senior Staff</p>
                          <p className="text-2xl font-bold text-purple-600">
                            {departmentStaff.filter(staff => ['Senior', 'Lead', 'Principal'].includes(staff.tier)).length}
                          </p>
                        </div>
                        <Award className="h-8 w-8 text-purple-600" />
                      </div>
                    </Card>
                  </div>

                  {/* Staff List */}
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Members</h3>
                    {departmentStaff.length === 0 ? (
                      <div className="text-center py-8">
                        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No staff members found</h3>
                        <p className="text-gray-600">There are currently no staff members in your department.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {departmentStaff.map(staff => (
                          <UserCard
                            key={staff.id}
                            userData={staff}
                            compact={true}
                            showActions={false}
                          />
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              )}
              {activeTab === 'overview' && (
                <DepartmentOverview 
                  currentDepartment={user?.department}
                  isReadOnly={true}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default ManagerDashboard;