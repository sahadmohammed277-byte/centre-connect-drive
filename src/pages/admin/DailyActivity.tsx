import { useEffect, useMemo, useState } from "react";
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
import { Eye, Calendar as CalendarIcon, Download } from "lucide-react";
import { DATE_RANGE_PRESETS, getPresetDates, detectPreset, todayISO } from "@/lib/date-range";

export default function DailyActivityPage() {
  const [fromDate, setFromDate] = useState(todayISO());
  const [toDate, setToDate] = useState(todayISO());
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
  useEffect(() => { void loadActivity(); }, [fromDate, toDate]);

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
    const start = fromDate <= toDate ? fromDate : toDate;
    const end = fromDate <= toDate ? toDate : fromDate;
    const [checkinsRes, visitsRes] = await Promise.all([
      supabase.from("daily_checkins").select("*")
        .gte("checkin_date", start)
        .lte("checkin_date", end),
      supabase.from("visits").select("user_id, visitor_type, visit_date")
        .gte("visit_date", start)
        .lte("visit_date", end),
    ]);
    const built = (checkinsRes.data || []).map((ci: any) => {
      const userVisits = (visitsRes.data || []).filter(
        (v: any) => v.user_id === ci.user_id && v.visit_date === ci.checkin_date
      );
      return {
        ...ci,
        visit_count: userVisits.length,
        doctor_count: userVisits.filter((v: any) => v.visitor_type === "doctor").length,
      };
    });
    built.sort((a: any, b: any) =>
      (b.checkin_date || "").localeCompare(a.checkin_date || "") ||
      (b.checkin_time || "").localeCompare(a.checkin_time || "")
    );
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

  function applyQuick(range: "today" | "week" | "month") {
    const now = new Date();
    if (range === "today") {
      const t = toISO(now);
      setFromDate(t); setToDate(t);
    } else if (range === "week") {
      const d = new Date(now);
      const day = d.getDay(); // 0 Sun
      const diffToMon = (day + 6) % 7;
      d.setDate(d.getDate() - diffToMon);
      setFromDate(toISO(d));
      setToDate(toISO(now));
    } else {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(toISO(first));
      setToDate(toISO(now));
    }
  }

  const activeQuick = useMemo(() => {
    const now = new Date();
    const t = toISO(now);
    if (fromDate === t && toDate === t) return "today";
    const d = new Date(now);
    const day = d.getDay();
    const diffToMon = (day + 6) % 7;
    d.setDate(d.getDate() - diffToMon);
    if (fromDate === toISO(d) && toDate === t) return "week";
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    if (fromDate === toISO(first) && toDate === t) return "month";
    return "";
  }, [fromDate, toDate]);

  const filtered = rows
    .filter((r) => centreFilter === "all" || r.centre_id === centreFilter)
    .filter((r) => staffFilter === "all" || r.user_id === staffFilter)
    .filter((r) => {
      if (!search) return true;
      const p = profiles.find((x) => x.user_id === r.user_id);
      return p?.full_name?.toLowerCase().includes(search.toLowerCase());
    });

  function handleDownload() {
    const headers = ["Date", "Staff", "Centre", "Visits", "Doctors", "KM", "Check-in", "Check-out", "Status"];
    const lines = filtered.map((r) => {
      const p = profiles.find((x) => x.user_id === r.user_id);
      const c = centres.find((x) => x.id === r.centre_id);
      const checkin = r.checkin_time ? new Date(r.checkin_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
      const checkout = r.checkout_time ? new Date(r.checkout_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
      const status = r.checkout_time ? "Completed" : "Active";
      return [
        `"${r.checkin_date}"`,
        `"${(p?.full_name || "").replace(/"/g, '""')}"`,
        `"${(c?.name || "").replace(/"/g, '""')}"`,
        r.visit_count,
        r.doctor_count,
        (r.total_km ?? 0).toFixed(1),
        `"${checkin}"`,
        `"${checkout}"`,
        `"${status}"`,
      ].join(",");
    });
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `daily-activity-${fromDate}-to-${toDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <DataTableShell
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search staff…"
        isEmpty={!loading && filtered.length === 0}
        emptyMessage="No activity in this date range."
        actions={
          <Button size="sm" variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        }
        filters={
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">From Date</Label>
              <div className="relative">
                <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={fromDate}
                  placeholder="From Date"
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-[170px] pl-9"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">To Date</Label>
              <div className="relative">
                <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={toDate}
                  placeholder="To Date"
                  min={fromDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-[170px] pl-9"
                />
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={activeQuick === "today" ? "default" : "outline"}
                onClick={() => applyQuick("today")}
              >Today</Button>
              <Button
                size="sm"
                variant={activeQuick === "week" ? "default" : "outline"}
                onClick={() => applyQuick("week")}
              >This Week</Button>
              <Button
                size="sm"
                variant={activeQuick === "month" ? "default" : "outline"}
                onClick={() => applyQuick("month")}
              >This Month</Button>
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
              <TableHead>Date</TableHead>
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
                  <TableCell className="text-xs">{r.checkin_date}</TableCell>
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
            <DialogTitle>Day Details — {detail?.checkin_date}</DialogTitle>
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
