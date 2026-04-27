import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Stethoscope, HeartPulse, MapPin, Activity, Clock } from "lucide-react";

interface Item {
  id: string;
  ts: string;
  type: "visit" | "procedure" | "checkin" | "checkout";
  title: string;
  subtitle?: string;
}

const meta: Record<Item["type"], { tone: string; Icon: any }> = {
  visit: { tone: "bg-primary/10 text-primary", Icon: Stethoscope },
  procedure: { tone: "bg-destructive/15 text-destructive", Icon: HeartPulse },
  checkin: { tone: "bg-success/15 text-success", Icon: MapPin },
  checkout: { tone: "bg-muted text-foreground", Icon: Activity },
};

export default function ActivityFeed({ refreshKey }: { refreshKey?: number }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [visitsRes, procsRes, checkinRes] = await Promise.all([
        supabase.from("visits").select("id, visitor_name, doctor_name, visitor_type, place, created_at")
          .eq("user_id", user.id).eq("visit_date", today).order("created_at", { ascending: false }),
        supabase.from("procedures").select("id, patient_name, procedure_type, created_at")
          .eq("user_id", user.id).eq("procedure_date", today).order("created_at", { ascending: false }),
        supabase.from("daily_checkins").select("id, checkin_time, checkout_time, total_km")
          .eq("user_id", user.id).eq("checkin_date", today).maybeSingle(),
      ]);

      const arr: Item[] = [];
      (visitsRes.data || []).forEach((v: any) =>
        arr.push({
          id: `v-${v.id}`,
          ts: v.created_at,
          type: "visit",
          title: `Visit · ${v.doctor_name || v.visitor_name}`,
          subtitle: [v.visitor_type, v.place].filter(Boolean).join(" · "),
        })
      );
      (procsRes.data || []).forEach((p: any) =>
        arr.push({
          id: `p-${p.id}`,
          ts: p.created_at,
          type: "procedure",
          title: `${p.procedure_type.toUpperCase()} · ${p.patient_name}`,
        })
      );
      const ck = checkinRes.data;
      if (ck?.checkin_time)
        arr.push({ id: `ci-${ck.id}`, ts: ck.checkin_time, type: "checkin", title: "Day started" });
      if (ck?.checkout_time)
        arr.push({
          id: `co-${ck.id}`,
          ts: ck.checkout_time,
          type: "checkout",
          title: "Day ended",
          subtitle: `${Number(ck.total_km ?? 0).toFixed(1)} km`,
        });

      arr.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
      setItems(arr);
    })();
  }, [user, refreshKey]);

  if (items.length === 0)
    return <p className="text-sm text-muted-foreground text-center py-6">No activity yet today.</p>;

  return (
    <div className="space-y-2">
      {items.map((it) => {
        const m = meta[it.type];
        return (
          <div key={it.id} className="flex items-start gap-3 rounded-lg border bg-card p-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${m.tone}`}>
              <m.Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{it.title}</p>
              {it.subtitle && <p className="text-xs text-muted-foreground truncate">{it.subtitle}</p>}
            </div>
            <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
              <Clock className="h-3 w-3" />
              {new Date(it.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
