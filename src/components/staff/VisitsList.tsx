import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, FlaskConical, Ambulance, Building2, User, MapPin, Clock } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Visit = Database["public"]["Tables"]["visits"]["Row"] & {
  doctor_name?: string | null;
  place?: string | null;
};

const visitorIcons: Record<string, React.ReactNode> = {
  doctor: <Stethoscope className="h-4 w-4" />,
  lab: <FlaskConical className="h-4 w-4" />,
  ambulance_driver: <Ambulance className="h-4 w-4" />,
  hospital: <Building2 className="h-4 w-4" />,
  other: <User className="h-4 w-4" />,
};

interface Props {
  checkinId: string;
  refreshKey?: number;
}


export default function VisitsList({ checkinId, refreshKey }: Props) {
  const { user } = useAuth();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [referralKeys, setReferralKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: vs }, { data: rs }] = await Promise.all([
        supabase.from("visits").select("*").eq("checkin_id", checkinId).order("created_at", { ascending: false }),
        supabase.from("referrals").select("referral_centre, hospital_name").eq("checkin_id", checkinId),
      ]);
      if (vs) setVisits(vs as Visit[]);
      const keys = new Set<string>();
      (rs || []).forEach((r: any) => {
        const name = (r.referral_centre || "").trim().toLowerCase();
        if (name) keys.add(name);
      });
      setReferralKeys(keys);
    })();
  }, [checkinId, user, refreshKey]);


  if (visits.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">No visits logged yet.</p>;
  }

  return (
    <div className="space-y-2">
      {visits.map((v) => {
        const name = v.doctor_name || v.visitor_name;
        const isReferral = referralKeys.has((name || "").trim().toLowerCase());
        return (
          <div key={v.id} className="rounded-lg bg-card border p-3 space-y-2">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                {visitorIcons[v.visitor_type] || <User className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {v.designation && `${v.designation} · `}{v.purpose || "No purpose noted"}
                </p>
                {v.place && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" /> {v.place}
                  </p>
                )}
              </div>
              <Badge variant="secondary" className="text-xs capitalize shrink-0">
                {v.visitor_type.replace("_", " ")}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {v.checkin_time ? new Date(v.checkin_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
              </span>
              <div className="flex items-center gap-1.5">
                {isReferral && (
                  <Badge className="text-[10px] h-5 bg-primary/10 text-primary hover:bg-primary/10 border-0">
                    Referral
                  </Badge>
                )}
                <Badge className="text-[10px] h-5 bg-success/10 text-success hover:bg-success/10 border-0">
                  Completed
                </Badge>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
