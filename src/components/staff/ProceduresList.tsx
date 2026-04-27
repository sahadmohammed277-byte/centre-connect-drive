import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { HeartPulse, Activity, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props { refreshKey?: number; onChanged?: () => void; }

interface Proc {
  id: string;
  procedure_type: "cag" | "ptca" | "other";
  patient_name: string;
  doctor_name: string | null;
  hospital_name: string | null;
  procedure_date: string;
  estimated_value: number | null;
  notes: string | null;
}

const typeMeta: Record<string, { label: string; tone: string; icon: any }> = {
  cag: { label: "CAG", tone: "bg-warning/15 text-warning", icon: Activity },
  ptca: { label: "PTCA", tone: "bg-destructive/15 text-destructive", icon: HeartPulse },
  other: { label: "Other", tone: "bg-muted text-muted-foreground", icon: HeartPulse },
};

export default function ProceduresList({ refreshKey, onChanged }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<Proc[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("procedures")
      .select("*")
      .eq("user_id", user.id)
      .order("procedure_date", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data }) => setItems((data as Proc[]) || []));
  }, [user, refreshKey]);

  const remove = async (id: string) => {
    if (!confirm("Delete this procedure?")) return;
    const { error } = await supabase.from("procedures").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    setItems((p) => p.filter((x) => x.id !== id));
    onChanged?.();
  };

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No procedures recorded yet.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((p) => {
        const meta = typeMeta[p.procedure_type];
        const Icon = meta.icon;
        return (
          <div key={p.id} className="rounded-lg border bg-card p-3 space-y-1.5">
            <div className="flex items-start gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{p.patient_name}</p>
                  <Badge variant="outline" className="text-[10px] uppercase">{meta.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {p.doctor_name || "—"}{p.hospital_name && ` · ${p.hospital_name}`}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(p.id)}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-1.5">
              <span>{new Date(p.procedure_date).toLocaleDateString()}</span>
              {p.estimated_value != null && <span className="font-medium text-foreground">₹{Number(p.estimated_value).toFixed(0)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
