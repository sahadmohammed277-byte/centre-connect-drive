import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HeartHandshake, CheckCircle2, XCircle, Percent, TrendingUp, Stethoscope, IndianRupee,
} from "lucide-react";

interface Proc {
  id: string;
  user_id: string;
  doctor_name: string | null;
  procedure_status: "pending" | "done" | "not_done";
  payment_status: "pending" | "released";
  estimated_value: number | null;
}

interface Profile { user_id: string; full_name: string }

export default function ReferralAnalytics() {
  const [procs, setProcs] = useState<Proc[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    void Promise.all([
      supabase.from("procedures").select("id, user_id, doctor_name, procedure_status, payment_status, estimated_value"),
      supabase.from("profiles").select("user_id, full_name"),
    ]).then(([p, pr]) => {
      setProcs(((p.data as any) || []) as Proc[]);
      setProfiles(((pr.data as any) || []) as Profile[]);
    });
  }, []);

  const total = procs.length;
  const done = procs.filter((p) => p.procedure_status === "done").length;
  const notDone = procs.filter((p) => p.procedure_status === "not_done").length;
  const pending = procs.filter((p) => p.procedure_status === "pending").length;
  const conversion = total > 0 ? Math.round((done / total) * 100) : 0;
  const releasedAmount = procs
    .filter((p) => p.payment_status === "released")
    .reduce((a, p) => a + Number(p.estimated_value || 0), 0);

  // Top doctor (by referral count)
  const docMap = new Map<string, number>();
  procs.forEach((p) => {
    const k = (p.doctor_name || "Unknown").trim();
    docMap.set(k, (docMap.get(k) || 0) + 1);
  });
  const topDoctors = Array.from(docMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Staff-wise
  const staffMap = new Map<string, { total: number; done: number; notDone: number; pending: number }>();
  procs.forEach((p) => {
    const s = staffMap.get(p.user_id) || { total: 0, done: 0, notDone: 0, pending: 0 };
    s.total += 1;
    if (p.procedure_status === "done") s.done += 1;
    else if (p.procedure_status === "not_done") s.notDone += 1;
    else s.pending += 1;
    staffMap.set(p.user_id, s);
  });
  const staffRows = Array.from(staffMap.entries())
    .map(([uid, s]) => ({
      name: profiles.find((pr) => pr.user_id === uid)?.full_name || "Unknown",
      ...s,
      conv: s.total > 0 ? Math.round((s.done / s.total) * 100) : 0,
    }))
    .sort((a, b) => b.done - a.done)
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MiniStat icon={HeartHandshake} label="Total Referrals" value={total} tone="primary" />
        <MiniStat icon={CheckCircle2} label="Procedures Done" value={done} tone="success" />
        <MiniStat icon={XCircle} label="Not Done" value={notDone} tone="destructive" />
        <MiniStat icon={Percent} label="Conversion" value={`${conversion}%`} tone="primary" />
        <MiniStat icon={IndianRupee} label="Paid Out" value={`₹${releasedAmount.toFixed(0)}`} tone="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-card border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
              <Stethoscope className="h-4 w-4 text-primary" /> Most Referring Doctors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {topDoctors.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No referrals yet.</p>
            ) : (
              topDoctors.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {i + 1}
                    </div>
                    <p className="text-sm font-medium">Dr. {d.name}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{d.count} referrals</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
              <TrendingUp className="h-4 w-4 text-primary" /> Staff Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {staffRows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No staff referrals yet.</p>
            ) : (
              staffRows.map((s, i) => (
                <div key={s.name + i} className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-muted/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent text-xs font-semibold">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.done} done · {s.pending} pending · {s.notDone} not done
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold">{s.conv}%</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: any; tone: string }) {
  const toneCls: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    neutral: "bg-muted text-muted-foreground",
  };
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-md ${toneCls[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground truncate">{label}</p>
          <p className="text-base font-semibold leading-tight">{value}</p>
        </div>
      </div>
    </div>
  );
}
