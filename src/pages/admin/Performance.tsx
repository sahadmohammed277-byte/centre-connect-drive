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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { DataTableShell } from "@/components/admin/DataTableShell";
import {
  Calendar as CalendarIcon, Users, Stethoscope, Building2, BookUser,
  FileSpreadsheet, TrendingUp, Percent,
} from "lucide-react";
import { DATE_RANGE_PRESETS, getPresetDates, detectPreset, todayISO } from "@/lib/date-range";

type Visit = {
  id: string;
  user_id: string;
  centre_id: string;
  visit_date: string;
  visitor_type: string;
  visitor_name: string | null;
  doctor_name: string | null;
  place: string | null;
  contact_number: string | null;
  purpose: string | null;
  designation: string | null;
};

type Proc = {
  id: string;
  user_id: string;
  centre_id: string;
  doctor_name: string | null;
  patient_name: string;
  procedure_type: string;
  procedure_date: string;
  procedure_status: "pending" | "done" | "not_done";
  payment_status: "pending" | "released";
  not_done_reason: string | null;
  phone_number?: string | null;
};

const VISITOR_TYPES = ["doctor", "ambulance", "hospital", "lab", "kol", "pharmacy", "other"];

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  } catch { return d; }
}
function csvCell(v: any) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function normKey(name: string | null, type: string) {
  return `${(name || "").trim().toLowerCase()}|${type}`;
}

export default function PerformancePage() {
  const [fromDate, setFromDate] = useState(() => getPresetDates("last7").from);
  const [toDate, setToDate] = useState(todayISO());
  const [centreFilter, setCentreFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [centres, setCentres] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [procs, setProcs] = useState<Proc[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState<{ key: string; name: string; type: string } | null>(null);

  useEffect(() => { void loadMeta(); }, []);
  useEffect(() => { void loadData(); }, [fromDate, toDate]);

  async function loadMeta() {
    const [c, p] = await Promise.all([
      supabase.from("centres").select("id, name").order("name"),
      supabase.from("profiles").select("user_id, full_name, centre_id"),
    ]);
    setCentres(c.data || []);
    setProfiles(p.data || []);
  }

  async function loadData() {
    setLoading(true);
    const start = fromDate <= toDate ? fromDate : toDate;
    const end = fromDate <= toDate ? toDate : fromDate;
    const [v, pr] = await Promise.all([
      supabase.from("visits")
        .select("id, user_id, centre_id, visit_date, visitor_type, visitor_name, doctor_name, place, contact_number, purpose, designation")
        .gte("visit_date", start).lte("visit_date", end)
        .order("visit_date", { ascending: false }),
      supabase.from("procedures")
        .select("id, user_id, centre_id, doctor_name, patient_name, procedure_type, procedure_date, procedure_status, payment_status, not_done_reason, phone_number")
        .gte("procedure_date", start).lte("procedure_date", end),
    ]);
    setVisits(((v.data as any) || []) as Visit[]);
    setProcs(((pr.data as any) || []) as Proc[]);
    setLoading(false);
  }

  const activePreset = useMemo(() => detectPreset(fromDate, toDate), [fromDate, toDate]);
  function applyPreset(preset: Exclude<ReturnType<typeof detectPreset>, "custom">) {
    const { from, to } = getPresetDates(preset);
    setFromDate(from); setToDate(to);
  }

  const staffName = (uid: string) => profiles.find((p) => p.user_id === uid)?.full_name || "—";
  const centreName = (cid: string) => centres.find((c) => c.id === cid)?.name || "—";

  // Filter base
  const fVisits = useMemo(() => visits.filter((v) =>
    (centreFilter === "all" || v.centre_id === centreFilter) &&
    (staffFilter === "all" || v.user_id === staffFilter) &&
    (typeFilter === "all" || v.visitor_type === typeFilter)
  ), [visits, centreFilter, staffFilter, typeFilter]);

  const fProcs = useMemo(() => procs.filter((p) =>
    (centreFilter === "all" || p.centre_id === centreFilter) &&
    (staffFilter === "all" || p.user_id === staffFilter)
  ), [procs, centreFilter, staffFilter]);

  // === Aggregate main table (per visitor) ===
  type Row = {
    key: string;
    name: string;
    type: string;
    place: string;
    centreId: string;
    staffIds: Set<string>;
    dates: string[];
    referrals: number;
    cag: number;
    ptca: number;
    done: number;
    lastVisit: string;
  };
  const perVisitor = useMemo(() => {
    const map = new Map<string, Row>();
    fVisits.forEach((v) => {
      const name = (v.visitor_type === "doctor" ? v.doctor_name : v.visitor_name) || v.visitor_name || v.doctor_name || "Unknown";
      const key = normKey(name, v.visitor_type);
      const row = map.get(key) || {
        key, name, type: v.visitor_type, place: v.place || "",
        centreId: v.centre_id, staffIds: new Set<string>(),
        dates: [], referrals: 0, cag: 0, ptca: 0, done: 0, lastVisit: v.visit_date,
      };
      row.staffIds.add(v.user_id);
      row.dates.push(v.visit_date);
      if (!row.place && v.place) row.place = v.place;
      if (v.visit_date > row.lastVisit) row.lastVisit = v.visit_date;
      map.set(key, row);
    });
    // attach procedure counts by doctor_name
    fProcs.forEach((p) => {
      if (!p.doctor_name) return;
      const key = normKey(p.doctor_name, "doctor");
      const row = map.get(key);
      if (!row) return;
      row.referrals += 1;
      if (p.procedure_type === "CAG") row.cag += 1;
      if (p.procedure_type === "PTCA") row.ptca += 1;
      if (p.procedure_status === "done") row.done += 1;
    });
    let arr = Array.from(map.values());
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter((r) =>
        r.name.toLowerCase().includes(q) ||
        r.place.toLowerCase().includes(q)
      );
    }
    return arr.sort((a, b) => b.dates.length - a.dates.length);
  }, [fVisits, fProcs, search]);

  // === Doctors ranking ===
  const topDoctors = useMemo(() => {
    return perVisitor.filter((r) => r.type === "doctor")
      .sort((a, b) => b.referrals - a.referrals || b.dates.length - a.dates.length)
      .slice(0, 20);
  }, [perVisitor]);

  // === Staff performance ===
  const staffPerf = useMemo(() => {
    const map = new Map<string, { uid: string; visits: number; doctors: Set<string>; refs: number; cag: number; ptca: number; done: number }>();
    fVisits.forEach((v) => {
      const s = map.get(v.user_id) || { uid: v.user_id, visits: 0, doctors: new Set<string>(), refs: 0, cag: 0, ptca: 0, done: 0 };
      s.visits += 1;
      if (v.visitor_type === "doctor" && v.doctor_name) s.doctors.add(v.doctor_name.trim().toLowerCase());
      map.set(v.user_id, s);
    });
    fProcs.forEach((p) => {
      const s = map.get(p.user_id) || { uid: p.user_id, visits: 0, doctors: new Set<string>(), refs: 0, cag: 0, ptca: 0, done: 0 };
      s.refs += 1;
      if (p.procedure_type === "CAG") s.cag += 1;
      if (p.procedure_type === "PTCA") s.ptca += 1;
      if (p.procedure_status === "done") s.done += 1;
      map.set(p.user_id, s);
    });
    return Array.from(map.values()).sort((a, b) => b.refs - a.refs);
  }, [fVisits, fProcs]);

  // === Place performance ===
  const placePerf = useMemo(() => {
    const map = new Map<string, { place: string; visits: number; doctors: Set<string>; staff: Set<string>; refs: number; cag: number; ptca: number }>();
    fVisits.forEach((v) => {
      const key = (v.place || "").trim();
      if (!key) return;
      const p = map.get(key.toLowerCase()) || { place: key, visits: 0, doctors: new Set<string>(), staff: new Set<string>(), refs: 0, cag: 0, ptca: 0 };
      p.visits += 1;
      p.staff.add(v.user_id);
      if (v.visitor_type === "doctor" && v.doctor_name) p.doctors.add(v.doctor_name.trim().toLowerCase());
      map.set(key.toLowerCase(), p);
    });
    // Attach referrals via doctor->place lookup
    const docToPlace = new Map<string, string>();
    fVisits.forEach((v) => {
      if (v.visitor_type === "doctor" && v.doctor_name && v.place) {
        docToPlace.set(v.doctor_name.trim().toLowerCase(), v.place.trim().toLowerCase());
      }
    });
    fProcs.forEach((pr) => {
      if (!pr.doctor_name) return;
      const placeKey = docToPlace.get(pr.doctor_name.trim().toLowerCase());
      if (!placeKey) return;
      const p = map.get(placeKey);
      if (!p) return;
      p.refs += 1;
      if (pr.procedure_type === "CAG") p.cag += 1;
      if (pr.procedure_type === "PTCA") p.ptca += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.visits - a.visits);
  }, [fVisits, fProcs]);

  // === Directory (all-time via master fetch on demand — for now uses filtered range) ===
  const directory = useMemo(() => {
    const map = new Map<string, { name: string; type: string; place: string; phone: string; count: number }>();
    fVisits.forEach((v) => {
      const name = (v.visitor_type === "doctor" ? v.doctor_name : v.visitor_name) || "";
      if (!name) return;
      const key = normKey(name, v.visitor_type);
      const d = map.get(key) || { name, type: v.visitor_type, place: v.place || "", phone: v.contact_number || "", count: 0 };
      d.count += 1;
      if (!d.phone && v.contact_number) d.phone = v.contact_number;
      if (!d.place && v.place) d.place = v.place;
      map.set(key, d);
    });
    let arr = Array.from(map.values());
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter((d) => d.name.toLowerCase().includes(q) || d.place.toLowerCase().includes(q));
    }
    return arr.sort((a, b) => b.count - a.count);
  }, [fVisits, search]);

  // KPIs
  const totalVisits = fVisits.length;
  const uniqueDoctors = new Set(fVisits.filter(v => v.visitor_type === "doctor" && v.doctor_name).map(v => v.doctor_name!.trim().toLowerCase())).size;
  const totalRefs = fProcs.length;
  const doneRefs = fProcs.filter(p => p.procedure_status === "done").length;
  const conv = totalRefs > 0 ? Math.round((doneRefs / totalRefs) * 100) : 0;

  function exportCSV() {
    const headers = ["Visitor Name", "Type", "Place", "Centre", "Staff", "Visits", "Dates", "Referrals", "CAG", "PTCA", "Last Visit", "Conversion %"];
    const lines = [headers.join(",")];
    perVisitor.forEach((r) => {
      const conv = r.referrals > 0 ? Math.round((r.done / r.referrals) * 100) : 0;
      const staff = Array.from(r.staffIds).map(staffName).join("; ");
      lines.push([
        r.name, r.type, r.place, centreName(r.centreId), staff,
        r.dates.length, r.dates.join("; "), r.referrals, r.cag, r.ptca, r.lastVisit, `${conv}%`,
      ].map(csvCell).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `performance_${fromDate}_${toDate}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  // Drawer detail
  const drawerData = useMemo(() => {
    if (!drawer) return null;
    const vList = visits.filter((v) => normKey(
      v.visitor_type === "doctor" ? v.doctor_name : v.visitor_name, v.visitor_type
    ) === drawer.key);
    const pList = drawer.type === "doctor"
      ? procs.filter((p) => (p.doctor_name || "").trim().toLowerCase() === drawer.name.trim().toLowerCase())
      : [];
    return { vList, pList };
  }, [drawer, visits, procs]);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi icon={Users} label="Total Visits" value={totalVisits} tone="primary" />
        <Kpi icon={Stethoscope} label="Doctors Covered" value={uniqueDoctors} tone="primary" />
        <Kpi icon={TrendingUp} label="Referrals" value={totalRefs} tone="success" />
        <Kpi icon={TrendingUp} label="Done" value={doneRefs} tone="success" />
        <Kpi icon={Percent} label="Conversion" value={`${conv}%`} tone="primary" />
      </div>

      <DataTableShell
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name or place…"
        isEmpty={false}
        actions={
          <Button size="sm" variant="outline" onClick={exportCSV}>
            <FileSpreadsheet className="h-4 w-4" /> Export
          </Button>
        }
        filters={
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">From</Label>
              <div className="relative">
                <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-[160px] pl-9" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">To</Label>
              <div className="relative">
                <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} className="w-[160px] pl-9" />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-1">
              {DATE_RANGE_PRESETS.map(({ value, label }) => (
                <Button key={value} size="sm"
                  variant={activePreset === value ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => { if (value !== "custom") applyPreset(value); }}
                >{label}</Button>
              ))}
            </div>
            <Select value={centreFilter} onValueChange={setCentreFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Centres</SelectItem>
                {centres.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={staffFilter} onValueChange={setStaffFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
                {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {VISITOR_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      >
        <Tabs defaultValue="overview">
          <div className="border-b px-4">
            <TabsList className="bg-transparent p-0 h-auto">
              <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Overview</TabsTrigger>
              <TabsTrigger value="doctors" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Top Doctors</TabsTrigger>
              <TabsTrigger value="staff" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Staff</TabsTrigger>
              <TabsTrigger value="places" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Places</TabsTrigger>
              <TabsTrigger value="directory" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Directory</TabsTrigger>
            </TabsList>
          </div>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="m-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Visitor</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Place</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead className="text-right">Visits</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead className="text-right">Refs</TableHead>
                    <TableHead className="text-right">CAG</TableHead>
                    <TableHead className="text-right">PTCA</TableHead>
                    <TableHead>Last</TableHead>
                    <TableHead className="text-right">Conv%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perVisitor.length === 0 ? (
                    <TableRow><TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                      {loading ? "Loading…" : "No data in this range."}
                    </TableCell></TableRow>
                  ) : perVisitor.map((r) => {
                    const conv = r.referrals > 0 ? Math.round((r.done / r.referrals) * 100) : 0;
                    return (
                      <TableRow key={r.key} className="cursor-pointer hover:bg-muted/40"
                        onClick={() => setDrawer({ key: r.key, name: r.name, type: r.type })}>
                        <TableCell className="font-medium">{r.type === "doctor" ? `Dr. ${r.name}` : r.name}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{r.type}</Badge></TableCell>
                        <TableCell className="text-xs">{r.place || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {Array.from(r.staffIds).slice(0, 2).map(staffName).join(", ")}
                          {r.staffIds.size > 2 ? ` +${r.staffIds.size - 2}` : ""}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{r.dates.length}</TableCell>
                        <TableCell className="text-xs max-w-[180px] truncate" title={r.dates.map(fmtDate).join(", ")}>
                          {r.dates.slice(0, 3).map(fmtDate).join(", ")}{r.dates.length > 3 ? "…" : ""}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.referrals}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.cag}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.ptca}</TableCell>
                        <TableCell className="text-xs">{fmtDate(r.lastVisit)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.referrals > 0 ? <Badge variant={conv >= 50 ? "default" : "secondary"}>{conv}%</Badge> : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* DOCTORS */}
          <TabsContent value="doctors" className="m-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Hospital</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Referrals</TableHead>
                  <TableHead className="text-right">CAG</TableHead>
                  <TableHead className="text-right">PTCA</TableHead>
                  <TableHead className="text-right">Conv%</TableHead>
                  <TableHead>Last Visit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topDoctors.map((d, i) => {
                  const conv = d.referrals > 0 ? Math.round((d.done / d.referrals) * 100) : 0;
                  return (
                    <TableRow key={d.key}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">Dr. {d.name}</TableCell>
                      <TableCell className="text-xs">{d.place || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.dates.length}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.referrals}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.cag}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.ptca}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.referrals > 0 ? `${conv}%` : "—"}</TableCell>
                      <TableCell className="text-xs">{fmtDate(d.lastVisit)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TabsContent>

          {/* STAFF */}
          <TabsContent value="staff" className="m-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead className="text-right">Doctors Covered</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Referrals</TableHead>
                  <TableHead className="text-right">CAG</TableHead>
                  <TableHead className="text-right">PTCA</TableHead>
                  <TableHead className="text-right">Avg Visits/Doc</TableHead>
                  <TableHead className="text-right">Conv%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffPerf.map((s) => {
                  const conv = s.refs > 0 ? Math.round((s.done / s.refs) * 100) : 0;
                  const avg = s.doctors.size > 0 ? (s.visits / s.doctors.size).toFixed(1) : "—";
                  return (
                    <TableRow key={s.uid}>
                      <TableCell className="font-medium">{staffName(s.uid)}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.doctors.size}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.visits}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.refs}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.cag}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.ptca}</TableCell>
                      <TableCell className="text-right tabular-nums">{avg}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.refs > 0 ? `${conv}%` : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TabsContent>

          {/* PLACES */}
          <TabsContent value="places" className="m-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hospital / Place</TableHead>
                  <TableHead>Visited By</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Doctors</TableHead>
                  <TableHead className="text-right">Referrals</TableHead>
                  <TableHead className="text-right">CAG</TableHead>
                  <TableHead className="text-right">PTCA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {placePerf.map((p) => (
                  <TableRow key={p.place}>
                    <TableCell className="font-medium">{p.place}</TableCell>
                    <TableCell className="text-xs">
                      {Array.from(p.staff).slice(0, 3).map(staffName).join(", ")}
                      {p.staff.size > 3 ? ` +${p.staff.size - 3}` : ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.visits}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.doctors.size}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.refs}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.cag}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.ptca}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          {/* DIRECTORY */}
          <TabsContent value="directory" className="m-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Place</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {directory.map((d) => (
                  <TableRow key={d.name + d.type}>
                    <TableCell className="font-medium">{d.type === "doctor" ? `Dr. ${d.name}` : d.name}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{d.type}</Badge></TableCell>
                    <TableCell className="text-xs">{d.place || "—"}</TableCell>
                    <TableCell className="text-xs">{d.phone || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </DataTableShell>

      {/* Drawer */}
      <Sheet open={!!drawer} onOpenChange={(o) => !o && setDrawer(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{drawer?.type === "doctor" ? `Dr. ${drawer?.name}` : drawer?.name}</SheetTitle>
          </SheetHeader>
          {drawerData && (
            <div className="mt-4 space-y-6">
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Contact</h4>
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">Type:</span> <span className="capitalize">{drawer?.type}</span></p>
                  <p><span className="text-muted-foreground">Place:</span> {drawerData.vList.find(v => v.place)?.place || "—"}</p>
                  <p><span className="text-muted-foreground">Phone:</span> {drawerData.vList.find(v => v.contact_number)?.contact_number || "—"}</p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Visit History ({drawerData.vList.length})
                </h4>
                <div className="space-y-2">
                  {drawerData.vList.map((v) => (
                    <div key={v.id} className="rounded-md border p-2 text-xs">
                      <div className="flex justify-between">
                        <span className="font-medium">{fmtDate(v.visit_date)}</span>
                        <span className="text-muted-foreground">{staffName(v.user_id)}</span>
                      </div>
                      {v.purpose && <p className="text-muted-foreground mt-1">Purpose: {v.purpose}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {drawer?.type === "doctor" && (
                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                    Referrals ({drawerData.pList.length})
                  </h4>
                  <div className="space-y-2">
                    {drawerData.pList.length === 0 && <p className="text-xs text-muted-foreground">No referrals in this range.</p>}
                    {drawerData.pList.map((p) => (
                      <div key={p.id} className="rounded-md border p-2 text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{p.patient_name}</p>
                            <p className="text-muted-foreground">{fmtDate(p.procedure_date)} · {p.procedure_type}</p>
                          </div>
                          <div className="flex flex-col gap-1 items-end">
                            <Badge variant={p.procedure_status === "done" ? "default" : p.procedure_status === "not_done" ? "destructive" : "secondary"} className="capitalize">
                              {p.procedure_status.replace("_", " ")}
                            </Badge>
                            <Badge variant="outline" className="capitalize">{p.payment_status}</Badge>
                          </div>
                        </div>
                        {p.not_done_reason && <p className="text-destructive mt-1">Reason: {p.not_done_reason}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
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
    <Card className="border-border/60 h-[112px]">
      <CardContent className="p-4 flex items-center gap-3 h-full">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${toneCls[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
