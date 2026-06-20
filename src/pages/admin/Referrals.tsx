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
import { DataTableShell } from "@/components/admin/DataTableShell";
import {
  Calendar as CalendarIcon, HeartHandshake, CheckCircle2, XCircle, Percent,
  Stethoscope, AlertTriangle, FileSpreadsheet, FileText, ChevronLeft, ChevronRight,
} from "lucide-react";
import { DATE_RANGE_PRESETS, getPresetDates, detectPreset, todayISO } from "@/lib/date-range";

type Proc = {
  id: string;
  user_id: string;
  centre_id: string;
  doctor_name: string | null;
  patient_name: string;
  procedure_type: "CAG" | "PTCA" | string;
  procedure_date: string;
  procedure_status: "pending" | "done" | "not_done";
  not_done_reason: string | null;
  payment_status: "pending" | "released";
  estimated_value: number | null;
};

const PAGE_SIZE = 15;

function csvCell(v: any) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function ReferralsPage() {
  const [fromDate, setFromDate] = useState(todayISO());
  const [toDate, setToDate] = useState(todayISO());
  const [datePreset, setDatePreset] = useState(detectPreset(fromDate, toDate));
  const [centreFilter, setCentreFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [centres, setCentres] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [rows, setRows] = useState<Proc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void loadMeta(); }, []);
  useEffect(() => { void loadData(); }, [fromDate, toDate]);
  useEffect(() => { setPage(1); }, [centreFilter, staffFilter, statusFilter, search, fromDate, toDate]);

  // Realtime sync — auto-refresh on any procedure change
  useEffect(() => {
    const ch = supabase
      .channel("admin-referrals-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "procedures" }, () => {
        void loadData();
      })
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
    const start = fromDate <= toDate ? fromDate : toDate;
    const end = fromDate <= toDate ? toDate : fromDate;
    const { data } = await supabase
      .from("procedures")
      .select("id, user_id, centre_id, doctor_name, patient_name, procedure_type, procedure_date, procedure_status, not_done_reason, payment_status, estimated_value")
      .gte("procedure_date", start)
      .lte("procedure_date", end)
      .order("procedure_date", { ascending: false });
    setRows(((data as any) || []) as Proc[]);
    setLoading(false);
  }

  function applyQuick(range: "today" | "week" | "month") {
    const now = new Date();
    if (range === "today") {
      const t = toISO(now); setFromDate(t); setToDate(t);
    } else if (range === "week") {
      const d = new Date(now);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      setFromDate(toISO(d)); setToDate(toISO(now));
    } else {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(toISO(first)); setToDate(toISO(now));
    }
  }

  const filtered = useMemo(() => {
    return rows
      .filter((r) => centreFilter === "all" || r.centre_id === centreFilter)
      .filter((r) => staffFilter === "all" || r.user_id === staffFilter)
      .filter((r) => statusFilter === "all" || r.procedure_status === statusFilter)
      .filter((r) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const staffName = profiles.find((p) => p.user_id === r.user_id)?.full_name || "";
        return (
          r.patient_name?.toLowerCase().includes(q) ||
          (r.doctor_name || "").toLowerCase().includes(q) ||
          staffName.toLowerCase().includes(q)
        );
      });
  }, [rows, centreFilter, staffFilter, statusFilter, search, profiles]);

  // KPIs (over filtered set)
  const total = filtered.length;
  const done = filtered.filter((r) => r.procedure_status === "done").length;
  const notDone = filtered.filter((r) => r.procedure_status === "not_done").length;
  const conversion = total > 0 ? Math.round((done / total) * 100) : 0;

  // Insights
  const topDoctors = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((r) => {
      const k = (r.doctor_name || "Unknown").trim();
      m.set(k, (m.get(k) || 0) + 1);
    });
    return Array.from(m.entries()).map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count).slice(0, 5);
  }, [filtered]);

  const missedReasons = useMemo(() => {
    const m = new Map<string, number>();
    filtered.filter((r) => r.procedure_status === "not_done").forEach((r) => {
      const k = (r.not_done_reason || "Unspecified").trim();
      m.set(k, (m.get(k) || 0) + 1);
    });
    return Array.from(m.entries()).map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count).slice(0, 5);
  }, [filtered]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeQuick = useMemo(() => {
    const now = new Date(); const t = toISO(now);
    if (fromDate === t && toDate === t) return "today";
    const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    if (fromDate === toISO(d) && toDate === t) return "week";
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    if (fromDate === toISO(first) && toDate === t) return "month";
    return "";
  }, [fromDate, toDate]);

  function exportCSV() {
    const headers = ["Staff", "Centre", "Doctor", "Patient", "Type", "Date", "Procedure Status", "Not Done Reason", "Payment Status", "Value"];
    const lines = [headers.join(",")];
    filtered.forEach((r) => {
      const staff = profiles.find((p) => p.user_id === r.user_id)?.full_name || "";
      const centre = centres.find((c) => c.id === r.centre_id)?.name || "";
      lines.push([
        staff, centre, r.doctor_name || "", r.patient_name, r.procedure_type, r.procedure_date,
        r.procedure_status, r.not_done_reason || "", r.payment_status, r.estimated_value ?? 0,
      ].map(csvCell).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `referrals_${fromDate}_${toDate}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  function exportPDF() {
    // Print-friendly export — opens print dialog (user can Save as PDF)
    const win = window.open("", "_blank");
    if (!win) return;
    const styles = `
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111}
        h1{font-size:18px;margin:0 0 12px}
        .meta{font-size:12px;color:#555;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
        th{background:#f3f4f6}
      </style>`;
    const rowsHtml = filtered.map((r) => {
      const staff = profiles.find((p) => p.user_id === r.user_id)?.full_name || "";
      const centre = centres.find((c) => c.id === r.centre_id)?.name || "";
      return `<tr>
        <td>${staff}</td><td>${centre}</td><td>${r.doctor_name || ""}</td>
        <td>${r.patient_name}</td><td>${r.procedure_type}</td><td>${r.procedure_date}</td>
        <td>${r.procedure_status}</td><td>${r.not_done_reason || ""}</td>
        <td>${r.payment_status}</td>
      </tr>`;
    }).join("");
    win.document.write(`<html><head><title>Referrals Report</title>${styles}</head><body>
      <h1>Referrals Report</h1>
      <div class="meta">Range: ${fromDate} → ${toDate} · Total: ${total} · Done: ${done} · Not Done: ${notDone} · Conversion: ${conversion}%</div>
      <table><thead><tr>
        <th>Staff</th><th>Centre</th><th>Doctor</th><th>Patient</th><th>Type</th><th>Date</th>
        <th>Procedure</th><th>Reason</th><th>Payment</th>
      </tr></thead><tbody>${rowsHtml}</tbody></table>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={HeartHandshake} label="Total Referrals" value={total} tone="primary" />
        <Kpi icon={CheckCircle2} label="Procedures Done" value={done} tone="success" />
        <Kpi icon={XCircle} label="Missed (Not Done)" value={notDone} tone="destructive" />
        <Kpi icon={Percent} label="Conversion Rate" value={`${conversion}%`} tone="primary" />
      </div>

      <DataTableShell
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search doctor, patient, staff…"
        isEmpty={!loading && filtered.length === 0}
        emptyMessage="No referrals match the filters."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={exportCSV}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            <Button size="sm" variant="outline" onClick={exportPDF}>
              <FileText className="h-4 w-4" /> PDF
            </Button>
          </>
        }
        filters={
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">From Date</Label>
              <div className="relative">
                <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                  className="w-[160px] pl-9" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">To Date</Label>
              <div className="relative">
                <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)}
                  className="w-[160px] pl-9" />
              </div>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant={activeQuick === "today" ? "default" : "outline"} onClick={() => applyQuick("today")}>Today</Button>
              <Button size="sm" variant={activeQuick === "week" ? "default" : "outline"} onClick={() => applyQuick("week")}>Week</Button>
              <Button size="sm" variant={activeQuick === "month" ? "default" : "outline"} onClick={() => applyQuick("month")}>Month</Button>
            </div>
            <Select value={centreFilter} onValueChange={setCentreFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Centres</SelectItem>
                {centres.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={staffFilter} onValueChange={setStaffFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
                {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="not_done">Not Done</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Centre</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Procedure</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((r) => {
                const staff = profiles.find((p) => p.user_id === r.user_id)?.full_name || "—";
                const centre = centres.find((c) => c.id === r.centre_id)?.name || "—";
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{staff}</TableCell>
                    <TableCell>{centre}</TableCell>
                    <TableCell>{r.doctor_name ? `Dr. ${r.doctor_name}` : "—"}</TableCell>
                    <TableCell>{r.patient_name}</TableCell>
                    <TableCell><Badge variant="outline">{r.procedure_type}</Badge></TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{r.procedure_date}</TableCell>
                    <TableCell><ProcStatus s={r.procedure_status} /></TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate" title={r.not_done_reason || ""}>
                      {r.procedure_status === "not_done" ? (r.not_done_reason || "—") : "—"}
                    </TableCell>
                    <TableCell><PayStatus s={r.payment_status} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t px-4 py-2 text-sm">
            <span className="text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs">Page {page} / {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DataTableShell>

      {/* Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <Stethoscope className="h-4 w-4 text-primary" /> Most Referring Doctors
            </h3>
            {topDoctors.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No data.</p>
            ) : (
              <div className="space-y-1">
                {topDoctors.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">{i + 1}</span>
                      <span className="text-sm font-medium">Dr. {d.name}</span>
                    </div>
                    <Badge variant="secondary">{d.count} referrals</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Missed Case Reasons
            </h3>
            {missedReasons.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No missed cases.</p>
            ) : (
              <div className="space-y-1">
                {missedReasons.map((r, i) => (
                  <div key={r.reason + i} className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-muted/50">
                    <span className="text-sm truncate pr-3">{r.reason}</span>
                    <Badge variant="destructive">{r.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: any; label: string; value: any; tone: string }) {
  const toneCls: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneCls[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-xl font-semibold leading-tight">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProcStatus({ s }: { s: Proc["procedure_status"] }) {
  if (s === "done") return <Badge className="bg-success text-success-foreground hover:bg-success">Done</Badge>;
  if (s === "not_done") return <Badge variant="destructive">Not Done</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}

function PayStatus({ s }: { s: Proc["payment_status"] }) {
  if (s === "released") return <Badge className="bg-success text-success-foreground hover:bg-success">Released</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}
