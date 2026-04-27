import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Activity, Stethoscope, HeartPulse, Car, IndianRupee, TrendingUp } from "lucide-react";
import { calculateDailySummary, TA_RATE_PER_KM, DA_RATE_PER_KM, MIN_DOCTOR_VISITS_FOR_DA } from "@/lib/ta-da";

interface Props { refreshKey?: number; }

interface Counts {
  todayVisits: number;
  doctorVisits: number;
  cag: number;
  ptca: number;
  todayKm: number;
  taToday: number;
  daToday: number;
  taMonth: number;
  daMonth: number;
}

const iconBox = (Icon: any, tone: string) => (
  <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
    <Icon className="h-4 w-4" />
  </div>
);

function Tile({ icon, tone, label, value, sub }: { icon: any; tone: string; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-3 space-y-1.5">
        {iconBox(icon, tone)}
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function IndividualSummary({ refreshKey }: Props) {
  const { user } = useAuth();
  const [c, setC] = useState<Counts>({
    todayVisits: 0, doctorVisits: 0, cag: 0, ptca: 0,
    todayKm: 0, taToday: 0, daToday: 0, taMonth: 0, daMonth: 0,
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const monthStart = today.slice(0, 7) + "-01";

      const [todayCheckinRes, monthCheckinsRes, todayVisitsRes, monthProcsRes] = await Promise.all([
        supabase.from("daily_checkins").select("id, total_km").eq("user_id", user.id).eq("checkin_date", today).maybeSingle(),
        supabase.from("daily_checkins").select("id, total_km, checkin_date").eq("user_id", user.id).gte("checkin_date", monthStart),
        // visits today
        supabase.from("visits").select("visitor_type").eq("user_id", user.id).eq("visit_date", today),
        supabase.from("procedures").select("procedure_type, procedure_date").eq("user_id", user.id).gte("procedure_date", monthStart),
      ]);

      const todayKm = Number(todayCheckinRes.data?.total_km ?? 0);
      const todayVisits = (todayVisitsRes.data || []).length;
      const doctorVisits = (todayVisitsRes.data || []).filter((v: any) => v.visitor_type === "doctor").length;

      const procs = (monthProcsRes.data || []) as any[];
      const cag = procs.filter((p) => p.procedure_type === "cag").length;
      const ptca = procs.filter((p) => p.procedure_type === "ptca").length;

      const todaySum = calculateDailySummary(todayKm, doctorVisits);

      // Month TA/DA: needs per-day doctor visit count to know DA eligibility
      const checkins = (monthCheckinsRes.data || []) as any[];
      let taMonth = 0;
      let daMonth = 0;
      if (checkins.length) {
        const ids = checkins.map((x) => x.id);
        const { data: monthVisits } = await supabase
          .from("visits")
          .select("checkin_id, visitor_type")
          .in("checkin_id", ids);
        const docPerCheckin: Record<string, number> = {};
        (monthVisits || []).forEach((v: any) => {
          if (v.visitor_type === "doctor") docPerCheckin[v.checkin_id] = (docPerCheckin[v.checkin_id] || 0) + 1;
        });
        for (const ck of checkins) {
          const km = Number(ck.total_km ?? 0);
          taMonth += km * TA_RATE_PER_KM;
          if ((docPerCheckin[ck.id] || 0) >= MIN_DOCTOR_VISITS_FOR_DA) daMonth += km * DA_RATE_PER_KM;
        }
      }

      setC({
        todayVisits, doctorVisits, cag, ptca,
        todayKm, taToday: todaySum.ta, daToday: todaySum.da,
        taMonth, daMonth,
      });
    })();
  }, [user, refreshKey]);

  return (
    <div className="grid grid-cols-2 gap-3">
      <Tile icon={Activity} tone="bg-primary/10 text-primary" label="Today Visits" value={c.todayVisits} />
      <Tile icon={Stethoscope} tone="bg-accent/15 text-accent" label="Doctor Visits" value={c.doctorVisits} sub="Today" />
      <Tile icon={HeartPulse} tone="bg-warning/15 text-warning" label="CAG" value={c.cag} sub="This month" />
      <Tile icon={TrendingUp} tone="bg-destructive/15 text-destructive" label="PTCA" value={c.ptca} sub="This month" />
      <Tile icon={Car} tone="bg-muted text-foreground" label="KM Today" value={c.todayKm.toFixed(1)} />
      <Tile
        icon={IndianRupee}
        tone="bg-success/15 text-success"
        label="TA + DA"
        value={`₹${(c.taToday + c.daToday).toFixed(0)}`}
        sub={`Month ₹${(c.taMonth + c.daMonth).toFixed(0)}`}
      />
    </div>
  );
}
