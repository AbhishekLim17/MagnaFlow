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
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { getAssignableUsers } from '@/services/userService';
import StatCard from '@/components/shared/StatCard';
import MyTasksPanel from '@/components/shared/MyTasksPanel';
import { LoadingState } from '@/components/shared/States';
import { safeListen, safeUnsubscribe } from '@/lib/safeUnsubscribe';
import { isOverdueTask } from '@/lib/taskState';
import { statusLabel } from '@/lib/taskLabels';
import { formatRelative } from '@/lib/format';

export function AdminCommandCenter({ onCreateTask, onViewReports, onManageStaff }) {
  const { tasks, loading: tasksLoading } = useTasks();
  const { currentUser } = useAuth();
  const [recentActivity, setRecentActivity] = useState([]);
  // 'loading' until the first answer arrives: an empty list that is still loading must
  // not read "No recent activity" / "No performance data yet".
  const [activityState, setActivityState] = useState('loading'); // loading | ready | error
  const [staffStats, setStaffStats] = useState([]);
  const [staff, setStaff] = useState([]);
  const [staffState, setStaffState] = useState('loading'); // loading | ready | error

  // Load staff data
  useEffect(() => {
    const loadStaff = async () => {
      setStaffState('loading');
      try {
        // Everyone who can hold a task, not only the 'staff' role, so work assigned
        // to a manager or head is credited to them rather than to "Unassigned".
        setStaff(await getAssignableUsers(currentUser));
        setStaffState('ready');
      } catch (error) {
        console.error('Error loading staff:', error);
        setStaffState('error');
      }
    };
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  // Calculate quick stats
  const stats = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const completedToday = tasks.filter(t => {
      const completedAt = t.completedAt?.toDate?.() || new Date(t.completedAt);
      return t.status === 'completed' && completedAt >= today;
    }).length;

    const overdue = tasks.filter(t => isOverdueTask(t)).length;

    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const review = tasks.filter(t => t.status === 'review').length;
    const pending = tasks.filter(t => t.status === 'pending').length;

    return {
      completedToday,
      overdue,
      inProgress,
      review,
      pending,
      total: tasks.length
    };
  }, [tasks]);

  // Listen to recent activity
  useEffect(() => {
    // Fix #3: scope activity to current org so multi-tenant rules don't block it
    if (!currentUser?.orgId) return;
    const q = query(
      collection(db, 'tasks'),
      where('orgId', '==', currentUser.orgId),
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
      setActivityState('ready');
    }, (error) => {
      console.error('Error loading recent activity:', error);
      setActivityState('error');
    }));

    return () => safeUnsubscribe(unsubscribe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // An assignee we cannot resolve (a removed account) is not a performer.
        if (!staffMember) return;
        staffPerformance[staffId] = {
          staffId,
          staffName: staffMember.name || staffMember.email,
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
      if (isOverdueTask(task)) {
        staffPerformance[staffId].overdue++;
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
          loading={tasksLoading}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="In Progress"
          index={1}
          value={stats.inProgress}
          loading={tasksLoading}
          icon={Clock}
          color="blue"
        />
        <StatCard
          title="Overdue"
          index={2}
          value={stats.overdue}
          loading={tasksLoading}
          icon={AlertTriangle}
          color="red"
          trend={stats.overdue > 0 ? "Needs attention" : ""}
        />
        <StatCard
          title="Total Tasks"
          index={3}
          value={stats.total}
          loading={tasksLoading}
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
              <h2 className="font-semibold flex items-center">
                <Activity className="w-4 h-4 mr-2 text-primary" />
                Recent Activity
              </h2>
              <Badge variant="outline" className="border-border">Live</Badge>
            </div>
            <div className="space-y-3 overflow-y-auto max-h-[170px]">
              {activityState === 'loading' ? (
                <LoadingState rows={3} />
              ) : activityState === 'error' ? (
                <p className="text-sm text-destructive" role="alert">Couldn't load recent activity. Refresh to try again.</p>
              ) : recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing has changed recently.</p>
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
              <h2 className="font-semibold flex items-center">
                <Award className="w-4 h-4 mr-2 text-warning" />
                Top Performers
              </h2>
            </div>
            <div className="space-y-3">
              {tasksLoading || staffState === 'loading' ? (
                <LoadingState rows={3} />
              ) : staffState === 'error' ? (
                <p className="text-sm text-destructive" role="alert">Couldn't load your team. Refresh to try again.</p>
              ) : staffStats.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nobody has completed or started a task yet.</p>
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
  const getStatusDot = (status) => {
    if (status === 'completed') return 'bg-success';
    if (status === 'in-progress') return 'bg-primary';
    return 'bg-muted-foreground';
  };

  return (
    <div className="flex items-start space-x-3 text-sm">
      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${getStatusDot(activity.status)}`} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-foreground truncate">{activity.title}</p>
        <p className="text-xs text-muted-foreground">
          {statusLabel(activity.status)} · {formatRelative(activity.updatedAt)}
        </p>
      </div>
    </div>
  );
}

// Performer Card
function PerformerCard({ staff, rank }) {
  const medals = ['🥇', '🥈', '🥉'];
  
  return (
    <div className="flex items-center gap-2 p-2 rounded-xl bg-muted">
      <span className="text-xl" aria-label={`Rank ${rank}`}>{medals[rank - 1]}</span>
      <span className="font-semibold text-sm truncate">{staff.staffName}</span>
      <div className="flex flex-wrap items-center justify-end gap-x-3 text-xs text-muted-foreground ml-auto">
        <span>{staff.completed} done</span>
        <span>{staff.inProgress} in progress</span>
        {staff.overdue > 0 && <span className="text-destructive font-medium">{staff.overdue} overdue</span>}
      </div>
    </div>
  );
}


