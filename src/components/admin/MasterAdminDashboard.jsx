// Master Admin Dashboard - Global org provisioning, suspension, live usage,
// and audit log. Operates above any single organization.
// Note: user impersonation is intentionally absent — it requires the Firebase
// Admin SDK (custom tokens), which needs Cloud Functions / the Blaze plan.

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Plus,
  Ban,
  Play,
  Pencil,
  Trash2,
  ScrollText,
  AlertTriangle,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/shared/DashboardLayout';
import { EmptyState, LoadingState } from '@/components/shared/States';
import {
  getAllOrganizations,
  generateOrgId,
  provisionOrganization,
  updateOrganization,
  deleteOrganization,
  getOrgMemberCount,
  suspendOrganization,
  reactivateOrganization,
  computeOrgUsage,
  getAuditLogs,
} from '@/services/organizationService';
import { createUser } from '@/services/userService';
import { getErrorLogs } from '@/services/errorLogService';

const EditOrgDialog = ({ open, onOpenChange, org, onSaved }) => {
  const [form, setForm] = useState({ name: '', plan: 'trial', seatLimit: 10, storageQuotaMB: 1000, billingEmail: '' });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (org) {
      setForm({
        name: org.name || '',
        plan: org.plan || 'trial',
        seatLimit: org.seatLimit ?? 10,
        storageQuotaMB: org.storageQuotaMB ?? 1000,
        billingEmail: org.billingEmail || '',
      });
    }
  }, [org]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      await updateOrganization(org.id, {
        name: form.name,
        plan: form.plan,
        seatLimit: Number(form.seatLimit) || 1,
        storageQuotaMB: Number(form.storageQuotaMB) || 0,
        billingEmail: form.billingEmail,
      });
      toast({ title: 'Organization updated', description: `${form.name} has been saved.` });
      onOpenChange(false);
      onSaved();
    } catch (error) {
      console.error('Error updating organization:', error);
      toast({ title: 'Failed to update', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-effect border-white/20 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Pencil className="w-5 h-5" /> Edit Organization
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label className="text-gray-200">Organization Name *</Label>
            <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="mt-2 glass-effect border-white/20 text-white" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-200">Plan</Label>
              <Select value={form.plan} onValueChange={(v) => setForm((p) => ({ ...p, plan: v }))}>
                <SelectTrigger className="mt-2 glass-effect border-white/20 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-200">Seat Limit</Label>
              <Input type="number" min="1" value={form.seatLimit} onChange={(e) => setForm((p) => ({ ...p, seatLimit: e.target.value }))}
                className="mt-2 glass-effect border-white/20 text-white" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-200">Storage (MB)</Label>
              <Input type="number" min="0" value={form.storageQuotaMB} onChange={(e) => setForm((p) => ({ ...p, storageQuotaMB: e.target.value }))}
                className="mt-2 glass-effect border-white/20 text-white" />
            </div>
            <div>
              <Label className="text-gray-200">Billing Email</Label>
              <Input type="email" value={form.billingEmail} onChange={(e) => setForm((p) => ({ ...p, billingEmail: e.target.value }))}
                className="mt-2 glass-effect border-white/20 text-white" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ProvisionOrgDialog = ({ open, onOpenChange, onCreated }) => {
  const [form, setForm] = useState({
    name: '', plan: 'trial', seatLimit: 10, storageQuotaMB: 1000, billingEmail: '', ccEmails: '',
    adminName: '', adminEmail: '', adminPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.adminName.trim() || !form.adminEmail.trim() || !form.adminPassword) return;

    setLoading(true);
    try {
      // Create the org-admin account FIRST (most likely failure point — email
      // already in use, weak password). Only write the organization doc if
      // that succeeds, so a failed attempt never leaves an orphaned org with
      // no admin.
      const orgId = generateOrgId();
      await createUser({
        name: form.adminName,
        email: form.adminEmail,
        password: form.adminPassword,
        role: 'org-admin',
        designation: 'Organization Admin',
        orgId,
      });

      await provisionOrganization(orgId, {
        name: form.name,
        plan: form.plan,
        seatLimit: Number(form.seatLimit) || 10,
        storageQuotaMB: Number(form.storageQuotaMB) || 1000,
        billingEmail: form.billingEmail,
        ccEmails: form.ccEmails ? form.ccEmails.split(',').map(s => s.trim()).filter(Boolean) : [],
      });

      toast({ title: 'Organization provisioned', description: `${form.name} is live with ${form.adminName} as its org-admin.` });
      setForm({ name: '', plan: 'trial', seatLimit: 10, storageQuotaMB: 1000, billingEmail: '', ccEmails: '', adminName: '', adminEmail: '', adminPassword: '' });
      onOpenChange(false);
      onCreated();
    } catch (error) {
      console.error('Error provisioning organization:', error);
      toast({ title: 'Failed to provision organization', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-effect border-white/20 text-white max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Building2 className="w-5 h-5" /> Provision New Organization
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label className="text-gray-200">Organization Name *</Label>
            <Input value={form.name} onChange={(e) => handleChange('name', e.target.value)}
              className="mt-2 glass-effect border-white/20 text-white" placeholder="Acme Inc." required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-200">Plan</Label>
              <Select value={form.plan} onValueChange={(v) => handleChange('plan', v)}>
                <SelectTrigger className="mt-2 glass-effect border-white/20 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-200">Seat Limit</Label>
              <Input type="number" min="1" value={form.seatLimit} onChange={(e) => handleChange('seatLimit', e.target.value)}
                className="mt-2 glass-effect border-white/20 text-white" />
            </div>
          </div>
          <div>
            <Label className="text-gray-200">Billing Email</Label>
            <Input type="email" value={form.billingEmail} onChange={(e) => handleChange('billingEmail', e.target.value)}
              className="mt-2 glass-effect border-white/20 text-white" placeholder="billing@acme.com" />
          </div>
          <hr className="border-white/10" />
          <p className="text-sm text-gray-300">First Org-Admin Account</p>
          <div>
            <Label className="text-gray-200">Name *</Label>
            <Input value={form.adminName} onChange={(e) => handleChange('adminName', e.target.value)}
              className="mt-2 glass-effect border-white/20 text-white" required />
          </div>
          <div>
            <Label className="text-gray-200">Email *</Label>
            <Input type="email" value={form.adminEmail} onChange={(e) => handleChange('adminEmail', e.target.value)}
              className="mt-2 glass-effect border-white/20 text-white" required />
          </div>
          <div>
            <Label className="text-gray-200">Password *</Label>
            <Input type="password" minLength={6} value={form.adminPassword} onChange={(e) => handleChange('adminPassword', e.target.value)}
              className="mt-2 glass-effect border-white/20 text-white" required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
              {loading ? 'Provisioning...' : 'Provision Organization'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const MasterAdminDashboard = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState([]);
  const [usageStats, setUsageStats] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const [errorLogs, setErrorLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [editOrg, setEditOrg] = useState(null);
  const [activeTab, setActiveTab] = useState('organizations');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [orgs, logs, errors] = await Promise.all([
        getAllOrganizations(),
        getAuditLogs(),
        getErrorLogs(),
      ]);
      setOrganizations(orgs);
      setAuditLogs(logs);
      setErrorLogs(errors);

      // Compute usage live (no scheduled function on the Spark plan).
      const statsEntries = await Promise.all(
        orgs.map(async (org) => {
          try { return [org.id, await computeOrgUsage(org.id)]; }
          catch { return [org.id, null]; }
        })
      );
      setUsageStats(Object.fromEntries(statsEntries));
    } catch (error) {
      console.error('Error loading master admin data:', error);
      toast({ title: 'Error loading data', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (org) => {
    if (!window.confirm(`Suspend "${org.name}"? Its org-admin and staff will be blocked at login.`)) return;
    try {
      await suspendOrganization(org.id);
      toast({ title: 'Organization suspended', description: `${org.name} has been suspended.` });
      loadAll();
    } catch (error) {
      console.error('Error suspending organization:', error);
      toast({ title: 'Failed to suspend', description: error.message, variant: 'destructive' });
    }
  };

  const handleReactivate = async (org) => {
    try {
      await reactivateOrganization(org.id);
      toast({ title: 'Organization reactivated', description: `${org.name} is active again.` });
      loadAll();
    } catch (error) {
      console.error('Error reactivating organization:', error);
      toast({ title: 'Failed to reactivate', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (org) => {
    try {
      const memberCount = await getOrgMemberCount(org.id);
      if (memberCount > 0) {
        toast({
          title: 'Cannot delete organization',
          description: `${org.name} still has ${memberCount} member(s). Remove or reassign them first.`,
          variant: 'destructive',
        });
        return;
      }
      if (!window.confirm(`Permanently delete "${org.name}"? This cannot be undone.`)) return;
      await deleteOrganization(org.id);
      toast({ title: 'Organization deleted', description: `${org.name} has been removed.` });
      loadAll();
    } catch (error) {
      console.error('Error deleting organization:', error);
      toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' });
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  // Map an org id to its name for the audit log; orgs deleted since the entry
  // was written won't be found, so show a friendly label instead of a raw id.
  const orgName = (id) => organizations.find((o) => o.id === id)?.name || 'a deleted org';

  const menuItems = [
    { id: 'organizations', label: 'Organizations', icon: Building2 },
    { id: 'audit', label: 'Audit Logs', icon: ScrollText },
    { id: 'errors', label: 'Error Logs', icon: AlertTriangle },
  ];

  const headerActions = (
    <Button
      onClick={() => setIsProvisionOpen(true)}
      className="bg-indigo-600 hover:bg-indigo-700 text-white"
      size="sm"
    >
      <Plus className="w-4 h-4 sm:mr-2" />
      <span className="hidden sm:inline">Provision Organization</span>
    </Button>
  );

  return (
    <DashboardLayout
      subtitle="Master Panel"
      menuItems={menuItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      title={menuItems.find((m) => m.id === activeTab)?.label || 'Master Admin'}
      headerActions={headerActions}
    >
      {loading ? (
        <LoadingState label="Loading organizations..." size="large" />
      ) : (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {/* Organizations */}
        <Card className={`glass-effect p-6 mb-6 ${activeTab === 'organizations' ? '' : 'hidden'}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Building2 className="text-purple-300" /> Organizations ({organizations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {organizations.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No organizations yet. Provision the first one above.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {organizations.map((org) => {
                  const stats = usageStats[org.id];
                  return (
                    <div key={org.id} className="p-4 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-white">{org.name}</h3>
                          <p className="text-xs text-gray-400 capitalize">{org.plan} · {org.status}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-blue-400 hover:bg-blue-500/20"
                            onClick={() => setEditOrg(org)}
                            title="Edit organization"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {org.status === 'suspended' ? (
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8 text-green-400 hover:bg-green-500/20"
                              onClick={() => handleReactivate(org)}
                              title="Reactivate organization"
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8 text-amber-400 hover:bg-amber-500/20"
                              onClick={() => handleSuspend(org)}
                              title="Suspend organization"
                            >
                              <Ban className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-red-400 hover:bg-red-500/20"
                            onClick={() => handleDelete(org)}
                            title="Delete organization"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-gray-300 space-y-1">
                        <div>Seat limit: {org.seatLimit}</div>
                        {stats ? (
                          <>
                            <div>Users: {stats.activeUserCount}</div>
                            <div>Tasks: {stats.taskCount}</div>
                          </>
                        ) : (
                          <div className="text-gray-500">Usage unavailable</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit Logs */}
        <Card className={`glass-effect p-6 ${activeTab === 'audit' ? '' : 'hidden'}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <ScrollText className="text-purple-300" /> Audit Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <EmptyState icon={ScrollText} title="No audit log entries yet." />
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auditLogs.map((log) => (
                  <div key={log.id} className="text-sm text-gray-300 p-2 rounded bg-white/5 border border-white/10 flex justify-between">
                    <span>
                      <span className="text-white font-medium">{log.action}</span>
                      {log.targetOrgId && ` · ${orgName(log.targetOrgId)}`}
                      {log.targetUserId && ` · user ${log.targetUserId}`}
                    </span>
                    <span className="text-gray-500">
                      {log.timestamp?.toDate ? new Date(log.timestamp.toDate()).toLocaleString() : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Logs — unhandled UI errors reported by the ErrorBoundary. */}
        <Card className={`glass-effect p-6 ${activeTab === 'errors' ? '' : 'hidden'}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <AlertTriangle className="text-purple-300" /> Error Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {errorLogs.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title="No errors reported."
                hint="Crashes in any user's browser are recorded here automatically."
              />
            ) : (
              <div className="space-y-2 max-h-[32rem] overflow-y-auto">
                {errorLogs.map((log) => (
                  <div key={log.id} className="text-sm p-3 rounded bg-white/5 border border-white/10">
                    <div className="flex justify-between gap-3">
                      <span className="text-red-300 font-medium break-all">{log.message}</span>
                      <span className="text-gray-500 flex-shrink-0">
                        {log.createdAt?.toDate ? new Date(log.createdAt.toDate()).toLocaleString() : ''}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1 break-all">
                      {log.userEmail || 'signed-out user'}
                      {log.url && ` · ${log.url}`}
                    </div>
                    {log.stack && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer">Stack trace</summary>
                        <pre className="text-[11px] text-gray-400 mt-1 whitespace-pre-wrap break-all">{log.stack}</pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
      )}

      <ProvisionOrgDialog open={isProvisionOpen} onOpenChange={setIsProvisionOpen} onCreated={loadAll} />
      <EditOrgDialog open={!!editOrg} onOpenChange={(v) => !v && setEditOrg(null)} org={editOrg} onSaved={loadAll} />
    </DashboardLayout>
  );
};

export default MasterAdminDashboard;
