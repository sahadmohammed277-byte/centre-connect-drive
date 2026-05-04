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
import { Users, UserX, MapPin, TrendingUp, IndianRupee, AlertTriangle, Stethoscope, Activity, HeartHandshake, CheckCircle2, XCircle, Percent } from "lucide-react";
import ReferralAnalytics from "@/components/admin/ReferralAnalytics";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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
    // Realtime sync: refresh dashboard when procedures change (status, payment, inserts, deletes)
    const ch = supabase
      .channel("admin-dashboard-procedures")
      .on("postgres_changes", { event: "*", schema: "public", table: "procedures" }, () => {
        void load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "referrals" }, () => {
        void load();
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  async function load() {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const [centresRes, profilesRes, checkinsRes, visitsRes, procRes, s] = await Promise.all([
      supabase.from("centres").select("*").order("name"),
      supabase.from("profiles").select("*"),
      supabase.from("daily_checkins").select("*").eq("checkin_date", today),
      supabase.from("visits").select("user_id, visitor_type, doctor_name, visitor_name, visit_date").eq("visit_date", today),
      supabase
        .from("procedures")
        .select("user_id, procedure_type, procedure_status, estimated_value, procedure_date")
        .eq("procedure_date", today),
      fetchSettings(),
    ]);
    setSettings(s);
    setCentres(centresRes.data || []);

    const procsByUser = new Map<string, any[]>();
    ((procRes.data as any[]) || []).forEach((r) => {
      const arr = procsByUser.get(r.user_id) || [];
      arr.push(r);
      procsByUser.set(r.user_id, arr);
    });

    const built: Row[] = (profilesRes.data || []).map((p: any) => {
      const checkin = (checkinsRes.data || []).find((c: any) => c.user_id === p.user_id);
      const centre = (centresRes.data || []).find((c: any) => c.id === p.centre_id);
      const userVisits = (visitsRes.data || []).filter((v: any) => v.user_id === p.user_id);
      const userProcs = procsByUser.get(p.user_id) || [];
      // CAG/PTCA counts only procedures marked DONE
      const doneProcs = userProcs.filter((r) => r.procedure_status === "done");
      const cag = doneProcs.filter((r) => r.procedure_type === "cag").length;
      const ptca = doneProcs.filter((r) => r.procedure_type === "ptca").length;
      const revenue = doneProcs.reduce((a, r) => a + (Number(r.estimated_value) || 0), 0);
      const userRefs = userProcs; // referralCount = total procedures (referrals) for the day
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
    <div className="space-y-8">
      {/* Page heading */}
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Today's Overview</h2>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 font-normal">
          <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live
        </Badge>
      </div>

      {/* Activity section */}
      <Section title="Activity" subtitle="Real-time field & travel metrics">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Users} label="Checked In" value={`${checkedIn} / ${rows.length}`} tone="success" />
          <StatCard icon={UserX} label="Not Checked In" value={notCheckedIn} tone="destructive" />
          <StatCard icon={Activity} label="Visits Today" value={totalVisits} tone="primary" />
          <StatCard icon={MapPin} label="KM Today" value={totalKm.toFixed(1)} tone="neutral" />
        </div>
      </Section>

      {/* Business section */}
      <Section title="Business" subtitle="Procedures & revenue generated today">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Stethoscope} label="CAG Today" value={totalCag} tone="primary" />
          <StatCard icon={TrendingUp} label="PTCA Today" value={totalPtca} tone="primary" />
          <StatCard icon={IndianRupee} label="Revenue Today" value={`₹${totalRevenue.toFixed(0)}`} tone="success" />
          <StatCard icon={IndianRupee} label="TA + DA Today" value={`₹${totalAllowance.toFixed(0)}`} tone="neutral" />
        </div>
      </Section>

      {/* Referral analytics */}
      <Section title="Referrals" subtitle="All-time procedure tracking & conversion">
        <ReferralAnalytics />
      </Section>

      {/* Top performers */}
      <Section title="Top Performers">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="shadow-card border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                <TrendingUp className="h-4 w-4 text-primary" /> Top Performing Staff
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {topStaff.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No activity yet today.</p>
              ) : (
                topStaff.map((r, i) => (
                  <div key={r.profile.id} className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
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

          <Card className="shadow-card border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                <Stethoscope className="h-4 w-4 text-primary" /> Top Doctors
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {topDoctors.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No doctor visits yet today.</p>
              ) : (
                topDoctors.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent text-xs font-semibold">
                        {i + 1}
                      </div>
                      <p className="text-sm font-medium">{d.name}</p>
                    </div>
                    <PillBadge tone="neutral">{d.count} visits</PillBadge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Tables */}
      <Section title="Staff Activity">
        <Tabs defaultValue="live" className="space-y-4">
          <TabsList>
            <TabsTrigger value="live">Live Status</TabsTrigger>
            <TabsTrigger value="daily">Daily Summary</TabsTrigger>
            <TabsTrigger value="alerts">
              Alerts {allAlerts > 0 && <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-[10px]">{allAlerts}</Badge>}
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
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-10 text-xs font-medium uppercase tracking-wide text-muted-foreground">Staff</TableHead>
                    <TableHead className="h-10 text-xs font-medium uppercase tracking-wide text-muted-foreground">Centre</TableHead>
                    <TableHead className="h-10 text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</TableHead>
                    <TableHead className="h-10 text-xs font-medium uppercase tracking-wide text-muted-foreground">Check-in</TableHead>
                    <TableHead className="h-10 text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Visits</TableHead>
                    <TableHead className="h-10 text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Doctors</TableHead>
                    <TableHead className="h-10 text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">CAG</TableHead>
                    <TableHead className="h-10 text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">PTCA</TableHead>
                    <TableHead className="h-10 text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r, idx) => (
                    <TableRow
                      key={r.profile.id}
                      className={`h-11 transition-colors ${idx % 2 === 1 ? "bg-muted/30" : ""} hover:bg-primary/5`}
                    >
                      <TableCell className="py-2 font-medium">{r.profile.full_name}</TableCell>
                      <TableCell className="py-2 text-muted-foreground">{r.centre?.name || "—"}</TableCell>
                      <TableCell className="py-2">
                        {r.checkin ? (
                          <PillBadge tone="success">Checked-in</PillBadge>
                        ) : (
                          <PillBadge tone="destructive">Not checked-in</PillBadge>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground tabular-nums">
                        {r.checkin?.checkin_time
                          ? new Date(r.checkin.checkin_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </TableCell>
                      <TableCell className="py-2 text-right tabular-nums">{r.visitCount}</TableCell>
                      <TableCell className="py-2 text-right tabular-nums">{r.doctorCount}</TableCell>
                      <TableCell className="py-2 text-right tabular-nums">{r.cagCount}</TableCell>
                      <TableCell className="py-2 text-right tabular-nums">{r.ptcaCount}</TableCell>
                      <TableCell className="py-2 text-right tabular-nums font-medium">₹{r.revenue.toFixed(0)}</TableCell>
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
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-10 text-xs font-medium uppercase tracking-wide text-muted-foreground">Staff</TableHead>
                    <TableHead className="h-10 text-xs font-medium uppercase tracking-wide text-muted-foreground">Centre</TableHead>
                    <TableHead className="h-10 text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">KM</TableHead>
                    <TableHead className="h-10 text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Doctors</TableHead>
                    <TableHead className="h-10 text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Referrals</TableHead>
                    <TableHead className="h-10 text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Revenue</TableHead>
                    <TableHead className="h-10 text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">TA</TableHead>
                    <TableHead className="h-10 text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">DA</TableHead>
                    <TableHead className="h-10 text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r, idx) => {
                    const sum = calcSummary(r.checkin?.total_km ?? 0, r.doctorCount, settings);
                    return (
                      <TableRow
                        key={r.profile.id}
                        className={`h-11 transition-colors ${idx % 2 === 1 ? "bg-muted/30" : ""} hover:bg-primary/5`}
                      >
                        <TableCell className="py-2 font-medium">{r.profile.full_name}</TableCell>
                        <TableCell className="py-2 text-muted-foreground">{r.centre?.name || "—"}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums">{sum.totalKm.toFixed(1)}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums">{sum.doctorCount}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums">{r.referralCount}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums">₹{r.revenue.toFixed(0)}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums">₹{sum.ta.toFixed(0)}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums">₹{sum.da.toFixed(0)}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums font-semibold">₹{sum.total.toFixed(0)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </DataTableShell>
          </TabsContent>

          <TabsContent value="alerts">
            <Card className="shadow-card border-border/60">
              <CardContent className="p-4 space-y-2">
                {allAlerts === 0 ? (
                  <p className="text-sm text-muted-foreground py-10 text-center">All clear — no alerts.</p>
                ) : (
                  <>
                    {middayNoVisitAlerts.map((r) => (
                      <AlertRow
                        key={`mid-${r.profile.id}`}
                        tone="destructive"
                        icon={<AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                        title={r.profile.full_name}
                        message="No visits recorded yet — past midday."
                        centre={r.centre?.name}
                      />
                    ))}
                    {lowActivityAlerts.map((r) => (
                      <AlertRow
                        key={`low-${r.profile.id}`}
                        tone="warning"
                        icon={<Activity className="h-4 w-4 text-warning shrink-0" />}
                        title={r.profile.full_name}
                        message={`Low activity — only ${r.visitCount} visit(s) so far.`}
                        centre={r.centre?.name}
                      />
                    ))}
                    {daAlerts.map((r) => (
                      <AlertRow
                        key={`da-${r.profile.id}`}
                        tone="warning"
                        icon={<HeartHandshake className="h-4 w-4 text-warning shrink-0" />}
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
      </Section>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground/80 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function PillBadge({ tone, children }: { tone: "success" | "destructive" | "warning" | "neutral"; children: React.ReactNode }) {
  const map = {
    success: "bg-success/10 text-success ring-success/20",
    destructive: "bg-destructive/10 text-destructive ring-destructive/20",
    warning: "bg-warning/10 text-warning ring-warning/20",
    neutral: "bg-muted text-foreground/70 ring-border",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${map[tone]}`}>
      {children}
    </span>
  );
}

function AlertRow({ tone, icon, title, message, centre }: { tone: "destructive" | "warning"; icon: React.ReactNode; title: string; message: string; centre?: string }) {
  const cls = tone === "destructive" ? "border-destructive/20 bg-destructive/5" : "border-warning/20 bg-warning/5";
  return (
    <div className={`flex items-center gap-3 rounded-lg border ${cls} p-3`}>
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{message}</p>
      </div>
      {centre && <PillBadge tone="neutral">{centre}</PillBadge>}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: any; tone: "primary" | "success" | "destructive" | "warning" | "neutral" }) {
  const toneMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    warning: "bg-warning/10 text-warning",
    neutral: "bg-muted text-foreground/70",
  };
  return (
    <Card className="shadow-card border-border/60 hover:shadow-card-hover transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tracking-tight mt-1 truncate">{value}</p>
          </div>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneMap[tone]}`}>
            <Icon className="h-4 w-4" strokeWidth={2} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

