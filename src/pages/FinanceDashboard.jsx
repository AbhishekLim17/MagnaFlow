// Finance: every project's budget, expenses and labour cost in the organisation (read, and
// recording expenses), and client invoices. No tasks. Created by org admins (Dept. Heads & Managers page).
import React, { useState } from 'react';
import { DollarSign, FileText } from 'lucide-react';
import DashboardLayout from '@/components/shared/DashboardLayout';
import BudgetTracker from '@/components/admin/BudgetTracker';
import InvoicesPage from '@/components/admin/InvoicesPage';

const menuItems = [
  { id: 'budget', label: 'Budget Tracker', icon: DollarSign },
  { id: 'invoices', label: 'Invoices', icon: FileText },
];

const FinanceDashboard = () => {
  const [tab, setTab] = useState('budget');
  return (
    <DashboardLayout subtitle="Finance" menuItems={menuItems} activeTab={tab} onTabChange={setTab} title={menuItems.find((m) => m.id === tab).label}>
      {tab === 'budget' ? <BudgetTracker /> : <InvoicesPage />}
    </DashboardLayout>
  );
};

export default FinanceDashboard;
