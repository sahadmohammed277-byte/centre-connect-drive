import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { HeartPulse, Activity, Trash2, CheckCircle2, Phone, Building2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  refreshKey?: number;
  onChanged?: () => void;
  filter?: "all" | "pending" | "released";
}

interface Proc {
  id: string;
  procedure_type: "cag" | "ptca" | "other";
  patient_name: string;
  doctor_name: string | null;
  hospital_name: string | null;
  phone_number: string | null;
  procedure_date: string;
  estimated_value: number | null;
  notes: string | null;
  payment_status: "pending" | "released";
  paid_at: string | null;
}

const typeMeta: Record<string, { label: string; tone: string; icon: any }> = {
  cag: { label: "CAG", tone: "bg-warning/15 text-warning", icon: Activity },
  ptca: { label: "PTCA", tone: "bg-destructive/15 text-destructive", icon: HeartPulse },
  other: { label: "Other", tone: "bg-muted text-muted-foreground", icon: HeartPulse },
};

export default function ProceduresList({ refreshKey, onChanged, filter = "all" }: Props) {
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
      .then(({ data }) => setItems((data as any as Proc[]) || []));
  }, [user, refreshKey]);

  const remove = async (id: string) => {
    if (!confirm("Delete this referral?")) return;
    const { error } = await supabase.from("procedures").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    setItems((p) => p.filter((x) => x.id !== id));
    onChanged?.();
  };

  const markPaid = async (id: string) => {
    const { error } = await supabase
      .from("procedures")
      .update({
        payment_status: "released",
        paid_at: new Date().toISOString(),
        payment_updated_by: "staff",
        payment_updated_user_id: user?.id,
      } as any)
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marked as paid");
    setItems((p) =>
      p.map((x) =>
        x.id === id ? { ...x, payment_status: "released", paid_at: new Date().toISOString() } : x,
      ),
    );
    onChanged?.();
  };

  const filtered = items.filter((p) => filter === "all" || p.payment_status === filter);

  if (filtered.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No referrals to show.</p>;
  }

  return (
    <div className="space-y-2">
      {filtered.map((p) => {
        const meta = typeMeta[p.procedure_type];
        const Icon = meta.icon;
        const isPaid = p.payment_status === "released";
        return (
          <div key={p.id} className="rounded-lg border bg-card p-3 space-y-2">
            <div className="flex items-start gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold truncate">Dr. {p.doctor_name || "—"}</p>
                  <Badge variant="outline" className="text-[10px] uppercase">{meta.label}</Badge>
                  <Badge
                    className={`text-[10px] ${
                      isPaid
                        ? "bg-success/15 text-success hover:bg-success/15"
                        : "bg-warning/20 text-warning hover:bg-warning/20"
                    }`}
                  >
                    {isPaid ? "Paid" : "Pending"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <User className="h-3 w-3" /> <span className="truncate">{p.patient_name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                  {p.hospital_name && (
                    <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{p.hospital_name}</span>
                  )}
                  {p.phone_number && (
                    <a href={`tel:${p.phone_number}`} className="flex items-center gap-1 hover:text-primary">
                      <Phone className="h-3 w-3" />{p.phone_number}
                    </a>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(p.id)}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
            <div className="flex items-center justify-between text-xs border-t pt-2">
              <span className="text-muted-foreground">
                {new Date(p.procedure_date).toLocaleDateString()}
                {p.estimated_value != null && (
                  <span className="ml-2 font-medium text-foreground">₹{Number(p.estimated_value).toFixed(0)}</span>
                )}
              </span>
              {!isPaid ? (
                <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => markPaid(p.id)}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Paid
                </Button>
              ) : (
                p.paid_at && (
                  <span className="text-success">Paid {new Date(p.paid_at).toLocaleDateString()}</span>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
