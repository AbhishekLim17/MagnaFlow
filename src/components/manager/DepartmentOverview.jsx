import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, Users, CheckSquare, TrendingUp, Clock, 
  AlertCircle, Target, BarChart3
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase-config';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDepartments } from '@/contexts/DepartmentsContext';
import { useToast } from '@/components/ui/use-toast';

const DepartmentOverview = ({ currentDepartment, isReadOnly = true }) => {
  const { departments, DEPARTMENT_CONFIG } = useDepartments();
  const { toast } = useToast();

  const [departmentStats, setDepartmentStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDepartmentStats = async () => {
      try {
        const stats = await Promise.all(
          departments
            .filter(dept => dept.id !== currentDepartment)
            .map(async (dept) => {
              // Fetch tasks for this department
              const tasksQuery = query(
                collection(db, 'tasks'),
                where('department', '==', dept.id)
              );
              const tasksSnapshot = await getDocs(tasksQuery);
              const tasks = tasksSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }));

              // Fetch staff for this department
              const staffQuery = query(
                collection(db, 'users'),
                where('department', '==', dept.id),
                where('role', 'in', ['staff', 'manager'])
              );
              const staffSnapshot = await getDocs(staffQuery);
              const staff = staffSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }));

              // Calculate statistics
              const totalTasks = tasks.length;
              const completedTasks = tasks.filter(task => task.status === 'completed').length;
              const inProgressTasks = tasks.filter(task => task.status === 'in-progress').length;
              const pendingTasks = tasks.filter(task => task.status === 'pending').length;
              const overdueTasks = tasks.filter(task => {
                const dueDate = task.dueDate?.toDate();
                return dueDate && dueDate < new Date() && task.status !== 'completed';
              }).length;

              const manager = staff.find(member => member.role === 'manager');
              const staffMembers = staff.filter(member => member.role === 'staff');

              return {
                department: dept,
                config: DEPARTMENT_CONFIG[dept.name] || {},
                stats: {
                  totalTasks,
                  completedTasks,
                  inProgressTasks,
                  pendingTasks,
                  overdueTasks,
                  completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
                },
                team: {
                  manager: manager || null,
                  staffCount: staffMembers.length,
                  totalMembers: staff.length
                },
                recentTasks: tasks
                  .sort((a, b) => new Date(b.createdAt?.seconds * 1000) - new Date(a.createdAt?.seconds * 1000))
                  .slice(0, 3)
              };
            })
        );

        setDepartmentStats(stats);
      } catch (error) {
        console.error('Error fetching department stats:', error);
        toast({
          title: "Error",
          description: "Failed to load department overview.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    if (departments.length > 0) {
      fetchDepartmentStats();
    }
  }, [departments, currentDepartment, DEPARTMENT_CONFIG, toast]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-red-100 text-red-800';
    }
  };

  const getCompletionColor = (rate) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Other Departments Overview
        </h2>
        <p className="text-gray-600">
          View the status and progress of all other departments (Read-only)
        </p>
      </div>

      {/* Department Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {departmentStats.map((deptData, index) => (
          <motion.div
            key={deptData.department.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="p-6">
              {/* Department Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${deptData.config.color}15` }}
                  >
                    <Building2 
                      className="w-6 h-6" 
                      style={{ color: deptData.config.color }}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {deptData.department.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {deptData.config.description}
                    </p>
                  </div>
                </div>
                <Badge 
                  className={`${getCompletionColor(deptData.stats.completionRate)} border-0`}
                  variant="secondary"
                >
                  {deptData.stats.completionRate}% Complete
                </Badge>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex items-center space-x-2">
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Tasks</p>
                    <p className="font-semibold">{deptData.stats.totalTasks}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">Team Size</p>
                    <p className="font-semibold">{deptData.team.totalMembers}</p>
                  </div>
                </div>
              </div>

              {/* Task Status Breakdown */}
              <div className="space-y-3 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Completed</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${deptData.stats.totalTasks > 0 ? 
                            (deptData.stats.completedTasks / deptData.stats.totalTasks) * 100 : 0}%` 
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">{deptData.stats.completedTasks}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">In Progress</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${deptData.stats.totalTasks > 0 ? 
                            (deptData.stats.inProgressTasks / deptData.stats.totalTasks) * 100 : 0}%` 
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">{deptData.stats.inProgressTasks}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Pending</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-red-600 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${deptData.stats.totalTasks > 0 ? 
                            (deptData.stats.pendingTasks / deptData.stats.totalTasks) * 100 : 0}%` 
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">{deptData.stats.pendingTasks}</span>
                  </div>
                </div>
              </div>

              {/* Manager Info */}
              {deptData.team.manager && (
                <div className="border-t pt-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      Manager: <span className="font-medium">{deptData.team.manager.name}</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Alerts */}
              {deptData.stats.overdueTasks > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-red-800">
                      {deptData.stats.overdueTasks} overdue task{deptData.stats.overdueTasks !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              )}

              {/* Recent Tasks Preview */}
              {deptData.recentTasks.length > 0 && (
                <div className="border-t pt-3 mt-3">
                  <p className="text-sm font-medium text-gray-900 mb-2">Recent Tasks</p>
                  <div className="space-y-2">
                    {deptData.recentTasks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 truncate flex-1 mr-2">
                          {task.title}
                        </span>
                        <Badge 
                          className={`${getStatusColor(task.status)} text-xs px-2 py-0`}
                          variant="secondary"
                        >
                          {task.status.replace('-', ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        ))}
      </div>

      {departmentStats.length === 0 && (
        <Card className="p-8 text-center">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No other departments to display</p>
        </Card>
      )}
    </div>
  );
};

export default DepartmentOverview;