import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PortalShell } from "@/components/PortalShell";
import { adminNav } from "@/components/portal-nav";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Pencil } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  Building2,
  Plus,
  Trash2,
  ArrowRight,
  Loader2,
  FolderOpen,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/admin/")(
  { component: DepartmentManager }
);

interface Department {
  id: number;
  name: string;
  is_active?: boolean; // May be omitted by backend since it filters active ones
  programme_scope?: string;
  is_allocation_locked?: boolean;
}

function DepartmentManager() {
  const navigate = useNavigate();
  const { setActiveDepartmentId, setActiveDepartmentName } = useWorkspace();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptScope, setNewDeptScope] = useState("UG");
  const [creating, setCreating] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/admin/departments");
      // Backend may return dict or array
      if (Array.isArray(res.data)) {
        setDepartments(res.data);
      } else if (typeof res.data === "object") {
        // Convert dict format { "name": has_labs } to array
        const arr = Object.entries(res.data).map(([name], idx) => ({
          id: idx + 1,
          name,
          is_active: true,
        }));
        setDepartments(arr);
      }
    } catch (err: any) {
      // If no departments endpoint, show empty state
      console.error("Failed to fetch departments:", err);
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleCreate = async () => {
    if (!newDeptName.trim()) {
      toast.error("Please enter a department name.");
      return;
    }
    setCreating(true);
    try {
      await api.post("/api/admin/departments", { 
        name: newDeptName.trim(),
        programme_scope: newDeptScope 
      });
      toast.success(`Department "${newDeptName.trim()}" created successfully!`);
      setNewDeptName("");
      setNewDeptScope("UG");
      setShowCreate(false);
      fetchDepartments();
    } catch (err: any) {
      toast.error(
        err.message || "Failed to create department."
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/admin/departments/${deleteTarget.id}`);
      toast.success(`Department "${deleteTarget.name}" archived successfully.`);
      setDeleteTarget(null);
      fetchDepartments();
    } catch (err: any) {
      toast.error(
        err.message || "Failed to archive department."
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleSelect = (dept: Department) => {
    setActiveDepartmentId(dept.id);
    setActiveDepartmentName(dept.name);
    toast.success(`Workspace set to "${dept.name}"`);
    navigate({ to: "/admin/setup" });
  };

  return (
    <PortalShell
      role="admin"
      title="Department Manager"
      subtitle="Create, select, or archive departments to begin your workspace session"
      nav={adminNav}
    >
      <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Active Departments
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Select a department to enter its workspace, or create a new one.
            </p>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="gap-2 rounded-xl bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90 shadow-lg transition-all hover:-translate-y-0.5"
          >
            <Plus className="size-4" /> Create Department
          </Button>
        </div>

        {/* Department Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-primary opacity-60" />
          </div>
        ) : departments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-border bg-muted/20">
            <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center mb-5">
              <FolderOpen className="size-10 text-primary/60" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              No Departments Yet
            </h3>
            <p className="text-sm text-muted-foreground max-w-md text-center mb-6">
              Start by creating your first department. All setup, ingestion,
              preferences, and allocation data is scoped to departments.
            </p>
            <Button
              onClick={() => setShowCreate(true)}
              className="gap-2"
            >
              <Plus className="size-4" /> Create Your First Department
            </Button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((dept) => (
              <div
                key={dept.id}
                className="group relative rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-[var(--shadow-card)] hover:-translate-y-1 hover:border-primary/30"
              >
                {/* Decorative gradient blob */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-[4rem] rounded-tr-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                      <Building2 className="size-6" />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(dept);
                      }}
                      className="size-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                      title="Archive Department"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  <h3 className="text-lg font-bold text-foreground mb-1 tracking-tight">
                    {dept.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-5">
                    {dept.is_active !== false ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active {dept.programme_scope ? `(${dept.programme_scope})` : ''}
                      </span>
                    ) : (
                      "Archived"
                    )}
                  </p>

                  <Button
                    onClick={() => handleSelect(dept)}
                    className="w-full gap-2 rounded-xl transition-all group-hover:bg-gradient-to-r group-hover:from-primary group-hover:to-indigo-600 group-hover:shadow-lg"
                  >
                    <Sparkles className="size-4" /> Enter Workspace{" "}
                    <ArrowRight className="size-4 ml-auto" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Department Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-5 text-primary" /> New Department
            </DialogTitle>
            <DialogDescription>
              Create a new department workspace. All ingestion, preferences, and
              allocation data will be scoped to this department.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="dept-name">Department Name</Label>
              <Input
                id="dept-name"
                placeholder="e.g. PG Department of Computer Applications - MCA"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                autoFocus
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label>Programme Scope</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer border rounded-lg px-4 py-2 hover:bg-muted/50 transition-colors">
                  <input 
                    type="radio" 
                    name="scope" 
                    value="UG" 
                    checked={newDeptScope === "UG"}
                    onChange={(e) => setNewDeptScope(e.target.value)}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium">Undergraduate (UG)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer border rounded-lg px-4 py-2 hover:bg-muted/50 transition-colors">
                  <input 
                    type="radio" 
                    name="scope" 
                    value="PG" 
                    checked={newDeptScope === "PG"}
                    onChange={(e) => setNewDeptScope(e.target.value)}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium">Postgraduate (PG)</span>
                </label>
              </div>
            </div>
            <Button
              type="submit"
              disabled={creating}
              className="w-full gap-2"
            >
              {creating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {creating ? "Creating..." : "Create Department"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Archive Department?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will soft-delete "{deleteTarget?.name}". The department and
              its data will be archived but can be restored. This action does
              NOT permanently remove any data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="size-4 mr-2" />
              )}
              {deleting ? "Archiving..." : "Archive Department"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PortalShell>
  );
}
