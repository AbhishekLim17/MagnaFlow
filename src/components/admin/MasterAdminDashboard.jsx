// Master Admin Dashboard - Global org provisioning, suspension, live usage,
// and audit log. Operates above any single organization.
// Note: user impersonation is intentionally absent — it requires the Firebase
// Admin SDK (custom tokens), which needs Cloud Functions / the Blaze plan.

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, Plus, Ban, Play, Pencil, Trash2, ScrollText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import DashboardLayout from '@/components/shared/DashboardLayout';
import { EmptyState, LoadingState } from '@/components/shared/States';
import { getAllOrganizations, generateOrgId, provisionOrganization, updateOrganization, deleteOrganization, getOrgMemberCount, suspendOrganization, reactivateOrganization, computeOrgUsage, getAuditLogs } from '@/services/organizationService';
import { createUser } from '@/services/userService';
import { getErrorLogs } from '@/services/errorLogService';
import { reportError } from '@/lib/reportError';

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
      reportError(error, { title: 'Failed to update' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Pencil className="w-5 h-5" /> Edit Organization
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label className="text-foreground">Organization Name *</Label>
            <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="mt-2 surface border-border text-foreground" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-foreground">Plan</Label>
              <Select value={form.plan} onValueChange={(v) => setForm((p) => ({ ...p, plan: v }))}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-foreground">Seat Limit</Label>
              <Input type="number" min="1" value={form.seatLimit} onChange={(e) => setForm((p) => ({ ...p, seatLimit: e.target.value }))}
                className="mt-2 surface border-border text-foreground" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-foreground">Storage (MB)</Label>
              <Input type="number" min="0" value={form.storageQuotaMB} onChange={(e) => setForm((p) => ({ ...p, storageQuotaMB: e.target.value }))}
                className="mt-2 surface border-border text-foreground" />
            </div>
            <div>
              <Label className="text-foreground">Billing Email</Label>
              <Input type="email" value={form.billingEmail} onChange={(e) => setForm((p) => ({ ...p, billingEmail: e.target.value }))}
                className="mt-2 surface border-border text-foreground" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>
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
      reportError(error, { title: 'Failed to provision organization' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Building2 className="w-5 h-5" /> Provision New Organization
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label className="text-foreground">Organization Name *</Label>
            <Input value={form.name} onChange={(e) => handleChange('name', e.target.value)}
              className="mt-2 surface border-border text-foreground" placeholder="Acme Inc." required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-foreground">Plan</Label>
              <Select value={form.plan} onValueChange={(v) => handleChange('plan', v)}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-foreground">Seat Limit</Label>
              <Input type="number" min="1" value={form.seatLimit} onChange={(e) => handleChange('seatLimit', e.target.value)}
                className="mt-2 surface border-border text-foreground" />
            </div>
          </div>
          <div>
            <Label className="text-foreground">Billing Email</Label>
            <Input type="email" value={form.billingEmail} onChange={(e) => handleChange('billingEmail', e.target.value)}
              className="mt-2 surface border-border text-foreground" placeholder="billing@acme.com" />
          </div>
          <hr className="border-border" />
          <p className="text-sm text-muted-foreground">First Org-Admin Account</p>
          <div>
            <Label className="text-foreground">Name *</Label>
            <Input value={form.adminName} onChange={(e) => handleChange('adminName', e.target.value)}
              className="mt-2 surface border-border text-foreground" required />
          </div>
          <div>
            <Label className="text-foreground">Email *</Label>
            <Input type="email" value={form.adminEmail} onChange={(e) => handleChange('adminEmail', e.target.value)}
              className="mt-2 surface border-border text-foreground" required />
          </div>
          <div>
            <Label className="text-foreground">Password *</Label>
            <Input type="password" minLength={6} value={form.adminPassword} onChange={(e) => handleChange('adminPassword', e.target.value)}
              className="mt-2 surface border-border text-foreground" required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Provisioning...' : 'Provision Organization'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const MasterAdminDashboard = () => {
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
      reportError(error, { title: 'Error loading data' });
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
      reportError(error, { title: 'Failed to suspend' });
    }
  };

  const handleReactivate = async (org) => {
    try {
      await reactivateOrganization(org.id);
      toast({ title: 'Organization reactivated', description: `${org.name} is active again.` });
      loadAll();
    } catch (error) {
      reportError(error, { title: 'Failed to reactivate' });
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
      reportError(error, { title: 'Failed to delete' });
    }
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
        <Card className={`surface p-6 mb-6 ${activeTab === 'organizations' ? '' : 'hidden'}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Building2 className="text-primary" /> Organizations ({organizations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {organizations.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No organizations yet. Provision the first one above.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {organizations.map((org) => {
                  const stats = usageStats[org.id];
                  return (
                    <div key={org.id} className="p-4 rounded-xl bg-muted/60 border border-border">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground">{org.name}</h3>
                          <p className="text-xs text-muted-foreground capitalize">{org.plan} · {org.status}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-primary hover:bg-primary-soft"
                            onClick={() => setEditOrg(org)}
                            title="Edit organization"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {org.status === 'suspended' ? (
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8 text-success hover:bg-success-soft"
                              onClick={() => handleReactivate(org)}
                              title="Reactivate organization"
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8 text-warning hover:bg-warning-soft"
                              onClick={() => handleSuspend(org)}
                              title="Suspend organization"
                            >
                              <Ban className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive-soft"
                            onClick={() => handleDelete(org)}
                            title="Delete organization"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-muted-foreground space-y-1">
                        <div>Seat limit: {org.seatLimit}</div>
                        {stats ? (
                          <>
                            <div>Users: {stats.activeUserCount}</div>
                            <div>Tasks: {stats.taskCount}</div>
                          </>
                        ) : (
                          <div className="text-muted-foreground">Usage unavailable</div>
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
        <Card className={`surface p-6 ${activeTab === 'audit' ? '' : 'hidden'}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <ScrollText className="text-primary" /> Audit Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <EmptyState icon={ScrollText} title="No audit log entries yet." />
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex flex-wrap justify-between gap-x-3 gap-y-1 rounded-xl border border-border bg-muted/60 p-2 text-sm text-muted-foreground">
                    <span>
                      <span className="text-foreground font-medium">{log.action}</span>
                      {log.targetOrgId && ` · ${orgName(log.targetOrgId)}`}
                      {log.targetUserId && <span className="break-all"> · user {log.targetUserId}</span>}
                    </span>
                    <span className="text-muted-foreground">
                      {log.timestamp?.toDate ? new Date(log.timestamp.toDate()).toLocaleString() : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Logs — unhandled UI errors reported by the ErrorBoundary. */}
        <Card className={`surface p-6 ${activeTab === 'errors' ? '' : 'hidden'}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="text-primary" /> Error Logs
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
                  <div key={log.id} className="text-sm p-3 rounded bg-muted/60 border border-border">
                    <div className="flex justify-between gap-3">
                      <span className="text-destructive font-medium break-all">{log.message}</span>
                      <span className="text-muted-foreground flex-shrink-0">
                        {log.createdAt?.toDate ? new Date(log.createdAt.toDate()).toLocaleString() : ''}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 break-all">
                      {log.userEmail || 'signed-out user'}
                      {log.url && ` · ${log.url}`}
                    </div>
                    {log.stack && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer">Stack trace</summary>
                        <pre className="text-[11px] text-muted-foreground mt-1 whitespace-pre-wrap break-all">{log.stack}</pre>
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
