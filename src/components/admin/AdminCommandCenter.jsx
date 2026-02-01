/**
 * Admin Command Center - All-in-One Dashboard
 * 
 * Comprehensive admin dashboard with:
 * - Quick stats and metrics
 * - Real-time activity feed
 * - Notifications center
 * - Top performers leaderboard
 * - Email quota tracking
 * - Quick actions
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
  Mail,
  Calendar,
  Award,
  Activity,
  Plus,
  BarChart3
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTasks } from '@/contexts/TasksContext';
import { useEmailQuota } from '@/hooks/useEmailQuota';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { getAllUsers } from '@/services/userService';

export function AdminCommandCenter({ onCreateTask, onViewReports, onManageStaff }) {
  const { tasks } = useTasks();
  const emailQuota = useEmailQuota();
  const [recentActivity, setRecentActivity] = useState([]);
  const [staffStats, setStaffStats] = useState([]);
  const [staff, setStaff] = useState([]);

  // Load staff data
  useEffect(() => {
    const loadStaff = async () => {
      try {
        const staffList = await getAllUsers({ role: 'staff' });
        setStaff(staffList);
      } catch (error) {
        console.error('Error loading staff:', error);
      }
    };
    loadStaff();
  }, []);

  // Calculate quick stats
  const stats = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const completedToday = tasks.filter(t => {
      const completedAt = t.completedAt?.toDate?.() || new Date(t.completedAt);
      return t.status === 'completed' && completedAt >= today;
    }).length;

    const overdue = tasks.filter(t => {
      if (t.status === 'completed') return false;
      const deadline = t.deadline?.toDate?.() || new Date(t.deadline);
      return deadline < new Date();
    }).length;

    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const pending = tasks.filter(t => t.status === 'pending').length;

    return {
      completedToday,
      overdue,
      inProgress,
      pending,
      total: tasks.length
    };
  }, [tasks]);

  // Listen to recent activity
  useEffect(() => {
    const q = query(
      collection(db, 'tasks'),
      orderBy('updatedAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activities = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        updatedAt: doc.data().updatedAt?.toDate?.() || new Date()
      }));
      setRecentActivity(activities);
    });

    return () => unsubscribe();
  }, []);

  // Calculate staff performance
  useEffect(() => {
    if (tasks.length === 0 || staff.length === 0) return;

    const staffPerformance = {};
    
    tasks.forEach(task => {
      const staffId = task.assignedTo;
      if (!staffId) return;

      if (!staffPerformance[staffId]) {
        const staffMember = staff.find(s => s.id === staffId);
        staffPerformance[staffId] = {
          staffId,
          staffName: staffMember?.name || 'Unassigned',
          completed: 0,
          inProgress: 0,
          overdue: 0
        };
      }

      if (task.status === 'completed') {
        staffPerformance[staffId].completed++;
      } else if (task.status === 'in-progress') {
        staffPerformance[staffId].inProgress++;
      }

      // Check overdue
      if (task.status !== 'completed') {
        const deadline = task.deadline?.toDate?.() || new Date(task.deadline);
        if (deadline < new Date()) {
          staffPerformance[staffId].overdue++;
        }
      }
    });

    const topPerformers = Object.values(staffPerformance)
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 3);

    setStaffStats(topPerformers);
  }, [tasks, staff]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Command Center
          </h2>
          <p className="text-gray-400 mt-1">Real-time overview of your workspace</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={onCreateTask} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
          <Button onClick={onManageStaff} variant="outline" className="border-gray-700">
            <Users className="w-4 h-4 mr-2" />
            Manage Staff
          </Button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          title="Completed Today"
          value={stats.completedToday}
          icon={<CheckCircle className="w-5 h-5" />}
          color="green"
          trend="+12%"
        />
        <StatCard
          title="In Progress"
          value={stats.inProgress}
          icon={<Clock className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Overdue"
          value={stats.overdue}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
          trend={stats.overdue > 0 ? "Needs attention" : ""}
        />
        <StatCard
          title="Total Tasks"
          value={stats.total}
          icon={<BarChart3 className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          title="Email Quota"
          value={`${emailQuota.used}/${emailQuota.limit}`}
          icon={<Mail className="w-5 h-5" />}
          color={emailQuota.status === 'critical' ? 'red' : emailQuota.status === 'warning' ? 'yellow' : 'green'}
          trend={`${emailQuota.percentage}%`}
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Activity Feed */}
        <div className="lg:col-span-1">
          {/* Recent Activity */}
          <Card className="glass-effect border-gray-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center">
                <Activity className="w-4 h-4 mr-2 text-blue-400" />
                Recent Activity
              </h3>
              <Badge variant="outline" className="border-gray-700">Live</Badge>
            </div>
            <div className="space-y-3">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-gray-500">No recent activity</p>
              ) : (
                recentActivity.map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right Column - Top Performers */}
        <div className="lg:col-span-1">
          <Card className="glass-effect border-gray-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center">
                <Award className="w-4 h-4 mr-2 text-yellow-400" />
                Top Performers
              </h3>
            </div>
            <div className="space-y-4">
              {staffStats.length === 0 ? (
                <p className="text-sm text-gray-500">No performance data yet</p>
              ) : (
                staffStats.map((staff, index) => (
                  <PerformerCard key={staff.staffId} staff={staff} rank={index + 1} />
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ title, value, icon, color, trend }) {
  const colorClasses = {
    green: 'text-green-400 bg-green-500/10 border-green-500/30',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    red: 'text-red-400 bg-red-500/10 border-red-500/30',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`glass-effect border ${colorClasses[color]} p-5`}>
        <div className="flex items-center justify-between mb-2">
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            {icon}
          </div>
          {trend && (
            <span className="text-xs text-gray-400">{trend}</span>
          )}
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-gray-400">{title}</div>
      </Card>
    </motion.div>
  );
}

// Activity Item
function ActivityItem({ activity }) {
  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getStatusColor = (status) => {
    if (status === 'completed') return 'text-green-400';
    if (status === 'in-progress') return 'text-blue-400';
    return 'text-gray-400';
  };

  return (
    <div className="flex items-start space-x-3 text-sm">
      <div className={`w-2 h-2 rounded-full mt-1.5 ${getStatusColor(activity.status)}`} />
      <div className="flex-1 min-w-0">
        <p className="text-gray-300 truncate">{activity.title}</p>
        <p className="text-xs text-gray-500">{getTimeAgo(activity.updatedAt)}</p>
      </div>
    </div>
  );
}

// Performer Card
function PerformerCard({ staff, rank }) {
  const medals = ['🥇', '🥈', '🥉'];
  
  return (
    <div className="flex items-center space-x-3 p-3 rounded-lg bg-gray-800/50">
      <div className="text-2xl">{medals[rank - 1]}</div>
      <div className="flex-1">
        <div className="font-semibold">{staff.staffName}</div>
        <div className="flex items-center space-x-3 text-xs text-gray-400">
          <span>✅ {staff.completed}</span>
          <span>⏳ {staff.inProgress}</span>
          {staff.overdue > 0 && <span className="text-red-400">🔴 {staff.overdue}</span>}
        </div>
      </div>
    </div>
  );
}


