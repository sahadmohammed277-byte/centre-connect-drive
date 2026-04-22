import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTableShell } from "@/components/admin/DataTableShell";
import { fetchSettings, calcSummary, AppSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { Users, UserX, MapPin, TrendingUp, IndianRupee, AlertTriangle } from "lucide-react";

interface Row {
  profile: any;
  checkin: any;
  centre: any;
  visitCount: number;
  doctorCount: number;
}

export default function AdminDashboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [centres, setCentres] = useState<any[]>([]);
  const [centreFilter, setCentreFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const [centresRes, profilesRes, checkinsRes, visitsRes, s] = await Promise.all([
      supabase.from("centres").select("*").order("name"),
      supabase.from("profiles").select("*"),
      supabase.from("daily_checkins").select("*").eq("checkin_date", today),
      supabase.from("visits").select("user_id, visitor_type, visit_date").eq("visit_date", today),
      fetchSettings(),
    ]);
    setSettings(s);
    setCentres(centresRes.data || []);
    const built: Row[] = (profilesRes.data || []).map((p: any) => {
      const checkin = (checkinsRes.data || []).find((c: any) => c.user_id === p.user_id);
      const centre = (centresRes.data || []).find((c: any) => c.id === p.centre_id);
      const userVisits = (visitsRes.data || []).filter((v: any) => v.user_id === p.user_id);
      return {
        profile: p,
        checkin,
        centre,
        visitCount: userVisits.length,
        doctorCount: userVisits.filter((v: any) => v.visitor_type === "doctor").length,
      };
    });
    setRows(built);
    setLoading(false);
  }

  const filtered = rows
    .filter((r) => centreFilter === "all" || r.profile.centre_id === centreFilter)
    .filter((r) => {
      const q = search.toLowerCase();
      return (
        !q ||
        r.profile.full_name?.toLowerCase().includes(q) ||
        r.profile.employee_id?.toLowerCase().includes(q) ||
        r.centre?.name?.toLowerCase().includes(q)
      );
    });

  const checkedIn = rows.filter((r) => r.checkin).length;
  const notCheckedIn = rows.length - checkedIn;
  const totalVisits = rows.reduce((a, r) => a + r.visitCount, 0);
  const totalKm = rows.reduce((a, r) => a + (r.checkin?.total_km ?? 0), 0);
  const totalAllowance = rows.reduce((a, r) => {
    const sum = calcSummary(r.checkin?.total_km ?? 0, r.doctorCount, settings);
    return a + sum.total;
  }, 0);

  const alerts = rows.filter((r) => {
    if (!r.checkin) return false;
    return r.doctorCount > 0 && r.doctorCount < settings.min_doctor_visits_for_da;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Users} label="Checked In" value={`${checkedIn} / ${rows.length}`} tone="success" />
        <StatCard icon={UserX} label="Not Checked In" value={notCheckedIn} tone="destructive" />
        <StatCard icon={TrendingUp} label="Visits Today" value={totalVisits} tone="primary" />
        <StatCard icon={MapPin} label="KM Today" value={totalKm.toFixed(1)} tone="accent" />
        <StatCard icon={IndianRupee} label="TA + DA Today" value={`₹${totalAllowance.toFixed(0)}`} tone="warning" />
      </div>

      <Tabs defaultValue="live" className="space-y-4">
        <TabsList>
          <TabsTrigger value="live">Live Status</TabsTrigger>
          <TabsTrigger value="daily">Daily Summary</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts {alerts.length > 0 && <Badge variant="destructive" className="ml-2">{alerts.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live">
          <DataTableShell
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search staff…"
            isEmpty={filtered.length === 0}
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
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Centre</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Doctors</TableHead>
                  <TableHead className="text-right">KM</TableHead>
                  <TableHead>DA Eligible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const km = r.checkin?.total_km ?? 0;
                  const eligible = r.doctorCount >= settings.min_doctor_visits_for_da;
                  return (
                    <TableRow key={r.profile.id}>
                      <TableCell className="font-medium">{r.profile.full_name}</TableCell>
                      <TableCell className="font-mono text-xs">{r.profile.employee_id}</TableCell>
                      <TableCell>{r.centre?.name || "—"}</TableCell>
                      <TableCell>
                        {r.checkin ? (
                          <Badge className="bg-success text-success-foreground hover:bg-success">Checked-in</Badge>
                        ) : (
                          <Badge variant="destructive">Not checked-in</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.checkin?.checkin_time
                          ? new Date(r.checkin.checkin_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">{r.visitCount}</TableCell>
                      <TableCell className="text-right">{r.doctorCount}</TableCell>
                      <TableCell className="text-right">{km.toFixed(1)}</TableCell>
                      <TableCell>
                        {eligible ? (
                          <Badge className="bg-success text-success-foreground hover:bg-success">Yes</Badge>
                        ) : (
                          <Badge variant="outline">No</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </DataTableShell>
        </TabsContent>

        <TabsContent value="daily">
          <DataTableShell
            searchValue={search}
            onSearchChange={setSearch}
            isEmpty={filtered.length === 0}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Centre</TableHead>
                  <TableHead className="text-right">KM</TableHead>
                  <TableHead className="text-right">Doctors</TableHead>
                  <TableHead className="text-right">TA</TableHead>
                  <TableHead className="text-right">DA</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const sum = calcSummary(r.checkin?.total_km ?? 0, r.doctorCount, settings);
                  return (
                    <TableRow key={r.profile.id}>
                      <TableCell className="font-medium">{r.profile.full_name}</TableCell>
                      <TableCell>{r.centre?.name || "—"}</TableCell>
                      <TableCell className="text-right">{sum.totalKm.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{sum.doctorCount}</TableCell>
                      <TableCell className="text-right">₹{sum.ta.toFixed(0)}</TableCell>
                      <TableCell className="text-right">₹{sum.da.toFixed(0)}</TableCell>
                      <TableCell className="text-right font-semibold">₹{sum.total.toFixed(0)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </DataTableShell>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardContent className="p-6 space-y-3">
              {alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">All clear — no alerts.</p>
              ) : (
                alerts.map((r) => (
                  <div key={r.profile.id} className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
                    <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{r.profile.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Only {r.doctorCount} doctor visit(s) — needs {settings.min_doctor_visits_for_da} for DA eligibility
                      </p>
                    </div>
                    <Badge variant="outline">{r.centre?.name}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: any) {
  const toneMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    accent: "bg-accent/10 text-accent",
    warning: "bg-warning/10 text-warning",
  };
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneMap[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold truncate">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
