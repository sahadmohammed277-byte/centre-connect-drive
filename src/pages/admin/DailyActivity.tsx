import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { DataTableShell } from "@/components/admin/DataTableShell";
import { Eye } from "lucide-react";

export default function DailyActivityPage() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [centreFilter, setCentreFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [centres, setCentres] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailVisits, setDetailVisits] = useState<any[]>([]);
  const [detailReferrals, setDetailReferrals] = useState<any[]>([]);

  useEffect(() => { void loadMeta(); }, []);
  useEffect(() => { void loadActivity(); }, [date]);

  async function loadMeta() {
    const [c, p] = await Promise.all([
      supabase.from("centres").select("*").order("name"),
      supabase.from("profiles").select("*"),
    ]);
    setCentres(c.data || []);
    setProfiles(p.data || []);
  }

  async function loadActivity() {
    setLoading(true);
    const [checkinsRes, visitsRes] = await Promise.all([
      supabase.from("daily_checkins").select("*").eq("checkin_date", date),
      supabase.from("visits").select("user_id, visitor_type").eq("visit_date", date),
    ]);
    const built = (checkinsRes.data || []).map((ci: any) => {
      const userVisits = (visitsRes.data || []).filter((v: any) => v.user_id === ci.user_id);
      return {
        ...ci,
        visit_count: userVisits.length,
        doctor_count: userVisits.filter((v: any) => v.visitor_type === "doctor").length,
      };
    });
    setRows(built);
    setLoading(false);
  }

  async function viewDetails(row: any) {
    setDetail(row);
    const [v, r] = await Promise.all([
      supabase.from("visits").select("*").eq("checkin_id", row.id).order("created_at"),
      supabase.from("referrals").select("*").eq("checkin_id", row.id).order("created_at"),
    ]);
    setDetailVisits(v.data || []);
    setDetailReferrals(r.data || []);
  }

  const filtered = rows
    .filter((r) => centreFilter === "all" || r.centre_id === centreFilter)
    .filter((r) => staffFilter === "all" || r.user_id === staffFilter)
    .filter((r) => {
      if (!search) return true;
      const p = profiles.find((x) => x.user_id === r.user_id);
      return p?.full_name?.toLowerCase().includes(search.toLowerCase());
    });

  return (
    <>
      <DataTableShell
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search staff…"
        isEmpty={!loading && filtered.length === 0}
        emptyMessage="No activity for this date."
        filters={
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[160px]" />
            </div>
            <Select value={centreFilter} onValueChange={setCentreFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Centres</SelectItem>
                {centres.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={staffFilter} onValueChange={setStaffFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
                {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff</TableHead>
              <TableHead>Centre</TableHead>
              <TableHead className="text-right">Visits</TableHead>
              <TableHead className="text-right">Doctors</TableHead>
              <TableHead className="text-right">KM</TableHead>
              <TableHead>Check-in</TableHead>
              <TableHead>Check-out</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => {
              const p = profiles.find((x) => x.user_id === r.user_id);
              const c = centres.find((x) => x.id === r.centre_id);
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{p?.full_name || "—"}</TableCell>
                  <TableCell>{c?.name || "—"}</TableCell>
                  <TableCell className="text-right">{r.visit_count}</TableCell>
                  <TableCell className="text-right">{r.doctor_count}</TableCell>
                  <TableCell className="text-right">{(r.total_km ?? 0).toFixed(1)}</TableCell>
                  <TableCell className="text-xs">{r.checkin_time ? new Date(r.checkin_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                  <TableCell className="text-xs">{r.checkout_time ? new Date(r.checkout_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : <Badge variant="outline">Active</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => viewDetails(r)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DataTableShell>

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Day Details — {date}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <section>
              <h3 className="text-sm font-semibold mb-2">Visits ({detailVisits.length})</h3>
              {detailVisits.length === 0 ? (
                <p className="text-sm text-muted-foreground">No visits logged.</p>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Visitor</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Purpose</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailVisits.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell>{v.visitor_name}</TableCell>
                          <TableCell><Badge variant="outline">{v.visitor_type}</Badge></TableCell>
                          <TableCell className="text-xs">{v.purpose || "—"}</TableCell>
                          <TableCell className="text-xs">{new Date(v.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
            <section>
              <h3 className="text-sm font-semibold mb-2">Referrals ({detailReferrals.length})</h3>
              {detailReferrals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No referrals logged.</p>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailReferrals.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.patient_name || "—"}</TableCell>
                          <TableCell><Badge variant="outline">{r.service_type || "—"}</Badge></TableCell>
                          <TableCell>₹{r.estimated_value ?? 0}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
