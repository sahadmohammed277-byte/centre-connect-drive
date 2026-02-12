import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LogOut, Users, MapPin, TrendingUp, IndianRupee } from "lucide-react";
import { calculateDailySummary } from "@/lib/ta-da";

interface StaffStatus {
  profile: any;
  checkin: any;
  centre: any;
  visitCount: number;
  doctorCount: number;
}

export default function AdminDashboard() {
  const { signOut } = useAuth();
  const [staffStatuses, setStaffStatuses] = useState<StaffStatus[]>([]);
  const [centres, setCentres] = useState<any[]>([]);
  const [selectedCentre, setSelectedCentre] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    const [centresRes, profilesRes, checkinsRes, visitsRes] = await Promise.all([
      supabase.from("centres").select("*"),
      supabase.from("profiles").select("*"),
      supabase.from("daily_checkins").select("*").eq("checkin_date", today),
      supabase.from("visits").select("user_id, visitor_type, visit_date").eq("visit_date", today),
    ]);

    setCentres(centresRes.data || []);

    const statuses: StaffStatus[] = (profilesRes.data || []).map((profile) => {
      const checkin = (checkinsRes.data || []).find((c) => c.user_id === profile.user_id);
      const centre = (centresRes.data || []).find((c) => c.id === profile.centre_id);
      const userVisits = (visitsRes.data || []).filter((v) => v.user_id === profile.user_id);
      return {
        profile,
        checkin,
        centre,
        visitCount: userVisits.length,
        doctorCount: userVisits.filter((v) => v.visitor_type === "doctor").length,
      };
    });

    setStaffStatuses(statuses);
    setLoading(false);
  };

  const filtered = selectedCentre === "all"
    ? staffStatuses
    : staffStatuses.filter((s) => s.profile.centre_id === selectedCentre);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const checkedInCount = staffStatuses.filter((s) => s.checkin).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-xl font-bold">KH Referral Admin</h1>
            <p className="text-sm text-muted-foreground">Marketing Management Dashboard</p>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Checked In</p>
                  <p className="text-2xl font-bold">{checkedInCount} / {staffStatuses.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Centres</p>
                  <p className="text-2xl font-bold">{new Set(staffStatuses.filter((s) => s.checkin).map((s) => s.profile.centre_id)).size}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Visits Today</p>
                  <p className="text-2xl font-bold">{staffStatuses.reduce((a, s) => a + s.visitCount, 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
                  <IndianRupee className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total KM Today</p>
                  <p className="text-2xl font-bold">{staffStatuses.reduce((a, s) => a + (s.checkin?.total_km ?? 0), 0).toFixed(1)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Filter by Centre:</span>
          <Select value={selectedCentre} onValueChange={setSelectedCentre}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All Centres" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Centres</SelectItem>
              {centres.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Staff Table */}
        <Tabs defaultValue="live">
          <TabsList>
            <TabsTrigger value="live">Live Status</TabsTrigger>
            <TabsTrigger value="daily">Daily Summary</TabsTrigger>
          </TabsList>
          <TabsContent value="live">
            <Card>
              <CardHeader>
                <CardTitle>Staff Check-in Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead>Centre</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Check-in Time</TableHead>
                      <TableHead>Visits</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((s) => (
                      <TableRow key={s.profile.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{s.profile.full_name}</p>
                            <p className="text-xs text-muted-foreground">{s.profile.employee_id}</p>
                          </div>
                        </TableCell>
                        <TableCell>{s.centre?.name || "—"}</TableCell>
                        <TableCell>
                          {s.checkin ? (
                            <Badge variant={s.checkin.status === "checked_in" ? "default" : "secondary"}>
                              {s.checkin.status === "checked_in" ? "Active" : "Completed"}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Not checked in</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {s.checkin?.checkin_time
                            ? new Date(s.checkin.checkin_time).toLocaleTimeString()
                            : "—"}
                        </TableCell>
                        <TableCell>{s.visitCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="daily">
            <Card>
              <CardHeader>
                <CardTitle>Daily TA & DA Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead>Centre</TableHead>
                      <TableHead>KM</TableHead>
                      <TableHead>Doctor Visits</TableHead>
                      <TableHead>TA (₹)</TableHead>
                      <TableHead>DA (₹)</TableHead>
                      <TableHead>Total (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((s) => {
                      const summary = calculateDailySummary(s.checkin?.total_km ?? 0, s.doctorCount);
                      return (
                        <TableRow key={s.profile.id}>
                          <TableCell className="font-medium">{s.profile.full_name}</TableCell>
                          <TableCell>{s.centre?.name || "—"}</TableCell>
                          <TableCell>{summary.totalKm}</TableCell>
                          <TableCell>
                            {s.doctorCount}
                            {!summary.daEligible && <span className="text-destructive text-xs ml-1">(low)</span>}
                          </TableCell>
                          <TableCell>₹{summary.ta}</TableCell>
                          <TableCell>₹{summary.da}</TableCell>
                          <TableCell className="font-bold">₹{summary.total}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
