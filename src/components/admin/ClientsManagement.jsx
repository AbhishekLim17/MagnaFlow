// ClientsManagement.jsx
// Org-Admin UI for managing client portal accounts.
// Clients are standard Firebase Auth + Firestore users with role="client".
// They are scoped to one or more projects via the standard projectIds array.
// The Org Admin creates/edits/deactivates/deletes them here.

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Plus, Search, Edit, Trash2, UserCheck, UserX, KeyRound,
  Globe, FolderOpen, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getProjects } from "@/services/organizationService";
import { reportError } from "@/lib/reportError";
import {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  activateUser,
  deactivateUser,
  resetUserPassword,
} from "@/services/userService";

// ─── helpers ─────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  projectIds: [],
};

const generateTempPassword = () => {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#";
  return Array.from({ length: 12 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
};

// ─── project picker sub-component (defined at module level) ───────────────────

const ProjectPicker = ({ projects, selectedIds, onToggle }) => (
  <div className="space-y-2">
    <Label>Projects this client can see *</Label>
    {projects.length === 0 ? (
      <p className="text-sm text-muted-foreground">
        No projects found. Create projects in Departments &amp; Projects first.
      </p>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-lg border p-2">
        {projects.map((p) => {
          const selected = selectedIds.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onToggle(p.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors ${
                selected
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/70"
              }`}
            >
              <FolderOpen className="w-4 h-4 shrink-0" />
              {p.name}
            </button>
          );
        })}
      </div>
    )}
  </div>
);

// ─── form dialog (defined at module level to prevent re-mounting on keystrokes) ─

const ClientFormDialog = ({
  open,
  onClose,
  onSubmit,
  title,
  description,
  isEdit,
  formData,
  setFormData,
  projects,
  toggleProject,
  saving,
}) => (
  <Dialog open={open} onOpenChange={onClose}>
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5" />
          {title}
        </DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {/* Name */}
        <div className="space-y-1">
          <Label htmlFor="client-name">Full Name *</Label>
          <Input
            id="client-name"
            placeholder="e.g. Priya Sharma"
            value={formData.name}
            onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
          />
        </div>

        {/* Email — read-only when editing */}
        <div className="space-y-1">
          <Label htmlFor="client-email">Email *</Label>
          <Input
            id="client-email"
            type="email"
            placeholder="client@company.com"
            value={formData.email}
            onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
            disabled={isEdit}
          />
          {isEdit && (
            <p className="text-xs text-muted-foreground">
              Email cannot be changed. Use &quot;Send Reset Email&quot; to update their password.
            </p>
          )}
        </div>

        {/* Project picker */}
        <ProjectPicker
          projects={projects}
          selectedIds={formData.projectIds}
          onToggle={toggleProject}
        />

        {!isEdit && (
          <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
            A temporary password will be created and a password-setup email will be sent to the client automatically.
          </p>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={onSubmit} disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Account"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

// ─── main component ──────────────────────────────────────────────────────────

const ClientsManagement = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // dialogs
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // ─── data loading ──────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!currentUser?.orgId) return;
    try {
      setLoading(true);
      const [allUsers, orgProjects] = await Promise.all([
        getAllUsers({ orgId: currentUser.orgId, role: "client" }),
        getProjects(currentUser.orgId),
      ]);
      setClients(allUsers.users ?? allUsers);
      setProjects(orgProjects);
    } catch (err) {
      reportError(err, { context: "ClientsManagement.loadData" });
      toast({ title: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [currentUser?.orgId, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── helpers ───────────────────────────────────────────────────────────────

  const projectName = (id) =>
    projects.find((p) => p.id === id)?.name ?? id;

  const toggleProject = (projId) => {
    setFormData((prev) => ({
      ...prev,
      projectIds: prev.projectIds.includes(projId)
        ? prev.projectIds.filter((id) => id !== projId)
        : [...prev.projectIds, projId],
    }));
  };

  // ─── add ───────────────────────────────────────────────────────────────────

  const openAdd = () => {
    setFormData(EMPTY_FORM);
    setIsAddOpen(true);
  };

  const handleAdd = async () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      toast({ title: "Name and email are required.", variant: "destructive" });
      return;
    }
    if (formData.projectIds.length === 0) {
      toast({ title: "Select at least one project.", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      const tempPassword = generateTempPassword();
      await createUser({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: tempPassword,
        role: "client",
        projectIds: formData.projectIds,
        orgId: currentUser.orgId,
      });
      // Send a Firebase password-reset email so the client can set their own password.
      await resetUserPassword(formData.email.trim());
      toast({
        title: "Client account created",
        description: "A password setup email has been sent to the client.",
      });
      setIsAddOpen(false);
      loadData();
    } catch (err) {
      reportError(err, { context: "ClientsManagement.handleAdd" });
      toast({ title: err.message || "Failed to create account", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ─── edit ──────────────────────────────────────────────────────────────────

  const openEdit = (client) => {
    setSelectedClient(client);
    setFormData({
      name: client.name || "",
      email: client.email || "",
      password: "",
      projectIds: client.projectIds ?? [],
    });
    setIsEditOpen(true);
  };

  const handleEdit = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Name is required.", variant: "destructive" });
      return;
    }
    if (formData.projectIds.length === 0) {
      toast({ title: "Select at least one project.", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      await updateUser(selectedClient.id, {
        name: formData.name.trim(),
        projectIds: formData.projectIds,
      });
      toast({ title: "Client account updated." });
      setIsEditOpen(false);
      loadData();
    } catch (err) {
      reportError(err, { context: "ClientsManagement.handleEdit" });
      toast({ title: err.message || "Failed to update account", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ─── status toggle ─────────────────────────────────────────────────────────

  const handleToggleStatus = async (client) => {
    try {
      if (client.status === "active") {
        await deactivateUser(client.id);
        toast({ title: `${client.name} deactivated.` });
      } else {
        await activateUser(client.id);
        toast({ title: `${client.name} reactivated.` });
      }
      loadData();
    } catch (err) {
      reportError(err, { context: "ClientsManagement.toggleStatus" });
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  // ─── password reset ────────────────────────────────────────────────────────

  const handleResetPassword = async (client) => {
    try {
      await resetUserPassword(client.email);
      toast({
        title: "Password reset email sent",
        description: `Sent to ${client.email}`,
      });
    } catch (err) {
      reportError(err, { context: "ClientsManagement.resetPassword" });
      toast({ title: "Failed to send reset email", variant: "destructive" });
    }
  };

  // ─── delete ────────────────────────────────────────────────────────────────

  const openDelete = (client) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!clientToDelete) return;
    try {
      await deleteUser(clientToDelete.id);
      toast({ title: `${clientToDelete.name} removed.` });
      setDeleteDialogOpen(false);
      setClientToDelete(null);
      loadData();
    } catch (err) {
      reportError(err, { context: "ClientsManagement.handleDelete" });
      toast({ title: "Failed to delete client", variant: "destructive" });
    }
  };

  // ─── filter ────────────────────────────────────────────────────────────────

  const filtered = clients.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Client Portal Accounts</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create logins for external stakeholders to view project progress.
          </p>
        </div>
        <Button onClick={openAdd} className="flex items-center gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          Add Client
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
            <Globe className="w-10 h-10 text-muted-foreground" />
            <p className="font-medium">
              {searchQuery ? "No clients match your search." : "No client accounts yet."}
            </p>
            {!searchQuery && (
              <p className="text-sm text-muted-foreground max-w-xs">
                Add a client to give them a read-only view of their project's progress.
              </p>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((client, i) => (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Avatar + info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Globe className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{client.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{client.email}</p>
                    </div>
                  </div>

                  {/* Project badges */}
                  <div className="flex flex-wrap gap-1 flex-1">
                    {(client.projectIds ?? []).length === 0 ? (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> No projects assigned
                      </span>
                    ) : (
                      (client.projectIds ?? []).map((id) => (
                        <Badge key={id} variant="secondary" className="text-xs">
                          {projectName(id)}
                        </Badge>
                      ))
                    )}
                  </div>

                  {/* Status badge */}
                  <Badge
                    variant={client.status === "active" ? "default" : "outline"}
                    className="shrink-0"
                  >
                    {client.status === "active" ? "Active" : "Inactive"}
                  </Badge>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(client)}
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleStatus(client)}
                      title={client.status === "active" ? "Deactivate" : "Activate"}
                    >
                      {client.status === "active"
                        ? <UserX className="w-4 h-4" />
                        : <UserCheck className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResetPassword(client)}
                      title="Send password reset email"
                    >
                      <KeyRound className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => openDelete(client)}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <ClientFormDialog
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSubmit={handleAdd}
        title="New Client Account"
        description="Create a login for an external stakeholder. They will only see the projects you assign."
        isEdit={false}
        formData={formData}
        setFormData={setFormData}
        projects={projects}
        toggleProject={toggleProject}
        saving={saving}
      />

      {/* Edit Dialog */}
      <ClientFormDialog
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSubmit={handleEdit}
        title="Edit Client Account"
        description="Update the client name or the projects they can access."
        isEdit={true}
        formData={formData}
        setFormData={setFormData}
        projects={projects}
        toggleProject={toggleProject}
        saving={saving}
      />

      {/* Delete Confirm */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Client Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete {clientToDelete?.name}&apos;s account from MagnaFlow.
              Their Firebase sign-in will be queued for cleanup. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientsManagement;
