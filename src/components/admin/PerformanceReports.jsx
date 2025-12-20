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
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import { useTasks } from '@/contexts/TasksContext';
import { getAllUsers } from '@/services/userService';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import ExcelJS from 'exceljs';

const PerformanceReports = () => {
  const { tasks: allTasks } = useTasks();
  const [staff, setStaff] = useState([]);
  const [timeRange, setTimeRange] = useState('30');
  const [filteredTasks, setFilteredTasks] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    // Load data from Firebase
    loadData();
  }, [allTasks, timeRange]);

  const loadData = async () => {
    try {
      // Get all staff members
      const users = await getAllUsers({ role: 'staff' });
      setStaff(users);
      
      // Filter tasks by selected time range
      const filtered = filterTasksByTimeRange(allTasks || [], timeRange);
      setFilteredTasks(filtered);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Filter tasks based on time range
  const filterTasksByTimeRange = (tasks, range) => {
    if (range === 'all') return tasks;
    
    const now = new Date();
    const daysAgo = parseInt(range);
    const cutoffDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    
    return tasks.filter(task => {
      const createdDate = task.createdAt?.toDate ? task.createdAt.toDate() : new Date(task.createdAt);
      return createdDate >= cutoffDate;
    });
  };

  const tasks = filteredTasks;

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
      name: member.name || member.email,
      completed: completedTasks.length,
      inProgress: inProgressTasks.length,
      pending: pendingTasks.length,
      total: memberTasks.length,
      productivity: memberTasks.length > 0 ? Math.round((completedTasks.length / memberTasks.length) * 100) : 0
    };
  }).filter(member => member.total > 0); // Only show members with tasks

  // Task status distribution
  const taskStatusData = [
    { name: 'Completed', value: tasks.filter(t => t.status === 'completed').length, color: '#10B981' },
    { name: 'In Progress', value: tasks.filter(t => t.status === 'in-progress').length, color: '#3B82F6' },
    { name: 'Pending', value: tasks.filter(t => t.status === 'pending').length, color: '#F59E0B' }
  ];

  // Priority distribution
  const priorityData = [
    { name: 'Critical', value: tasks.filter(t => t.priority === 'critical').length, color: '#DC2626' },
    { name: 'High', value: tasks.filter(t => t.priority === 'high').length, color: '#EF4444' },
    { name: 'Medium', value: tasks.filter(t => t.priority === 'medium').length, color: '#F97316' },
    { name: 'Low', value: tasks.filter(t => t.priority === 'low').length, color: '#6B7280' }
  ].filter(p => p.value > 0); // Only show priorities that have tasks

  // Calculate weekly progress from actual task data
  const getWeeklyProgress = () => {
    if (tasks.length === 0) return [];

    const now = new Date();
    const weeksData = [];
    
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (i * 7 + 7));
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() - (i * 7));
      
      const weekTasks = tasks.filter(task => {
        const createdDate = task.createdAt?.toDate ? task.createdAt.toDate() : new Date(task.createdAt);
        return createdDate >= weekStart && createdDate <= weekEnd;
      });
      
      const completedInWeek = weekTasks.filter(task => {
        if (task.completedAt) {
          const completedDate = task.completedAt?.toDate ? task.completedAt.toDate() : new Date(task.completedAt);
          return completedDate >= weekStart && completedDate <= weekEnd;
        }
        return false;
      });
      
      weeksData.push({
        week: `Week ${4 - i}`,
        completed: completedInWeek.length,
        created: weekTasks.length
      });
    }
    
    return weeksData;
  };

  const weeklyProgress = getWeeklyProgress();

  const handleExportReport = (format = 'pdf') => {
    try {
      if (format === 'pdf') {
        exportToPDF();
      } else {
        exportToExcel();
      }
      toast({
        title: "Report Exported",
        description: `Report downloaded as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.text('Performance Report - MagnaFlow', 14, 20);
    
    // Add date
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);
    
    // Add summary statistics
    doc.setFontSize(12);
    doc.text('Summary Statistics', 14, 38);
    doc.autoTable({
      startY: 42,
      head: [['Metric', 'Value']],
      body: [
        ['Total Tasks', tasks.length.toString()],
        ['Completed Tasks', tasks.filter(t => t.status === 'completed').length.toString()],
        ['In Progress Tasks', tasks.filter(t => t.status === 'in-progress').length.toString()],
        ['Pending Tasks', tasks.filter(t => t.status === 'pending').length.toString()],
        ['Completion Rate', `${completionRate}%`],
        ['Active Staff', staff.length.toString()],
      ],
    });
    
    // Add staff productivity
    let finalY = doc.lastAutoTable.finalY + 10;
    doc.text('Staff Productivity', 14, finalY);
    doc.autoTable({
      startY: finalY + 4,
      head: [['Staff Member', 'Total Tasks', 'Completed', 'In Progress', 'Pending', 'Productivity']],
      body: staffProductivity.map(s => [
        s.name,
        s.total.toString(),
        s.completed.toString(),
        s.inProgress.toString(),
        s.pending.toString(),
        `${s.productivity}%`
      ]),
    });
    
    // Save
    doc.save(`performance-report-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportToExcel = async () => {
    // Create workbook
    const workbook = new ExcelJS.Workbook();
    
    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.addRow(['Performance Report - MagnaFlow']);
    summarySheet.addRow(['Generated: ' + new Date().toLocaleDateString()]);
    summarySheet.addRow([]);
    summarySheet.addRow(['Summary Statistics']);
    summarySheet.addRow(['Metric', 'Value']);
    summarySheet.addRow(['Total Tasks', tasks.length]);
    summarySheet.addRow(['Completed Tasks', tasks.filter(t => t.status === 'completed').length]);
    summarySheet.addRow(['In Progress Tasks', tasks.filter(t => t.status === 'in-progress').length]);
    summarySheet.addRow(['Pending Tasks', tasks.filter(t => t.status === 'pending').length]);
    summarySheet.addRow(['Completion Rate', `${completionRate}%`]);
    summarySheet.addRow(['Active Staff', staff.length]);
    
    // Staff productivity sheet
    const staffSheet = workbook.addWorksheet('Staff Productivity');
    staffSheet.addRow(['Staff Productivity']);
    staffSheet.addRow([]);
    staffSheet.addRow(['Staff Member', 'Total Tasks', 'Completed', 'In Progress', 'Pending', 'Productivity %']);
    staffProductivity.forEach(s => {
      staffSheet.addRow([s.name, s.total, s.completed, s.inProgress, s.pending, s.productivity]);
    });
    
    // Task details sheet
    const taskSheet = workbook.addWorksheet('Tasks');
    taskSheet.addRow(['All Tasks']);
    taskSheet.addRow([]);
    taskSheet.addRow(['Title', 'Status', 'Priority', 'Assigned To', 'Created Date']);
    tasks.forEach(t => {
      taskSheet.addRow([
        t.title,
        t.status,
        t.priority,
        staff.find(s => s.id === t.assignedTo)?.name || 'Unassigned',
        t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString() : 'N/A'
      ]);
    });
    
    // Save
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const topPerformers = staffProductivity
    .filter(member => member.total > 0)
    .sort((a, b) => b.productivity - a.productivity)
    .slice(0, 3);

  // Calculate average task completion time
  const calculateAvgTaskTime = () => {
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.completedAt && t.createdAt);
    if (completedTasks.length === 0) return 0;
    
    const totalDays = completedTasks.reduce((sum, task) => {
      const created = task.createdAt?.toDate ? task.createdAt.toDate() : new Date(task.createdAt);
      const completed = task.completedAt?.toDate ? task.completedAt.toDate() : new Date(task.completedAt);
      const days = Math.ceil((completed - created) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);
    
    return (totalDays / completedTasks.length).toFixed(1);
  };

  const avgTaskTime = calculateAvgTaskTime();

  // Calculate team efficiency (percentage of tasks completed on time)
  const calculateTeamEfficiency = () => {
    const tasksWithDeadline = tasks.filter(t => t.deadline && t.status === 'completed' && t.completedAt);
    if (tasksWithDeadline.length === 0) return 0;
    
    const completedOnTime = tasksWithDeadline.filter(task => {
      const deadline = task.deadline?.toDate ? task.deadline.toDate() : new Date(task.deadline);
      const completed = task.completedAt?.toDate ? task.completedAt.toDate() : new Date(task.completedAt);
      return completed <= deadline;
    });
    
    return Math.round((completedOnTime.length / tasksWithDeadline.length) * 100);
  };

  const teamEfficiency = calculateTeamEfficiency();

  // Count active projects (unique assignments)
  const activeProjects = staff.filter(member => {
    const memberTasks = tasks.filter(t => t.assignedTo === member.id);
    return memberTasks.some(t => t.status === 'in-progress' || t.status === 'pending');
  }).length;

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
            <SelectTrigger className="w-48 glass-effect border-white/20 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="glass-effect border-white/20">
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="180">Last 6 months</SelectItem>
              <SelectItem value="365">Last 1 year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button
              onClick={() => handleExportReport('pdf')}
              variant="outline"
              className="border-white/20 text-gray-300 hover:bg-white/10"
            >
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
            <Button
              onClick={() => handleExportReport('excel')}
              variant="outline"
              className="border-white/20 text-gray-300 hover:bg-white/10"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </div>
      </div>

      {/* Show empty state if no data */}
      {tasks.length === 0 ? (
        <Card className="glass-effect border-white/20 p-12 text-center">
          <div className="flex flex-col items-center justify-center space-y-4">
            <BarChart3 className="w-16 h-16 text-gray-400" />
            <h3 className="text-xl font-semibold text-white">No Data Available</h3>
            <p className="text-gray-400 max-w-md">
              There are no tasks in the system yet. Create tasks and assign them to staff members to see performance analytics and reports.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[
              { 
                title: 'Completion Rate', 
                value: `${completionRate}%`, 
                icon: Target, 
                color: 'teal-600',
                trend: completionRate > 0 ? `${completionRate}%` : '0%'
              },
              { 
                title: 'Active Staff', 
                value: activeProjects.toString(), 
                icon: BarChart3, 
                color: 'blue-600',
                trend: `${staff.length} total`
              },
              { 
                title: 'Team Efficiency', 
                value: teamEfficiency > 0 ? `${teamEfficiency}%` : 'N/A', 
                icon: Award, 
                color: 'indigo-600',
                trend: teamEfficiency > 0 ? `${teamEfficiency}%` : 'No data'
              },
              { 
                title: 'Avg. Task Time', 
                value: avgTaskTime > 0 ? `${avgTaskTime}d` : 'N/A', 
                icon: Clock, 
                color: 'slate-600',
                trend: avgTaskTime > 0 ? `${avgTaskTime}d avg` : 'No data'
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
                <div className={`w-12 h-12 bg-${metric.color} rounded-lg flex items-center justify-center shadow-lg`}>
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
            <BarChart data={staffProductivity} margin={{ left: 20, right: 20 }}>
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
                  backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                  border: '1px solid rgba(200, 200, 200, 0.5)',
                  borderRadius: '8px',
                  color: '#1F2937'
                }}
              />
              <Bar dataKey="completed" fill="#10B981" radius={[4, 4, 0, 0]} barSize={60} />
              <Bar dataKey="inProgress" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={60} />
              <Bar dataKey="pending" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={60} />
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
                labelLine={false}
                label={({ name, percent, cx, cy, midAngle, innerRadius, outerRadius, index }) => {
                  // Don't show label if percentage is too small to avoid overlap
                  if (percent < 0.03) return null;
                  
                  const RADIAN = Math.PI / 180;
                  const radius = outerRadius + 30;
                  const x = cx + radius * Math.cos(-midAngle * RADIAN);
                  const y = cy + radius * Math.sin(-midAngle * RADIAN);
                  
                  return (
                    <text 
                      x={x} 
                      y={y} 
                      fill="white" 
                      textAnchor={x > cx ? 'start' : 'end'} 
                      dominantBaseline="central"
                      fontSize="14px"
                      fontWeight="600"
                    >
                      {`${name} ${(percent * 100).toFixed(0)}%`}
                    </text>
                  );
                }}
                outerRadius={90}
                dataKey="value"
              >
                {taskStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="#1e293b" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                  border: '1px solid rgba(200, 200, 200, 0.5)',
                  borderRadius: '8px',
                  color: '#1F2937'
                }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                iconType="circle"
                wrapperStyle={{ color: '#F9FAFB', fontSize: '14px', paddingTop: '10px' }}
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
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-lg ${
                    index === 0 ? 'bg-yellow-500' :
                    index === 1 ? 'bg-slate-400' :
                    'bg-orange-500'
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
        </>
      )}
    </motion.div>
  );
};

export default PerformanceReports;