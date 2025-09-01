import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  CheckSquare, 
  Calendar,
  Download,
  Filter,
  Award,
  Target,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';

const PerformanceReports = () => {
  const [tasks, setTasks] = useState([]);
  const [staff, setStaff] = useState([]);
  const [timeRange, setTimeRange] = useState('30');
  const { toast } = useToast();

  useEffect(() => {
    // Load data from localStorage
    const savedTasks = localStorage.getItem('projectflow_tasks');
    const savedStaff = localStorage.getItem('projectflow_staff');
    
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    }
    
    if (savedStaff) {
      setStaff(JSON.parse(savedStaff));
    } else {
      // Default staff data
      setStaff([
        { id: 2, name: 'Staff Member', status: 'active' },
        { id: 3, name: 'Sarah Johnson', status: 'active' },
        { id: 4, name: 'Mike Chen', status: 'active' },
        { id: 5, name: 'Emma Davis', status: 'active' }
      ]);
    }
  }, []);

  // Calculate completion rate
  const completionRate = tasks.length > 0 
    ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100)
    : 0;

  // Staff productivity data
  const staffProductivity = staff.map(member => {
    const memberTasks = tasks.filter(t => t.assignedTo === member.id);
    const completedTasks = memberTasks.filter(t => t.status === 'completed');
    const inProgressTasks = memberTasks.filter(t => t.status === 'in-progress');
    const pendingTasks = memberTasks.filter(t => t.status === 'pending');
    
    return {
      name: member.name,
      completed: completedTasks.length,
      inProgress: inProgressTasks.length,
      pending: pendingTasks.length,
      total: memberTasks.length,
      productivity: memberTasks.length > 0 ? Math.round((completedTasks.length / memberTasks.length) * 100) : 0
    };
  });

  // Task status distribution
  const taskStatusData = [
    { name: 'Completed', value: tasks.filter(t => t.status === 'completed').length, color: '#10B981' },
    { name: 'In Progress', value: tasks.filter(t => t.status === 'in-progress').length, color: '#3B82F6' },
    { name: 'Pending', value: tasks.filter(t => t.status === 'pending').length, color: '#F59E0B' }
  ];

  // Priority distribution
  const priorityData = [
    { name: 'High', value: tasks.filter(t => t.priority === 'high').length, color: '#EF4444' },
    { name: 'Medium', value: tasks.filter(t => t.priority === 'medium').length, color: '#F97316' },
    { name: 'Low', value: tasks.filter(t => t.priority === 'low').length, color: '#6B7280' }
  ];

  // Weekly progress data (mock data for demonstration)
  const weeklyProgress = [
    { week: 'Week 1', completed: 8, created: 12 },
    { week: 'Week 2', completed: 12, created: 10 },
    { week: 'Week 3', completed: 15, created: 14 },
    { week: 'Week 4', completed: 18, created: 16 },
  ];

  const handleExportReport = () => {
    toast({
      title: "🚧 Export feature not implemented yet",
      description: "You can request this feature in your next prompt! 🚀",
    });
  };

  const topPerformers = staffProductivity
    .filter(member => member.total > 0)
    .sort((a, b) => b.productivity - a.productivity)
    .slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Performance Reports</h2>
          <p className="text-gray-300">Track team productivity and project progress</p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40 glass-effect border-white/20 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-effect border-white/20">
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleExportReport}
            variant="outline"
            className="border-white/20 text-gray-300 hover:bg-white/10"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { 
            title: 'Completion Rate', 
            value: `${completionRate}%`, 
            icon: Target, 
            color: 'from-green-500 to-emerald-500',
            trend: '+5%'
          },
          { 
            title: 'Active Projects', 
            value: '12', 
            icon: BarChart3, 
            color: 'from-blue-500 to-cyan-500',
            trend: '+2'
          },
          { 
            title: 'Team Efficiency', 
            value: '94%', 
            icon: Award, 
            color: 'from-purple-500 to-pink-500',
            trend: '+8%'
          },
          { 
            title: 'Avg. Task Time', 
            value: '2.3d', 
            icon: Clock, 
            color: 'from-orange-500 to-red-500',
            trend: '-0.5d'
          },
        ].map((metric, index) => (
          <motion.div
            key={metric.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="glass-effect p-6 card-hover">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">{metric.title}</p>
                  <p className="text-2xl font-bold text-white">{metric.value}</p>
                  <p className="text-green-400 text-sm flex items-center mt-1">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {metric.trend}
                  </p>
                </div>
                <div className={`w-12 h-12 bg-gradient-to-r ${metric.color} rounded-lg flex items-center justify-center`}>
                  <metric.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Staff Productivity Chart */}
        <Card className="glass-effect p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white">Staff Productivity</h3>
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
              Tasks Completed
            </Badge>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={staffProductivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="name" 
                stroke="#9CA3AF"
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis stroke="#9CA3AF" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(17, 24, 39, 0.9)', 
                  border: '1px solid rgba(75, 85, 99, 0.3)',
                  borderRadius: '8px',
                  color: '#F9FAFB'
                }}
              />
              <Bar dataKey="completed" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="inProgress" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pending" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Task Status Distribution */}
        <Card className="glass-effect p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white">Task Status Distribution</h3>
            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
              Current Status
            </Badge>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={taskStatusData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {taskStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(17, 24, 39, 0.9)', 
                  border: '1px solid rgba(75, 85, 99, 0.3)',
                  borderRadius: '8px',
                  color: '#F9FAFB'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Weekly Progress and Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Weekly Progress */}
        <div className="lg:col-span-2">
          <Card className="glass-effect p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Weekly Progress</h3>
              <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                Tasks vs Goals
              </Badge>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={weeklyProgress}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="week" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(17, 24, 39, 0.9)', 
                    border: '1px solid rgba(75, 85, 99, 0.3)',
                    borderRadius: '8px',
                    color: '#F9FAFB'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="completed" 
                  stackId="1" 
                  stroke="#10B981" 
                  fill="#10B981" 
                  fillOpacity={0.6}
                />
                <Area 
                  type="monotone" 
                  dataKey="created" 
                  stackId="2" 
                  stroke="#3B82F6" 
                  fill="#3B82F6" 
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Top Performers */}
        <Card className="glass-effect p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white">Top Performers</h3>
            <Award className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="space-y-4">
            {topPerformers.map((performer, index) => (
              <motion.div
                key={performer.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
                    index === 0 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                    index === 1 ? 'bg-gradient-to-r from-gray-300 to-gray-500' :
                    'bg-gradient-to-r from-orange-400 to-red-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-white font-medium">{performer.name}</p>
                    <p className="text-xs text-gray-400">{performer.completed} completed</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-green-400 font-semibold">{performer.productivity}%</p>
                  <p className="text-xs text-gray-400">efficiency</p>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>
    </motion.div>
  );
};

export default PerformanceReports;