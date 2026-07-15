import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DataTableShell } from "@/components/admin/DataTableShell";
import {
  CalendarClock, CheckCircle2, XCircle, Clock, Percent, Eye, Pencil, Trash2,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { DATE_RANGE_PRESETS, getPresetDates, detectPreset, todayISO } from "@/lib/date-range";
import { toast } from "sonner";

type Activity = {
  id: string;
  staff_id: string;
  centre_id: string | null;
  activity_date: string;
  activity_name: string;
  location: string | null;
  expected_completion_date: string;
  completion_date: string | null;
  notes: string | null;
  completion_notes: string | null;
  status: "planning" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
};

export default function MonthlyActivitiesPage() {
  // Default: this month
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(todayISO());
  const [centreFilter, setCentreFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [rows, setRows] = useState<Activity[]>([]);
  const [centres, setCentres] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewing, setViewing] = useState<Activity | null>(null);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [editForm, setEditForm] = useState<Partial<Activity>>({});

  useEffect(() => { void loadMeta(); }, []);
  useEffect(() => { void loadData(); }, [fromDate, toDate]);

  useEffect(() => {
    const ch = supabase
      .channel("admin-monthly-activities")
      .on("postgres_changes", { event: "*", schema: "public", table: "monthly_activities" }, () => loadData())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  async function loadMeta() {
    const [c, p] = await Promise.all([
      supabase.from("centres").select("id, name").order("name"),
      supabase.from("profiles").select("user_id, full_name"),
    ]);
    setCentres(c.data || []);
    setProfiles(p.data || []);
  }

  async function loadData() {
    setLoading(true);
    const { data, error } = await supabase
      .from("monthly_activities")
      .select("*")
      .gte("activity_date", fromDate)
      .lte("activity_date", toDate)
      .order("activity_date", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as Activity[]) || []);
    setLoading(false);
  }

  const preset = detectPreset(fromDate, toDate);
  const applyPreset = (p: typeof preset) => {
    if (p === "custom") return;
    const d = getPresetDates(p);
    setFromDate(d.from);
    setToDate(d.to);
  };

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (centreFilter !== "all" && r.centre_id !== centreFilter) return false;
      if (staffFilter !== "all" && r.staff_id !== staffFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search && !r.activity_name.toLowerCase().includes(search.toLowerCase())
        && !(r.location || "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, centreFilter, staffFilter, statusFilter, search]);

  const totals = useMemo(() => {
    const total = filtered.length;
    const planning = filtered.filter((r) => r.status === "planning").length;
    const completed = filtered.filter((r) => r.status === "completed").length;
    const cancelled = filtered.filter((r) => r.status === "cancelled").length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, planning, completed, cancelled, pct };
  }, [filtered]);

  const staffName = (id: string) => profiles.find((p) => p.user_id === id)?.full_name || "—";
  const centreName = (id: string | null) => centres.find((c) => c.id === id)?.name || "—";

  const openEdit = (a: Activity) => {
    setEditing(a);
    setEditForm({
      activity_date: a.activity_date,
      activity_name: a.activity_name,
      location: a.location,
      expected_completion_date: a.expected_completion_date,
      completion_date: a.completion_date,
      notes: a.notes,
      completion_notes: a.completion_notes,
      status: a.status,
      centre_id: a.centre_id,
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase
      .from("monthly_activities")
      .update(editForm)
      .eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Activity updated");
    setEditing(null);
    loadData();
  };

  const remove = async (a: Activity) => {
    if (!confirm(`Delete "${a.activity_name}"?`)) return;
    const { error } = await supabase.from("monthly_activities").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Activity deleted");
    loadData();
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {DATE_RANGE_PRESETS.map((p) => (
              <Button
                key={p.value}
                size="sm"
                variant={preset === p.value ? "default" : "outline"}
                onClick={() => applyPreset(p.value as any)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Centre</Label>
              <Select value={centreFilter} onValueChange={setCentreFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {centres.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Staff</Label>
              <Select value={staffFilter} onValueChange={setStaffFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat icon={CalendarClock} label="Total" value={totals.total} tone="primary" />
        <Stat icon={Clock} label="Planning" value={totals.planning} tone="warning" />
        <Stat icon={CheckCircle2} label="Completed" value={totals.completed} tone="success" />
        <Stat icon={XCircle} label="Cancelled" value={totals.cancelled} tone="destructive" />
        <Stat icon={Percent} label="Completion %" value={`${totals.pct}%`} tone="primary" />
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <DataTableShell
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search activity or location…"
            isEmpty={!loading && filtered.length === 0}
            emptyMessage="No activities in this range."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Centre</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Completion Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{new Date(a.activity_date).toLocaleDateString()}</TableCell>
                    <TableCell>{staffName(a.staff_id)}</TableCell>
                    <TableCell>{centreName(a.centre_id)}</TableCell>
                    <TableCell className="font-medium">{a.activity_name}</TableCell>
                    <TableCell className="text-muted-foreground">{a.location || "—"}</TableCell>
                    <TableCell>{new Date(a.expected_completion_date).toLocaleDateString()}</TableCell>
                    <TableCell><StatusPill status={a.status} /></TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                      {a.completion_notes || "—"}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => setViewing(a)} title="View">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(a)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(a)} title="Delete"
                        className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTableShell>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <CalendarView activities={filtered} staffName={staffName} />
        </TabsContent>
      </Tabs>

      {/* View dialog */}
      <Dialog open={!!viewing} onOpenChange={() => setViewing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewing?.activity_name}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-2 text-sm">
              <Row label="Staff" value={staffName(viewing.staff_id)} />
              <Row label="Centre" value={centreName(viewing.centre_id)} />
              <Row label="Activity Date" value={new Date(viewing.activity_date).toLocaleDateString()} />
              <Row label="Location" value={viewing.location || "—"} />
              <Row label="Expected Completion" value={new Date(viewing.expected_completion_date).toLocaleDateString()} />
              <Row label="Completion Date" value={viewing.completion_date ? new Date(viewing.completion_date).toLocaleDateString() : "—"} />
              <Row label="Status" value={<StatusPill status={viewing.status} />} />
              <Row label="Notes" value={viewing.notes || "—"} />
              <Row label="Completion Notes" value={viewing.completion_notes || "—"} />
              <Row label="Created" value={new Date(viewing.created_at).toLocaleString()} />
              <Row label="Updated" value={new Date(viewing.updated_at).toLocaleString()} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Activity</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Activity Date</Label>
                <Input type="date" value={editForm.activity_date || ""} onChange={(e) => setEditForm((p) => ({ ...p, activity_date: e.target.value }))} />
              </div>
              <div className="space-y-1"><Label>Expected Completion</Label>
                <Input type="date" value={editForm.expected_completion_date || ""} onChange={(e) => setEditForm((p) => ({ ...p, expected_completion_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1"><Label>Activity Name</Label>
              <Input value={editForm.activity_name || ""} onChange={(e) => setEditForm((p) => ({ ...p, activity_name: e.target.value }))} />
            </div>
            <div className="space-y-1"><Label>Location</Label>
              <Input value={editForm.location || ""} onChange={(e) => setEditForm((p) => ({ ...p, location: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm((p) => ({ ...p, status: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Completion Date</Label>
                <Input type="date" value={editForm.completion_date || ""} onChange={(e) => setEditForm((p) => ({ ...p, completion_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1"><Label>Notes</Label>
              <Textarea rows={2} value={editForm.notes || ""} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="space-y-1"><Label>Completion Notes</Label>
              <Textarea rows={2} value={editForm.completion_notes || ""} onChange={(e) => setEditForm((p) => ({ ...p, completion_notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: any) {
  const toneClass = {
    primary: "text-primary",
    warning: "text-warning",
    success: "text-success",
    destructive: "text-destructive",
  }[tone as string] || "text-primary";
  return (
    <Card>
      <CardContent className="p-4 h-[112px] flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{label}</p>
          <Icon className={`h-4 w-4 ${toneClass}`} />
        </div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between gap-3 border-b py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "completed") return <Badge className="bg-success text-success-foreground hover:bg-success">Completed</Badge>;
  if (status === "cancelled") return <Badge variant="destructive">Cancelled</Badge>;
  return <Badge className="bg-primary text-primary-foreground hover:bg-primary">Planning</Badge>;
}

function CalendarView({ activities, staffName }: { activities: Activity[]; staffName: (id: string) => string }) {
  const [cursor, setCursor] = useState(new Date());
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const byDate = useMemo(() => {
    const map: Record<string, Activity[]> = {};
    activities.forEach((a) => {
      const key = a.activity_date;
      (map[key] ||= []).push(a);
    });
    return map;
  }, [activities]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const colorClass = (s: string) =>
    s === "completed" ? "bg-success text-success-foreground"
    : s === "cancelled" ? "bg-destructive text-destructive-foreground"
    : "bg-primary text-primary-foreground";

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" onClick={() => setCursor(new Date(year, month - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" onClick={() => setCursor(new Date(year, month + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <p className="font-semibold ml-2">
              {cursor.toLocaleString("default", { month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> Planning</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-success" /> Completed</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-destructive" /> Cancelled</span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-xs">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center font-medium text-muted-foreground py-1">{d}</div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={i} className="min-h-[80px]" />;
            const dateStr = new Date(year, month, day).toISOString().slice(0, 10);
            const list = byDate[dateStr] || [];
            return (
              <div key={i} className="min-h-[80px] border rounded p-1 space-y-0.5 bg-card">
                <p className="text-[11px] font-medium text-muted-foreground">{day}</p>
                {list.slice(0, 3).map((a) => (
                  <div key={a.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${colorClass(a.status)}`}
                    title={`${a.activity_name} — ${staffName(a.staff_id)}`}>
                    {a.activity_name}
                  </div>
                ))}
                {list.length > 3 && (
                  <p className="text-[10px] text-muted-foreground">+{list.length - 3} more</p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
