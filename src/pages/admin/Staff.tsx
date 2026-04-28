import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DataTableShell } from "@/components/admin/DataTableShell";
import { ResetCredentialsDialog } from "@/components/admin/ResetCredentialsDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Lock, KeyRound } from "lucide-react";
import { toast } from "sonner";

export default function StaffPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [centres, setCentres] = useState<any[]>([]);
  const [lastActive, setLastActive] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [centreFilter, setCentreFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ user_id: string; full_name: string; employee_id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "", employee_id: "", phone: "", email: "", password: "", centre_id: "",
  });

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const [profilesRes, rolesRes, centresRes, checkinsRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("centres").select("*").order("name"),
      supabase.from("daily_checkins").select("user_id, checkin_time").order("checkin_time", { ascending: false }),
    ]);
    const roleMap: Record<string, string> = {};
    (rolesRes.data || []).forEach((r: any) => { roleMap[r.user_id] = r.role; });
    const lastMap: Record<string, string> = {};
    (checkinsRes.data || []).forEach((c: any) => {
      if (!lastMap[c.user_id] && c.checkin_time) lastMap[c.user_id] = c.checkin_time;
    });
    // Show only staff (not admins)
    const staff = (profilesRes.data || []).filter((p: any) => roleMap[p.user_id] !== "admin");
    setProfiles(staff);
    setRoles(roleMap);
    setCentres(centresRes.data || []);
    setLastActive(lastMap);
    setLoading(false);
  }

  function genEmployeeId() {
    return "STF-" + Math.random().toString(36).slice(2, 7).toUpperCase();
  }

  function openNew() {
    setForm({
      full_name: "", employee_id: genEmployeeId(), phone: "",
      email: "", password: "", centre_id: "",
    });
    setOpen(true);
  }

  async function createStaff() {
    if (!form.full_name.trim()) return toast.error("Full name required");
    if (!form.email.trim()) return toast.error("Email required");
    if (form.password.length < 8) return toast.error("Password ≥ 8 chars");
    if (!form.centre_id) return toast.error("Assign a centre");
    setSaving(true);
    const centre = centres.find((c) => c.id === form.centre_id);
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: {
        action: "create_user",
        email: form.email.trim(),
        password: form.password,
        employee_id: form.employee_id.trim(),
        full_name: form.full_name.trim(),
        role: "staff",
        centre_name: centre?.name,
      },
    });
    setSaving(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error || error?.message || "Failed");
    }
    // Save phone separately
    if (form.phone) {
      await supabase.from("profiles").update({ phone: form.phone.trim() }).eq("user_id", (data as any).user_id);
    }
    toast.success("Staff created");
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

  const filtered = profiles
    .filter((p) => centreFilter === "all" || p.centre_id === centreFilter)
    .filter((p) => {
      const q = search.toLowerCase();
      return !q || p.full_name?.toLowerCase().includes(q) || p.employee_id?.toLowerCase().includes(q);
    });

  return (
    <DataTableShell
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search staff…"
      isEmpty={!loading && filtered.length === 0}
      filters={
        <Select value={centreFilter} onValueChange={setCentreFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Centres</SelectItem>
            {centres.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Add Staff</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Staff</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Employee ID</Label>
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
                <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 8 chars" />
              </div>
              <div className="space-y-2">
                <Label>Assigned Centre <span className="text-xs text-muted-foreground">(locked after creation)</span></Label>
                <Select value={form.centre_id} onValueChange={(v) => setForm({ ...form, centre_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select centre" /></SelectTrigger>
                  <SelectContent>
                    {centres.filter((c) => c.is_active).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={createStaff} disabled={saving}>{saving ? "Creating…" : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Employee ID</TableHead>
            <TableHead>Centre</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Active</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((p) => {
            const centre = centres.find((c) => c.id === p.centre_id);
            const last = lastActive[p.user_id];
            return (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.full_name}</TableCell>
                <TableCell className="font-mono text-xs">{p.employee_id}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1">
                    {centre?.name || "—"}
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  </span>
                </TableCell>
                <TableCell>
                  {p.is_active ? (
                    <Badge className="bg-success text-success-foreground hover:bg-success">Active</Badge>
                  ) : (
                    <Badge variant="destructive">Disabled</Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {last ? new Date(last).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => {
                              setResetTarget({ user_id: p.user_id, full_name: p.full_name, employee_id: p.employee_id });
                              setResetOpen(true);
                            }}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reset Credentials</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(p)}>
                      {p.is_active ? "Disable" : "Enable"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </DataTableShell>
  );
}
