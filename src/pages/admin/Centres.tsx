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
import { Switch } from "@/components/ui/switch";
import { DataTableShell } from "@/components/admin/DataTableShell";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Centre {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  geo_fence_radius_meters: number;
  is_active: boolean;
}

export default function CentresPage() {
  const [centres, setCentres] = useState<Centre[]>([]);
  const [staffCounts, setStaffCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Centre | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", lat: "", lng: "", radius: "200", is_active: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const [centresRes, profilesRes] = await Promise.all([
      supabase.from("centres").select("*").order("name"),
      supabase.from("profiles").select("centre_id"),
    ]);
    setCentres((centresRes.data as Centre[]) || []);
    const counts: Record<string, number> = {};
    (profilesRes.data || []).forEach((p: any) => {
      if (p.centre_id) counts[p.centre_id] = (counts[p.centre_id] || 0) + 1;
    });
    setStaffCounts(counts);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm({ name: "", lat: "", lng: "", radius: "200", is_active: true });
    setOpen(true);
  }
  function openEdit(c: Centre) {
    setEditing(c);
    setForm({
      name: c.name,
      lat: String(c.latitude),
      lng: String(c.longitude),
      radius: String(c.geo_fence_radius_meters),
      is_active: c.is_active,
    });
    setOpen(true);
  }

  async function save() {
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    const radius = parseInt(form.radius, 10);
    if (!form.name.trim()) return toast.error("Name required");
    if (Number.isNaN(lat) || lat < -90 || lat > 90) return toast.error("Invalid latitude");
    if (Number.isNaN(lng) || lng < -180 || lng > 180) return toast.error("Invalid longitude");
    if (Number.isNaN(radius) || radius < 50 || radius > 1000) return toast.error("Radius 50–1000 m");

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      latitude: lat,
      longitude: lng,
      geo_fence_radius_meters: radius,
      is_active: form.is_active,
    };
    const { error } = editing
      ? await supabase.from("centres").update(payload).eq("id", editing.id)
      : await supabase.from("centres").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Centre updated" : "Centre added");
    setOpen(false);
    void load();
  }

  async function toggleActive(c: Centre) {
    const { error } = await supabase
      .from("centres")
      .update({ is_active: !c.is_active })
      .eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success(c.is_active ? "Centre disabled" : "Centre enabled");
    void load();
  }

  const filtered = centres.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DataTableShell
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search centres…"
      isEmpty={!loading && filtered.length === 0}
      emptyMessage="No centres yet — add your first one."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Add Centre</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Centre" : "Add New Centre"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Centre Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="KH Calicut" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Latitude</Label>
                  <Input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="11.2588" />
                </div>
                <div className="space-y-2">
                  <Label>Longitude</Label>
                  <Input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="75.7804" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Geo-fence Radius (m)</Label>
                <Input type="number" min={50} max={1000} value={form.radius} onChange={(e) => setForm({ ...form, radius: e.target.value })} />
                <p className="text-xs text-muted-foreground">Recommended: 100–200 m</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>Active</Label>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Centre</TableHead>
            <TableHead>Coordinates</TableHead>
            <TableHead className="text-right">Radius</TableHead>
            <TableHead className="text-right">Staff</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell className="text-xs font-mono text-muted-foreground">
                {c.latitude.toFixed(4)}, {c.longitude.toFixed(4)}
              </TableCell>
              <TableCell className="text-right">{c.geo_fence_radius_meters} m</TableCell>
              <TableCell className="text-right">{staffCounts[c.id] || 0}</TableCell>
              <TableCell>
                {c.is_active ? (
                  <Badge className="bg-success text-success-foreground hover:bg-success">Active</Badge>
                ) : (
                  <Badge variant="destructive">Inactive</Badge>
                )}
              </TableCell>
              <TableCell className="text-right space-x-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => toggleActive(c)}>
                  {c.is_active ? "Disable" : "Enable"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataTableShell>
  );
}
