import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, IndianRupee, CheckCircle2, User, Building2 } from "lucide-react";
import { toast } from "sonner";

interface Props { refreshKey?: number; onChanged?: () => void; }

interface PaymentRow {
  id: string;
  doctor_name: string | null;
  patient_name: string;
  hospital_name: string | null;
  procedure_type: string;
  estimated_value: number | null;
  payment_status: "pending" | "released";
  payment_date: string | null;
  paid_at: string | null;
  procedure_date: string;
}

export default function PaymentsSummary({ refreshKey, onChanged }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<PaymentRow[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "released">("all");
  const [bump, setBump] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("procedures")
      .select("id, doctor_name, patient_name, hospital_name, procedure_type, estimated_value, payment_status, payment_date, paid_at, procedure_date, procedure_status")
      .eq("user_id", user.id)
      .eq("procedure_status", "done")
      .order("procedure_date", { ascending: false })
      .then(({ data }) => setItems(((data as any) || []) as PaymentRow[]));
  }, [user, refreshKey, bump]);

  const markPaid = async (id: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from("procedures")
      .update({
        payment_status: "released",
        paid_at: new Date().toISOString(),
        payment_date: today,
        payment_updated_by: "staff",
        payment_updated_user_id: user?.id,
      } as any)
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marked as paid");
    setBump((x) => x + 1);
    onChanged?.();
  };

  const filtered = items.filter((r) => filter === "all" || r.payment_status === filter);
  const totalPending = items.filter((r) => r.payment_status === "pending").reduce((a, r) => a + Number(r.estimated_value || 0), 0);
  const totalPaid = items.filter((r) => r.payment_status === "released").reduce((a, r) => a + Number(r.estimated_value || 0), 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="text-lg font-semibold flex items-center"><IndianRupee className="h-4 w-4" />{totalPending.toFixed(0)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Released</p>
          <p className="text-lg font-semibold flex items-center text-success"><IndianRupee className="h-4 w-4" />{totalPaid.toFixed(0)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {(["all", "pending", "released"] as const).map((f) => (
          <Badge
            key={f}
            onClick={() => setFilter(f)}
            className={`cursor-pointer capitalize ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f === "released" ? "Paid" : f}
          </Badge>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No payable referrals yet. Mark a referral as "Procedure Done" to enable payment.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const isPaid = r.payment_status === "released";
            return (
              <div key={r.id} className="rounded-lg border bg-card p-3 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">Dr. {r.doctor_name || "—"}</p>
                      <Badge variant="outline" className="text-[10px] uppercase">{r.procedure_type}</Badge>
                      <Badge className={`text-[10px] ${isPaid ? "bg-success/15 text-success" : "bg-warning/20 text-warning"}`}>
                        {isPaid ? "Paid" : "Pending"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <User className="h-3 w-3" /> <span className="truncate">{r.patient_name}</span>
                    </div>
                    {r.hospital_name && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Building2 className="h-3 w-3" /> {r.hospital_name}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs border-t pt-2 flex-wrap gap-2">
                  <span className="text-muted-foreground">
                    {new Date(r.procedure_date).toLocaleDateString()}
                    {r.estimated_value != null && (
                      <span className="ml-2 font-medium text-foreground">₹{Number(r.estimated_value).toFixed(0)}</span>
                    )}
                  </span>
                  {isPaid ? (
                    <span className="text-success">
                      Paid {r.payment_date ? new Date(r.payment_date).toLocaleDateString() : ""}
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => markPaid(r.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Paid
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
