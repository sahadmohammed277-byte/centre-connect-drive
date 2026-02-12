import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCheckin } from "@/hooks/useCheckin";
import StartDayCard from "@/components/staff/StartDayCard";
import DailySummaryCard from "@/components/staff/DailySummaryCard";
import AddVisitDialog from "@/components/staff/AddVisitDialog";
import AddReferralDialog from "@/components/staff/AddReferralDialog";
import VisitsList from "@/components/staff/VisitsList";
import { Button } from "@/components/ui/button";
import { LogOut, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function StaffDashboard() {
  const { profile, signOut } = useAuth();
  const { todayCheckin, loading } = useCheckin();
  const [centreName, setCentreName] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (profile?.centre_id) {
      supabase
        .from("centres")
        .select("name")
        .eq("id", profile.centre_id)
        .single()
        .then(({ data }) => {
          if (data) setCentreName(data.name);
        });
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{profile?.full_name || "Staff"}</h1>
            <p className="text-xs text-muted-foreground">{centreName} · {profile?.employee_id}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 space-y-4 max-w-lg mx-auto pb-20">
        <StartDayCard />

        {todayCheckin && (
          <>
            <DailySummaryCard checkin={todayCheckin} refreshKey={refreshKey} />

            {isCheckedIn && (
              <div className="flex gap-2">
                <AddVisitDialog checkinId={todayCheckin.id} onAdded={refresh} />
                <AddReferralDialog checkinId={todayCheckin.id} onAdded={refresh} />
              </div>
            )}

            <div>
              <h2 className="text-sm font-semibold mb-2">Today's Visits</h2>
              <VisitsList checkinId={todayCheckin.id} refreshKey={refreshKey} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
