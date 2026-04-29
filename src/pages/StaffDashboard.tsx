import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCheckin } from "@/hooks/useCheckin";
import StartDayCard from "@/components/staff/StartDayCard";
import IndividualSummary from "@/components/staff/IndividualSummary";
import AddVisitDialog from "@/components/staff/AddVisitDialog";
import AddProcedureDialog from "@/components/staff/AddProcedureDialog";
import AddLeaveDialog from "@/components/staff/AddLeaveDialog";
import VisitsList from "@/components/staff/VisitsList";
import ProceduresList from "@/components/staff/ProceduresList";
import PaymentsSummary from "@/components/staff/PaymentsSummary";
import LeaveList from "@/components/staff/LeaveList";
import ActivityFeed from "@/components/staff/ActivityFeed";
import WeeklySummary from "@/components/staff/WeeklySummary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Bell, LayoutDashboard, Stethoscope, HeartHandshake, Wallet, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function StaffDashboard() {
  const { profile, signOut } = useAuth();
  const { todayCheckin, loading } = useCheckin();
  const [centreName, setCentreName] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [referralFilter, setReferralFilter] = useState<"all" | "pending" | "done" | "not_done">("all");

  useEffect(() => {
    if (profile?.centre_id) {
      supabase
        .from("centres")
        .select("name")
        .eq("id", profile.centre_id)
        .single()
        .then(({ data }) => { if (data) setCentreName(data.name); });
    }
  }, [profile?.centre_id]);

  const refresh = () => setRefreshKey((k) => k + 1);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const isCheckedIn = todayCheckin && todayCheckin.status === "checked_in";

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="min-w-0">
            <h1 className="text-base font-bold truncate">{profile?.full_name || "Staff"}</h1>
            <p className="text-xs text-muted-foreground truncate">
              {centreName || "—"} · {profile?.employee_id}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon"><Bell className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-5 w-5" /></Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-24">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-4">
            <TabsTrigger value="dashboard" className="flex flex-col items-center gap-0.5 py-2 text-[11px]">
              <LayoutDashboard className="h-4 w-4" /> Home
            </TabsTrigger>
            <TabsTrigger value="visits" className="flex flex-col items-center gap-0.5 py-2 text-[11px]">
              <Stethoscope className="h-4 w-4" /> Visits
            </TabsTrigger>
            <TabsTrigger value="referrals" className="flex flex-col items-center gap-0.5 py-2 text-[11px]">
              <HeartHandshake className="h-4 w-4" /> Referrals
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex flex-col items-center gap-0.5 py-2 text-[11px]">
              <Wallet className="h-4 w-4" /> Payments
            </TabsTrigger>
            <TabsTrigger value="leave" className="flex flex-col items-center gap-0.5 py-2 text-[11px]">
              <CalendarDays className="h-4 w-4" /> Leave
            </TabsTrigger>
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="space-y-4 mt-0">
            <StartDayCard />
            <IndividualSummary refreshKey={refreshKey} />
            <WeeklySummary refreshKey={refreshKey} />
            <div>
              <h2 className="text-sm font-semibold mb-2">Today's Activity</h2>
              <ActivityFeed refreshKey={refreshKey} />
            </div>
          </TabsContent>

          {/* Visits */}
          <TabsContent value="visits" className="space-y-4 mt-0">
            {isCheckedIn ? (
              <div className="flex justify-end">
                <AddVisitDialog checkinId={todayCheckin.id} onAdded={refresh} />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-3 text-center">
                Start your day to add visits.
              </p>
            )}
            {todayCheckin && (
              <div>
                <h2 className="text-sm font-semibold mb-2">Today's Visits</h2>
                <VisitsList checkinId={todayCheckin.id} refreshKey={refreshKey} />
              </div>
            )}
          </TabsContent>

          {/* Referrals */}
          <TabsContent value="referrals" className="space-y-3 mt-0">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">My Referrals</h2>
              <AddProcedureDialog checkinId={todayCheckin?.id} onAdded={refresh} />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(["all", "pending", "done", "not_done"] as const).map((f) => (
                <Badge
                  key={f}
                  onClick={() => setReferralFilter(f)}
                  className={`cursor-pointer ${
                    referralFilter === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {f === "not_done" ? "Not Done" : f.charAt(0).toUpperCase() + f.slice(1)}
                </Badge>
              ))}
            </div>
            <ProceduresList refreshKey={refreshKey} onChanged={refresh} filter={referralFilter} />
          </TabsContent>

          {/* Payments */}
          <TabsContent value="payments" className="space-y-3 mt-0">
            <h2 className="text-sm font-semibold">Payments</h2>
            <p className="text-xs text-muted-foreground">Only referrals with completed procedures are payable.</p>
            <PaymentsSummary refreshKey={refreshKey} onChanged={refresh} />
          </TabsContent>

          {/* Leave */}
          <TabsContent value="leave" className="space-y-4 mt-0">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Leave Requests</h2>
              <AddLeaveDialog onAdded={refresh} />
            </div>
            <LeaveList refreshKey={refreshKey} onChanged={refresh} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
