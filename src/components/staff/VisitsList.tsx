import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, FlaskConical, Ambulance, Building2, User } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Visit = Database["public"]["Tables"]["visits"]["Row"];

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

  useEffect(() => {
    if (!user) return;
    supabase
      .from("visits")
      .select("*")
      .eq("checkin_id", checkinId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setVisits(data);
      });
  }, [checkinId, user, refreshKey]);

  if (visits.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">No visits logged yet.</p>;
  }

  return (
    <div className="space-y-2">
      {visits.map((v) => (
        <div key={v.id} className="flex items-center gap-3 p-3 rounded-lg bg-card border">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            {visitorIcons[v.visitor_type] || <User className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{v.visitor_name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {v.designation && `${v.designation} · `}{v.purpose || "No purpose noted"}
            </p>
          </div>
          <Badge variant="secondary" className="text-xs capitalize shrink-0">
            {v.visitor_type.replace("_", " ")}
          </Badge>
        </div>
      ))}
    </div>
  );
}
