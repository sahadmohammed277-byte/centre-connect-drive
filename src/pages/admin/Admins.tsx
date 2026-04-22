import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DataTableShell } from "@/components/admin/DataTableShell";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export default function AdminsPage() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "", employee_id: "", email: "", password: "", phone: "",
  });

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
    ]);
    const adminIds = new Set((rolesRes.data || []).map((r: any) => r.user_id));
    setAdmins((profilesRes.data || []).filter((p: any) => adminIds.has(p.user_id)));
    setLoading(false);
  }

  function openNew() {
    setForm({
      full_name: "",
      employee_id: "ADM-" + Math.random().toString(36).slice(2, 7).toUpperCase(),
      email: "", password: "", phone: "",
    });
    setOpen(true);
  }

  async function create() {
    if (!form.full_name.trim()) return toast.error("Name required");
    if (!form.email.trim()) return toast.error("Email required");
    if (form.password.length < 8) return toast.error("Password ≥ 8 chars");
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: {
        action: "create_user",
        email: form.email.trim(),
        password: form.password,
        employee_id: form.employee_id.trim(),
        full_name: form.full_name.trim(),
        role: "admin",
      },
    });
    setSaving(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error || error?.message || "Failed");
    }
    if (form.phone) {
      await supabase.from("profiles").update({ phone: form.phone.trim() }).eq("user_id", (data as any).user_id);
    }
    toast.success("Admin created");
    setOpen(false);
    void load();
  }

  async function toggleActive(p: any) {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !p.is_active })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(p.is_active ? "Disabled" : "Enabled");
    void load();
  }

  const filtered = admins.filter((p) => {
    const q = search.toLowerCase();
    return !q || p.full_name?.toLowerCase().includes(q) || p.employee_id?.toLowerCase().includes(q);
  });

  return (
    <DataTableShell
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search admins…"
      isEmpty={!loading && filtered.length === 0}
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Add Admin</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Admin</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Admin ID</Label>
                  <Input value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Mobile</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email (login)</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Initial Password</Label>
                <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <p className="text-xs text-muted-foreground">
                Role: <strong>Super Admin</strong> — full system access.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={create} disabled={saving}>{saving ? "Creating…" : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Admin ID</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.full_name}</TableCell>
              <TableCell className="font-mono text-xs">{p.employee_id}</TableCell>
              <TableCell>{p.phone || "—"}</TableCell>
              <TableCell><Badge>Super Admin</Badge></TableCell>
              <TableCell>
                {p.is_active ? (
                  <Badge className="bg-success text-success-foreground hover:bg-success">Active</Badge>
                ) : (
                  <Badge variant="destructive">Disabled</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => toggleActive(p)}>
                  {p.is_active ? "Disable" : "Enable"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataTableShell>
  );
}
