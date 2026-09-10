import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Plus,
  Trash2,
  Edit3,
  Download,
  ChevronDown,
  PiggyBank,
  BarChart3,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getProjects } from '@/services/organizationService';
import {
  getExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  computeBudgetSummary,
  updateProjectBudget,
} from '@/services/budgetService';
import { reportError } from '@/lib/reportError';

// ─── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'labor', label: 'Labor', color: '#6366f1' },
  { value: 'materials', label: 'Materials', color: '#f59e0b' },
  { value: 'tools', label: 'Tools & Software', color: '#10b981' },
  { value: 'travel', label: 'Travel', color: '#3b82f6' },
  { value: 'other', label: 'Other', color: '#8b5cf6' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'SGD'];

const catColor = (cat) => CATEGORIES.find((c) => c.value === cat)?.color ?? '#8b5cf6';
const catLabel = (cat) => CATEGORIES.find((c) => c.value === cat)?.label ?? cat;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (amount, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    amount ?? 0
  );

const pctColor = (pct) => {
  if (pct == null) return 'text-muted-foreground';
  if (pct >= 100) return 'text-destructive';
  if (pct >= 80) return 'text-amber-500';
  return 'text-emerald-500';
};

const progressColor = (pct) => {
  if (pct == null) return '';
  if (pct >= 100) return '[&>div]:bg-destructive';
  if (pct >= 80) return '[&>div]:bg-amber-500';
  return '[&>div]:bg-emerald-500';
};

// ─── StatCard ─────────────────────────────────────────────────────────────────

const BudgetStat = ({ label, value, icon: Icon, highlight }) => (
  <div
    className={`flex flex-col gap-2 rounded-2xl border p-5 ${
      highlight ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-card'
    }`}
  >
    <div className="flex items-center gap-2 text-muted-foreground text-sm">
      <Icon className="w-4 h-4" />
      {label}
    </div>
    <p className={`text-2xl font-bold ${highlight ? 'text-destructive' : 'text-foreground'}`}>
      {value}
    </p>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const BudgetTracker = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Projects & selection
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);

  // Expenses & summary
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({ spent: 0, budget: 0, remaining: null, pctUsed: null, byCategory: {} });
  const [loading, setLoading] = useState(false);

  // Dialogs
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, expense: null });
  const [editDialog, setEditDialog] = useState({ open: false, expense: null });

  // Forms
  const emptyExpense = { amount: '', description: '', category: 'labor', date: new Date().toISOString().split('T')[0] };
  const [expenseForm, setExpenseForm] = useState(emptyExpense);
  const [budgetForm, setBudgetForm] = useState({ budget: '', currency: 'USD', budgetNotes: '' });

  // ── Load projects ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.orgId) return;
    getProjects(user.orgId)
      .then((ps) => {
        const active = ps.filter((p) => p.status !== 'archived');
        setProjects(active);
        if (active.length > 0 && !selectedProject) setSelectedProject(active[0]);
      })
      .catch((err) => reportError(err, { title: 'Failed to load projects' }));
  }, [user?.orgId]);

  // ── Load expenses when project changes ────────────────────────────────────

  const loadExpenses = useCallback(async () => {
    if (!user?.orgId || !selectedProject?.id) return;
    setLoading(true);
    try {
      const exps = await getExpenses(user.orgId, selectedProject.id);
      setExpenses(exps);
      setSummary(computeBudgetSummary(exps, selectedProject.budget || 0));
    } catch (err) {
      reportError(err, { title: 'Failed to load expenses' });
    } finally {
      setLoading(false);
    }
  }, [user?.orgId, selectedProject]);

  useEffect(() => {
    loadExpenses();
    if (selectedProject) {
      setBudgetForm({
        budget: selectedProject.budget || '',
        currency: selectedProject.currency || 'USD',
        budgetNotes: selectedProject.budgetNotes || '',
      });
    }
  }, [selectedProject, loadExpenses]);

  // ── Expense CRUD ──────────────────────────────────────────────────────────

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.amount || !expenseForm.description.trim()) return;
    try {
      await addExpense(user.orgId, selectedProject.id, {
        ...expenseForm,
        addedByName: user.name || user.email,
      });
      toast({ title: 'Expense added' });
      setExpenseForm(emptyExpense);
      setExpenseDialogOpen(false);
      loadExpenses();
    } catch (err) {
      reportError(err, { title: 'Failed to add expense' });
    }
  };

  const handleEditExpense = async (e) => {
    e.preventDefault();
    const { expense } = editDialog;
    if (!expense) return;
    try {
      await updateExpense(user.orgId, selectedProject.id, expense.id, {
        amount: Number(expenseForm.amount),
        description: expenseForm.description,
        category: expenseForm.category,
        date: expenseForm.date,
      });
      toast({ title: 'Expense updated' });
      setEditDialog({ open: false, expense: null });
      loadExpenses();
    } catch (err) {
      reportError(err, { title: 'Failed to update expense' });
    }
  };

  const openEditDialog = (expense) => {
    setExpenseForm({
      amount: expense.amount,
      description: expense.description,
      category: expense.category,
      date: expense.date,
    });
    setEditDialog({ open: true, expense });
  };

  const handleDeleteExpense = async () => {
    const { expense } = deleteDialog;
    if (!expense) return;
    try {
      await deleteExpense(user.orgId, selectedProject.id, expense.id);
      toast({ title: 'Expense removed' });
      setDeleteDialog({ open: false, expense: null });
      loadExpenses();
    } catch (err) {
      reportError(err, { title: 'Failed to delete expense' });
    }
  };

  // ── Budget update ─────────────────────────────────────────────────────────

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    try {
      await updateProjectBudget(user.orgId, selectedProject.id, budgetForm);
      // Optimistically update local project list
      setProjects((prev) =>
        prev.map((p) =>
          p.id === selectedProject.id
            ? { ...p, budget: Number(budgetForm.budget) || 0, currency: budgetForm.currency, budgetNotes: budgetForm.budgetNotes }
            : p
        )
      );
      setSelectedProject((prev) => ({
        ...prev,
        budget: Number(budgetForm.budget) || 0,
        currency: budgetForm.currency,
        budgetNotes: budgetForm.budgetNotes,
      }));
      toast({ title: 'Budget saved' });
      setBudgetDialogOpen(false);
    } catch (err) {
      reportError(err, { title: 'Failed to save budget' });
    }
  };

  // ── CSV export ────────────────────────────────────────────────────────────

  const exportCSV = () => {
    const currency = selectedProject?.currency || 'USD';
    const header = ['Date', 'Description', 'Category', 'Amount (' + currency + ')', 'Added By'];
    const rows = expenses.map((e) => [
      e.date,
      `"${e.description.replace(/"/g, '""')}"`,
      catLabel(e.category),
      e.amount,
      e.addedByName || '',
    ]);
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedProject?.name ?? 'project'}_expenses.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Charts data ───────────────────────────────────────────────────────────

  const pieData = selectedProject?.budget > 0
    ? [
        { name: 'Spent', value: summary.spent, color: summary.pctUsed >= 100 ? '#ef4444' : '#6366f1' },
        {
          name: 'Remaining',
          value: Math.max(0, summary.remaining ?? 0),
          color: '#e5e7eb',
        },
      ]
    : [{ name: 'Spent', value: summary.spent || 0, color: '#6366f1' }];

  const barData = CATEGORIES.map((cat) => ({
    name: cat.label,
    amount: summary.byCategory[cat.value] || 0,
    fill: cat.color,
  })).filter((d) => d.amount > 0);

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (!user?.orgId) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>No organization linked. Contact your master admin.</p>
      </div>
    );
  }

  const currency = selectedProject?.currency || 'USD';
  const isOverBudget = summary.pctUsed != null && summary.pctUsed >= 100;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-muted-foreground text-sm">Track budget allocation and actual spend per project.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Project selector */}
          <Select
            value={selectedProject?.id ?? ''}
            onValueChange={(id) => setSelectedProject(projects.find((p) => p.id === id) ?? null)}
          >
            <SelectTrigger className="w-56 bg-muted border-border" id="budget-project-selector">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBudgetDialogOpen(true)}
            disabled={!selectedProject}
            id="btn-set-budget"
          >
            <PiggyBank className="w-4 h-4 mr-2" />
            {selectedProject?.budget > 0 ? 'Edit Budget' : 'Set Budget'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            disabled={!selectedProject || expenses.length === 0}
            id="btn-export-csv"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button
            size="sm"
            onClick={() => { setExpenseForm(emptyExpense); setExpenseDialogOpen(true); }}
            disabled={!selectedProject}
            id="btn-add-expense"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* No project state */}
      {!selectedProject && (
        <Card className="p-12 text-center text-muted-foreground">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No projects found.</p>
          <p className="text-sm mt-1">Create a project in Departments &amp; Projects first.</p>
        </Card>
      )}

      {selectedProject && (
        <>
          {/* Over-budget warning */}
          <AnimatePresence>
            {isOverBudget && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/8 p-4"
              >
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                <p className="text-sm text-destructive font-medium">
                  Budget exceeded — {fmt(summary.spent - summary.budget, currency)} over the{' '}
                  {fmt(summary.budget, currency)} allocation.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Summary stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <BudgetStat
              label="Budget"
              value={selectedProject.budget > 0 ? fmt(selectedProject.budget, currency) : 'Not set'}
              icon={PiggyBank}
            />
            <BudgetStat
              label="Spent"
              value={fmt(summary.spent, currency)}
              icon={TrendingUp}
              highlight={isOverBudget}
            />
            <BudgetStat
              label="Remaining"
              value={summary.remaining != null ? fmt(summary.remaining, currency) : '—'}
              icon={TrendingDown}
              highlight={isOverBudget}
            />
            <BudgetStat
              label="Utilisation"
              value={summary.pctUsed != null ? `${summary.pctUsed.toFixed(1)}%` : '—'}
              icon={CheckCircle2}
              highlight={isOverBudget}
            />
          </div>

          {/* Progress bar */}
          {selectedProject.budget > 0 && (
            <div className="space-y-1">
              <Progress
                value={Math.min(summary.pctUsed ?? 0, 100)}
                className={`h-3 rounded-full bg-muted ${progressColor(summary.pctUsed)}`}
              />
              <p className={`text-xs font-medium ${pctColor(summary.pctUsed)}`}>
                {(summary.pctUsed ?? 0).toFixed(1)}% of budget used
              </p>
            </div>
          )}

          {/* Charts */}
          {expenses.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Donut */}
              <Card className="p-6">
                <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wide">
                  Budget vs. Actual
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartTooltip
                      formatter={(val) => fmt(val, currency)}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-6 mt-2">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="w-3 h-3 rounded-full inline-block" style={{ background: d.color }} />
                      {d.name}: {fmt(d.value, currency)}
                    </div>
                  ))}
                </div>
              </Card>

              {/* Bar by category */}
              <Card className="p-6">
                <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wide">
                  Spend by Category
                </h3>
                {barData.length === 0 ? (
                  <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
                    No data yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={barData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v, currency)} width={70} />
                      <RechartTooltip formatter={(val) => fmt(val, currency)} />
                      <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                        {barData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </div>
          )}

          {/* Expense table */}
          <Card className="overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">
                Expense Log
                <Badge variant="secondary" className="ml-2">
                  {expenses.length}
                </Badge>
              </h3>
            </div>
            {loading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
            ) : expenses.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No expenses logged yet.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => { setExpenseForm(emptyExpense); setExpenseDialogOpen(true); }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add first expense
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-3 px-6 font-medium">Date</th>
                      <th className="text-left py-3 px-4 font-medium">Description</th>
                      <th className="text-left py-3 px-4 font-medium">Category</th>
                      <th className="text-right py-3 px-4 font-medium">Amount</th>
                      <th className="text-left py-3 px-4 font-medium">Logged By</th>
                      <th className="py-3 px-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((exp, i) => (
                      <motion.tr
                        key={exp.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-border/50 hover:bg-muted/40 transition-colors"
                      >
                        <td className="py-3 px-6 text-muted-foreground whitespace-nowrap">{exp.date}</td>
                        <td className="py-3 px-4 max-w-xs truncate">{exp.description}</td>
                        <td className="py-3 px-4">
                          <Badge
                            variant="secondary"
                            style={{ background: catColor(exp.category) + '22', color: catColor(exp.category) }}
                          >
                            {catLabel(exp.category)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium">
                          {fmt(exp.amount, currency)}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-xs">{exp.addedByName}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => openEditDialog(exp)}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteDialog({ open: true, expense: exp })}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50">
                      <td colSpan={3} className="py-3 px-6 font-semibold text-right text-sm">Total</td>
                      <td className="py-3 px-4 text-right font-mono font-bold">{fmt(summary.spent, currency)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ── Add Expense Dialog ── */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddExpense} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="exp-amount">Amount *</Label>
                <Input
                  id="exp-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                  className="mt-1 bg-muted border-border"
                  required
                />
              </div>
              <div>
                <Label htmlFor="exp-date">Date *</Label>
                <Input
                  id="exp-date"
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, date: e.target.value }))}
                  className="mt-1 bg-muted border-border"
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="exp-desc">Description *</Label>
              <Input
                id="exp-desc"
                placeholder="What was this expense for?"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))}
                className="mt-1 bg-muted border-border"
                required
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={expenseForm.category}
                onValueChange={(v) => setExpenseForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger className="mt-1 bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setExpenseDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" id="btn-save-expense">Save Expense</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Expense Dialog ── */}
      <Dialog open={editDialog.open} onOpenChange={(o) => setEditDialog({ open: o, expense: null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditExpense} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-exp-amount">Amount *</Label>
                <Input
                  id="edit-exp-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                  className="mt-1 bg-muted border-border"
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-exp-date">Date *</Label>
                <Input
                  id="edit-exp-date"
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, date: e.target.value }))}
                  className="mt-1 bg-muted border-border"
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-exp-desc">Description *</Label>
              <Input
                id="edit-exp-desc"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))}
                className="mt-1 bg-muted border-border"
                required
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={expenseForm.category}
                onValueChange={(v) => setExpenseForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger className="mt-1 bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialog({ open: false, expense: null })}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Set Budget Dialog ── */}
      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedProject?.budget > 0 ? 'Edit' : 'Set'} Budget — {selectedProject?.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveBudget} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="budget-amount">Budget Amount *</Label>
                <Input
                  id="budget-amount"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="50000"
                  value={budgetForm.budget}
                  onChange={(e) => setBudgetForm((f) => ({ ...f, budget: e.target.value }))}
                  className="mt-1 bg-muted border-border"
                  required
                />
              </div>
              <div>
                <Label>Currency</Label>
                <Select
                  value={budgetForm.currency}
                  onValueChange={(v) => setBudgetForm((f) => ({ ...f, currency: v }))}
                >
                  <SelectTrigger className="mt-1 bg-muted border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="budget-notes">Notes (optional)</Label>
              <Textarea
                id="budget-notes"
                placeholder="e.g. includes sub-contractor fees"
                value={budgetForm.budgetNotes}
                onChange={(e) => setBudgetForm((f) => ({ ...f, budgetNotes: e.target.value }))}
                className="mt-1 bg-muted border-border"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBudgetDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" id="btn-confirm-budget">Save Budget</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(o) => setDeleteDialog({ open: o, expense: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{' '}
              <strong>{fmt(deleteDialog.expense?.amount, currency)}</strong> logged for "
              {deleteDialog.expense?.description}". This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteExpense}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default BudgetTracker;
