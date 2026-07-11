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

function formatDuration(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms <= 0) return "0m";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export default function VisitsList({ checkinId, refreshKey }: Props) {
  const { user } = useAuth();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("visits")
      .select("*")
      .eq("checkin_id", checkinId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setVisits(data as Visit[]);
      });
  }, [checkinId, user, refreshKey, bump]);

  const handleCheckout = async (visit: Visit) => {
    try {
      const pos = await getCurrentPosition();
      const { error } = await supabase
        .from("visits")
        .update({ checkout_time: new Date().toISOString() })
        .eq("id", visit.id);
      if (error) throw error;
      toast.success("Visit checked out");
      setBump((b) => b + 1);
    } catch (err: any) {
      toast.error(err.message || "Failed to check out visit");
    }
  };

  if (visits.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">No visits logged yet.</p>;
  }

  return (
    <div className="space-y-2">
      {visits.map((v) => {
        const name = v.doctor_name || v.visitor_name;
        const checkedOut = !!v.checkout_time;
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
                In: {v.checkin_time ? new Date(v.checkin_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                {checkedOut && (
                  <>
                    {" · Out: "}
                    {new Date(v.checkout_time!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    <span className="font-medium text-foreground">{formatDuration(v.checkin_time!, v.checkout_time!)}</span>
                  </>
                )}
              </span>
              {checkedOut ? (
                <span className="flex items-center gap-1 text-success">
                  <CheckCircle2 className="h-3 w-3" /> Done
                </span>
              ) : (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleCheckout(v)}>
                  Check out
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
