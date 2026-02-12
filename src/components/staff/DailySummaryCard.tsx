import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DailyCheckin } from "@/hooks/useCheckin";
import { calculateDailySummary, MIN_DOCTOR_VISITS_FOR_DA } from "@/lib/ta-da";
import { IndianRupee, Car, Stethoscope } from "lucide-react";

interface Props {
  checkin: DailyCheckin;
  refreshKey?: number;
}

export default function DailySummaryCard({ checkin, refreshKey }: Props) {
  const { user } = useAuth();
  const [doctorCount, setDoctorCount] = useState(0);
  const [totalVisits, setTotalVisits] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("visits")
        .select("visitor_type")
        .eq("checkin_id", checkin.id);
      if (data) {
        setTotalVisits(data.length);
        setDoctorCount(data.filter((v) => v.visitor_type === "doctor").length);
      }
    };
    fetch();
  }, [checkin.id, user, refreshKey]);

  const summary = calculateDailySummary(checkin.total_km ?? 0, doctorCount);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Today's Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <Car className="h-3 w-3" /> KM Travelled
            </div>
            <p className="text-xl font-bold">{summary.totalKm}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <Stethoscope className="h-3 w-3" /> Doctor Visits
            </div>
            <p className="text-xl font-bold">
              {doctorCount}
              <span className="text-sm font-normal text-muted-foreground"> / {totalVisits} total</span>
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <IndianRupee className="h-3 w-3" /> TA (₹4/km)
            </div>
            <p className="text-xl font-bold">₹{summary.ta}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground text-xs">
              <IndianRupee className="h-3 w-3" /> DA (₹150/km)
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold">₹{summary.da}</p>
              {!summary.daEligible && (
                <Badge variant="secondary" className="text-xs">
                  Need {MIN_DOCTOR_VISITS_FOR_DA - doctorCount} more Dr visits
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Total Allowance</span>
            <span className="text-2xl font-bold text-primary">₹{summary.total}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
