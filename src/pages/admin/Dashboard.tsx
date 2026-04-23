import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Users, UserX, MapPin, TrendingUp, IndianRupee, AlertTriangle, Stethoscope, Activity, HeartHandshake } from "lucide-react";

interface Row {
  profile: any;
  checkin: any;
  centre: any;
  visitCount: number;
  doctorCount: number;
  cagCount: number;
  ptcaCount: number;
  revenue: number;
  referralCount: number;
}

export default function AdminDashboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [centres, setCentres] = useState<any[]>([]);
  const [centreFilter, setCentreFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [topDoctors, setTopDoctors] = useState<{ name: string; count: number }[]>([]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const [centresRes, profilesRes, checkinsRes, visitsRes, refRes, s] = await Promise.all([
      supabase.from("centres").select("*").order("name"),
      supabase.from("profiles").select("*"),
      supabase.from("daily_checkins").select("*").eq("checkin_date", today),
      supabase.from("visits").select("user_id, visitor_type, doctor_name, visitor_name, visit_date").eq("visit_date", today),
      supabase
        .from("referrals")
        .select("user_id, procedure_type, patient_count, estimated_value, referral_date")
        .eq("referral_date", today),
      fetchSettings(),
    ]);
    setSettings(s);
    setCentres(centresRes.data || []);

    const refsByUser = new Map<string, any[]>();
    ((refRes.data as any[]) || []).forEach((r) => {
      const arr = refsByUser.get(r.user_id) || [];
      arr.push(r);
      refsByUser.set(r.user_id, arr);
    });

    const built: Row[] = (profilesRes.data || []).map((p: any) => {
      const checkin = (checkinsRes.data || []).find((c: any) => c.user_id === p.user_id);
      const centre = (centresRes.data || []).find((c: any) => c.id === p.centre_id);
      const userVisits = (visitsRes.data || []).filter((v: any) => v.user_id === p.user_id);
      const userRefs = refsByUser.get(p.user_id) || [];
      const cag = userRefs.filter((r) => r.procedure_type === "cag").reduce((a, r) => a + (r.patient_count || 1), 0);
      const ptca = userRefs.filter((r) => r.procedure_type === "ptca").reduce((a, r) => a + (r.patient_count || 1), 0);
      const revenue = userRefs.reduce((a, r) => a + (Number(r.estimated_value) || 0), 0);
      return {
        profile: p,
        checkin,
        centre,
        visitCount: userVisits.length,
        doctorCount: userVisits.filter((v: any) => v.visitor_type === "doctor").length,
        cagCount: cag,
        ptcaCount: ptca,
        revenue,
        referralCount: userRefs.length,
      };
    });
    setRows(built);

    // Top doctors today (by visit count)
    const docMap = new Map<string, number>();
    ((visitsRes.data as any[]) || [])
      .filter((v) => v.visitor_type === "doctor")
      .forEach((v) => {
        const name = (v.doctor_name || v.visitor_name || "Unknown").trim();
        docMap.set(name, (docMap.get(name) || 0) + 1);
      });
    const top = Array.from(docMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    setTopDoctors(top);

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
  const totalCag = rows.reduce((a, r) => a + r.cagCount, 0);
  const totalPtca = rows.reduce((a, r) => a + r.ptcaCount, 0);
  const totalRevenue = rows.reduce((a, r) => a + r.revenue, 0);
  const totalAllowance = rows.reduce((a, r) => {
    const sum = calcSummary(r.checkin?.total_km ?? 0, r.doctorCount, settings);
    return a + sum.total;
  }, 0);

  // Top performing staff by visit count today
  const topStaff = [...rows]
    .filter((r) => r.visitCount > 0 || r.revenue > 0)
    .sort((a, b) => b.visitCount - a.visitCount || b.revenue - a.revenue)
    .slice(0, 5);

  // Alerts: midday no-visits + low activity
  const now = new Date();
  const isAfterMidday = now.getHours() >= 12;
  const middayNoVisitAlerts = rows.filter((r) => r.checkin && r.visitCount === 0 && isAfterMidday);
  const lowActivityAlerts = rows.filter(
    (r) => r.checkin && r.visitCount > 0 && r.visitCount < 3
  );
  const daAlerts = rows.filter(
    (r) => r.checkin && r.doctorCount > 0 && r.doctorCount < settings.min_doctor_visits_for_da
  );
  const allAlerts = middayNoVisitAlerts.length + lowActivityAlerts.length + daAlerts.length;

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Checked In" value={`${checkedIn} / ${rows.length}`} tone="success" />
        <StatCard icon={UserX} label="Not Checked In" value={notCheckedIn} tone="destructive" />
        <StatCard icon={Activity} label="Visits Today" value={totalVisits} tone="primary" />
        <StatCard icon={MapPin} label="KM Today" value={totalKm.toFixed(1)} tone="accent" />
        <StatCard icon={Stethoscope} label="CAG Today" value={totalCag} tone="warning" />
        <StatCard icon={TrendingUp} label="PTCA Today" value={totalPtca} tone="destructive" />
        <StatCard icon={IndianRupee} label="Revenue Today" value={`₹${totalRevenue.toFixed(0)}`} tone="success" />
        <StatCard icon={IndianRupee} label="TA + DA Today" value={`₹${totalAllowance.toFixed(0)}`} tone="primary" />
      </div>

      {/* Top performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Top Performing Staff (Today)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topStaff.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No activity yet today.</p>
            ) : (
              topStaff.map((r, i) => (
                <div key={r.profile.id} className="flex items-center justify-between rounded-lg border p-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.profile.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.centre?.name || "—"}</p>
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-semibold">{r.visitCount} visits</p>
                    <p className="text-muted-foreground">₹{r.revenue.toFixed(0)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Stethoscope className="h-4 w-4" /> Top Doctors (Today)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topDoctors.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No doctor visits yet today.</p>
            ) : (
              topDoctors.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between rounded-lg border p-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent text-xs font-bold">
                      {i + 1}
                    </div>
                    <p className="text-sm font-medium">{d.name}</p>
                  </div>
                  <Badge variant="secondary">{d.count} visits</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="live" className="space-y-4">
        <TabsList>
          <TabsTrigger value="live">Live Status</TabsTrigger>
          <TabsTrigger value="daily">Daily Summary</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts {allAlerts > 0 && <Badge variant="destructive" className="ml-2">{allAlerts}</Badge>}
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
                  <TableHead>Centre</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Doctors</TableHead>
                  <TableHead className="text-right">CAG</TableHead>
                  <TableHead className="text-right">PTCA</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.profile.id}>
                    <TableCell className="font-medium">{r.profile.full_name}</TableCell>
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
                    <TableCell className="text-right">{r.cagCount}</TableCell>
                    <TableCell className="text-right">{r.ptcaCount}</TableCell>
                    <TableCell className="text-right">₹{r.revenue.toFixed(0)}</TableCell>
                  </TableRow>
                ))}
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
                  <TableHead className="text-right">Referrals</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
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
                      <TableCell className="text-right">{r.referralCount}</TableCell>
                      <TableCell className="text-right">₹{r.revenue.toFixed(0)}</TableCell>
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
              {allAlerts === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">All clear — no alerts.</p>
              ) : (
                <>
                  {middayNoVisitAlerts.map((r) => (
                    <AlertRow
                      key={`mid-${r.profile.id}`}
                      tone="destructive"
                      icon={<AlertTriangle className="h-5 w-5 text-destructive shrink-0" />}
                      title={r.profile.full_name}
                      message="No visits recorded yet — past midday."
                      centre={r.centre?.name}
                    />
                  ))}
                  {lowActivityAlerts.map((r) => (
                    <AlertRow
                      key={`low-${r.profile.id}`}
                      tone="warning"
                      icon={<Activity className="h-5 w-5 text-warning shrink-0" />}
                      title={r.profile.full_name}
                      message={`Low activity — only ${r.visitCount} visit(s) so far.`}
                      centre={r.centre?.name}
                    />
                  ))}
                  {daAlerts.map((r) => (
                    <AlertRow
                      key={`da-${r.profile.id}`}
                      tone="warning"
                      icon={<HeartHandshake className="h-5 w-5 text-warning shrink-0" />}
                      title={r.profile.full_name}
                      message={`Only ${r.doctorCount} doctor visit(s) — needs ${settings.min_doctor_visits_for_da} for DA eligibility.`}
                      centre={r.centre?.name}
                    />
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AlertRow({ tone, icon, title, message, centre }: { tone: "destructive" | "warning"; icon: React.ReactNode; title: string; message: string; centre?: string }) {
  const cls = tone === "destructive" ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5";
  return (
    <div className={`flex items-center gap-3 rounded-lg border ${cls} p-3`}>
      {icon}
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{message}</p>
      </div>
      {centre && <Badge variant="outline">{centre}</Badge>}
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
