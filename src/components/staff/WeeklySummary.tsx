import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Activity, Stethoscope, HeartPulse, IndianRupee, TrendingUp, Car } from "lucide-react";
import { TA_RATE_PER_KM, DA_AMOUNT, MIN_VISITS_FOR_DA } from "@/lib/ta-da";

interface Stats {
  visits: number;
  doctors: number;
  cag: number;
  ptca: number;
  km: number;
  earnings: number;
}

function startOfWeek() {
  const d = new Date();
  const day = d.getDay(); // 0 Sun
  const diff = (day + 6) % 7; // Mon as start
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

export default function WeeklySummary({ refreshKey }: { refreshKey?: number }) {
  const { user } = useAuth();
  const [s, setS] = useState<Stats>({ visits: 0, doctors: 0, cag: 0, ptca: 0, km: 0, earnings: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const from = startOfWeek();
      const [vRes, pRes, ckRes] = await Promise.all([
        supabase.from("visits").select("id, visitor_type, checkin_id").eq("user_id", user.id).gte("visit_date", from),
        supabase.from("procedures").select("procedure_type").eq("user_id", user.id).gte("procedure_date", from),
        supabase.from("daily_checkins").select("id, total_km").eq("user_id", user.id).gte("checkin_date", from),
      ]);

      const visits = vRes.data || [];
      const visitsPerCheckin: Record<string, number> = {};
      visits.forEach((v: any) => {
        visitsPerCheckin[v.checkin_id] = (visitsPerCheckin[v.checkin_id] || 0) + 1;
      });

      const ck = (ckRes.data || []) as any[];
      let km = 0;
      let earnings = 0;
      ck.forEach((c) => {
        const k = Math.max(0, Math.min(Number(c.total_km ?? 0), 300));
        km += k;
        earnings += k * TA_RATE_PER_KM;
        if ((visitsPerCheckin[c.id] || 0) >= MIN_VISITS_FOR_DA) earnings += DA_AMOUNT;
      });

      const procs = (pRes.data || []) as any[];
      setS({
        visits: visits.length,
        doctors: visits.filter((v: any) => v.visitor_type === "doctor").length,
        cag: procs.filter((p) => p.procedure_type === "cag").length,
        ptca: procs.filter((p) => p.procedure_type === "ptca").length,
        km,
        earnings,
      });
    })();
  }, [user, refreshKey]);

  const tiles = [
    { Icon: Activity, label: "Visits", value: s.visits, tone: "bg-primary/10 text-primary" },
    { Icon: Stethoscope, label: "Doctors", value: s.doctors, tone: "bg-accent/15 text-accent" },
    { Icon: HeartPulse, label: "CAG", value: s.cag, tone: "bg-warning/15 text-warning" },
    { Icon: TrendingUp, label: "PTCA", value: s.ptca, tone: "bg-destructive/15 text-destructive" },
    { Icon: Car, label: "KM", value: s.km.toFixed(1), tone: "bg-muted text-foreground" },
    { Icon: IndianRupee, label: "Earnings", value: `₹${s.earnings.toFixed(0)}`, tone: "bg-success/15 text-success" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">This Week</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-lg border p-3 space-y-1">
              <div className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${t.tone}`}>
                <t.Icon className="h-4 w-4" />
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
