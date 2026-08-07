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
import { Users, CheckCircle, Clock, AlertTriangle, Award, Activity, Plus, BarChart3 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTasks } from '@/contexts/TasksContext';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { getAllUsers } from '@/services/userService';
import StatCard from '@/components/shared/StatCard';
import MyTasksPanel from '@/components/shared/MyTasksPanel';
import { safeListen, safeUnsubscribe } from '@/lib/safeUnsubscribe';

export function AdminCommandCenter({ onCreateTask, onViewReports, onManageStaff }) {
  const { tasks } = useTasks();
  const { currentUser } = useAuth();
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
      limit(10)
    );

    const unsubscribe = safeListen(() => onSnapshot(q, (snapshot) => {
      const activities = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        updatedAt: doc.data().updatedAt?.toDate?.() || new Date()
      }));
      setRecentActivity(activities);
    }));

    return () => safeUnsubscribe(unsubscribe);
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
      {/* Actions. The page title is rendered by DashboardLayout — repeating
          it here gave the screen two competing headings saying the same thing. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Real-time overview of your workspace</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onCreateTask}>
            <Plus className="h-4 w-4" />
            New Task
          </Button>
          <Button onClick={onManageStaff} variant="outline">
            <Users className="h-4 w-4" />
            Manage Staff
          </Button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="Completed Today"
          index={0}
          value={stats.completedToday}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="In Progress"
          index={1}
          value={stats.inProgress}
          icon={Clock}
          color="blue"
        />
        <StatCard
          title="Overdue"
          index={2}
          value={stats.overdue}
          icon={AlertTriangle}
          color="red"
          trend={stats.overdue > 0 ? "Needs attention" : ""}
        />
        <StatCard
          title="Total Tasks"
          index={3}
          value={stats.total}
          icon={BarChart3}
          color="purple"
        />
      </div>

      {/* An org admin is assigned work too, and the tiles above only roll up
          the whole organisation. */}
      <MyTasksPanel tasks={tasks} userId={currentUser?.uid || currentUser?.id} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Activity Feed */}
        <div className="lg:col-span-1">
          {/* Recent Activity */}
          <Card className="p-5 h-[240px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center">
                <Activity className="w-4 h-4 mr-2 text-primary" />
                Recent Activity
              </h3>
              <Badge variant="outline" className="border-border">Live</Badge>
            </div>
            <div className="space-y-3 overflow-y-auto max-h-[170px]">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent activity</p>
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
          <Card className="p-5 h-[240px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center">
                <Award className="w-4 h-4 mr-2 text-warning" />
                Top Performers
              </h3>
            </div>
            <div className="space-y-3">
              {staffStats.length === 0 ? (
                <p className="text-sm text-muted-foreground">No performance data yet</p>
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
    if (status === 'completed') return 'text-success';
    if (status === 'in-progress') return 'text-primary';
    return 'text-muted-foreground';
  };

  return (
    <div className="flex items-start space-x-3 text-sm">
      <div className={`w-2 h-2 rounded-full mt-1.5 ${getStatusColor(activity.status)}`} />
      <div className="flex-1 min-w-0">
        <p className="text-muted-foreground truncate">{activity.title}</p>
        <p className="text-xs text-muted-foreground">{getTimeAgo(activity.updatedAt)}</p>
      </div>
    </div>
  );
}

// Performer Card
function PerformerCard({ staff, rank }) {
  const medals = ['🥇', '🥈', '🥉'];
  
  return (
    <div className="flex items-center gap-2 p-2 rounded-xl bg-muted">
      <span className="text-xl">{medals[rank - 1]}</span>
      <span className="font-semibold text-sm">{staff.staffName}</span>
      <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
        <span>✅ {staff.completed}</span>
        <span>⏳ {staff.inProgress}</span>
        {staff.overdue > 0 && <span className="text-destructive">🔴 {staff.overdue}</span>}
      </div>
    </div>
  );
}


