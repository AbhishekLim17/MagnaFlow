// Finance: every project's budget, expenses and labour cost in the organisation (read, and
// recording expenses). No tasks. Created by org admins (Dept. Heads & Managers page).
import React from 'react';
import { DollarSign } from 'lucide-react';
import DashboardLayout from '@/components/shared/DashboardLayout';
import BudgetTracker from '@/components/admin/BudgetTracker';

const menuItems = [{ id: 'budget', label: 'Budget Tracker', icon: DollarSign }];

const FinanceDashboard = () => (
  <DashboardLayout subtitle="Finance" menuItems={menuItems} activeTab="budget" onTabChange={() => {}} title="Budget Tracker">
    <BudgetTracker />
  </DashboardLayout>
);

export default FinanceDashboard;
