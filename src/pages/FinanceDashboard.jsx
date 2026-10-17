// Finance: every project's budget, expenses and labour cost in the organisation (read, and
// recording expenses), and client invoices, as far as those features are on. No tasks.
// Created by org admins (Dept. Heads & Managers page).
import React, { useState } from 'react';
import { DollarSign, FileText, Puzzle } from 'lucide-react';
import DashboardLayout from '@/components/shared/DashboardLayout';
import BudgetTracker from '@/components/admin/BudgetTracker';
import InvoicesPage from '@/components/admin/InvoicesPage';
import FeaturesPage from '@/components/shared/FeaturesPage';
import FeatureGate from '@/components/shared/FeatureGate';
import { useFeatures } from '@/contexts/FeaturesContext';
import { MENU_FEATURE } from '@/lib/features';

const menuItems = [
  { id: 'budget', label: 'Budget Tracker', icon: DollarSign },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'features', label: 'Features', icon: Puzzle },
];
const PAGES = { budget: BudgetTracker, invoices: InvoicesPage, features: FeaturesPage };

const FinanceDashboard = () => {
  const [tab, setTab] = useState('budget');
  const { menu } = useFeatures();
  return (
    <DashboardLayout subtitle="Finance" menuItems={menu(menuItems)} activeTab={tab} onTabChange={setTab} title={menuItems.find((m) => m.id === tab).label}>
      <FeatureGate feature={MENU_FEATURE[tab]}>{React.createElement(PAGES[tab])}</FeatureGate>
    </DashboardLayout>
  );
};

export default FinanceDashboard;
