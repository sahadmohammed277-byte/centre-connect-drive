import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Activity, Clock, HeartHandshake, Stethoscope, IndianRupee, TrendingUp } from "lucide-react";

interface Props {
  checkinId: string;
  refreshKey?: number;
}

interface Stats {
  totalVisits: number;
  workingMinutes: number;
  totalReferrals: number;
  cagCount: number;
  ptcaCount: number;
  totalRevenue: number;
}

function formatHours(mins: number) {
  if (mins <= 0) return "0h";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export default function PerformanceCard({ checkinId, refreshKey }: Props) {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalVisits: 0,
    workingMinutes: 0,
    totalReferrals: 0,
    cagCount: 0,
    ptcaCount: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [visitsRes, refRes] = await Promise.all([
        supabase.from("visits").select("checkin_time, checkout_time").eq("checkin_id", checkinId),
        supabase
          .from("referrals")
          .select("procedure_type, patient_count, estimated_value")
          .eq("checkin_id", checkinId),
      ]);

      const visits = visitsRes.data || [];
      let workingMinutes = 0;
      visits.forEach((v: any) => {
        if (v.checkin_time && v.checkout_time) {
          workingMinutes += Math.max(
            0,
            Math.round((new Date(v.checkout_time).getTime() - new Date(v.checkin_time).getTime()) / 60000)
          );
        }
      });

      const refs = (refRes.data || []) as any[];
      const cag = refs
        .filter((r) => r.procedure_type === "cag")
        .reduce((a, r) => a + (r.patient_count || 1), 0);
      const ptca = refs
        .filter((r) => r.procedure_type === "ptca")
        .reduce((a, r) => a + (r.patient_count || 1), 0);
      const revenue = refs.reduce((a, r) => a + (Number(r.estimated_value) || 0), 0);

      setStats({
        totalVisits: visits.length,
        workingMinutes,
        totalReferrals: refs.length,
        cagCount: cag,
        ptcaCount: ptca,
        totalRevenue: revenue,
      });
    })();
  }, [checkinId, user, refreshKey]);

  const tiles = [
    { icon: Activity, label: "Visits", value: stats.totalVisits, tone: "primary" },
    { icon: Clock, label: "Hours", value: formatHours(stats.workingMinutes), tone: "accent" },
    { icon: HeartHandshake, label: "Referrals", value: stats.totalReferrals, tone: "success" },
    { icon: Stethoscope, label: "CAG", value: stats.cagCount, tone: "warning" },
    { icon: TrendingUp, label: "PTCA", value: stats.ptcaCount, tone: "destructive" },
    { icon: IndianRupee, label: "Revenue", value: `₹${stats.totalRevenue.toFixed(0)}`, tone: "primary" },
  ];

  const toneMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    accent: "bg-accent/10 text-accent",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Today's Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-lg border p-3 space-y-1">
              <div className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${toneMap[t.tone]}`}>
                <t.icon className="h-4 w-4" />
              </div>
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className="text-base font-bold truncate">{t.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
