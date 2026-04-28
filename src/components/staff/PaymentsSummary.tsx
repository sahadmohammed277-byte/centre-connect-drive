import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Wallet, IndianRupee } from "lucide-react";

interface Props { refreshKey?: number; }

interface DoctorGroup {
  doctor: string;
  total: number;
  amount: number;
  paid: number;
  pending: number;
  lastPaid: string | null;
}

export default function PaymentsSummary({ refreshKey }: Props) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<DoctorGroup[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("procedures")
        .select("doctor_name, estimated_value, payment_status, paid_at")
        .eq("user_id", user.id);
      const map = new Map<string, DoctorGroup>();
      (data || []).forEach((r: any) => {
        const key = r.doctor_name?.trim() || "Unknown";
        const g = map.get(key) || { doctor: key, total: 0, amount: 0, paid: 0, pending: 0, lastPaid: null };
        g.total += 1;
        g.amount += Number(r.estimated_value || 0);
        if (r.payment_status === "released") {
          g.paid += 1;
          if (r.paid_at && (!g.lastPaid || r.paid_at > g.lastPaid)) g.lastPaid = r.paid_at;
        } else {
          g.pending += 1;
        }
        map.set(key, g);
      });
      setGroups(Array.from(map.values()).sort((a, b) => b.amount - a.amount));
    })();
  }, [user, refreshKey]);

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No payment data yet.</p>;
  }

  return (
    <div className="space-y-2">
      {groups.map((g) => {
        const allPaid = g.pending === 0;
        return (
          <div key={g.doctor} className="rounded-lg border bg-card p-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Wallet className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold truncate">Dr. {g.doctor}</p>
                  <Badge
                    className={`text-[10px] ${
                      allPaid
                        ? "bg-success/15 text-success hover:bg-success/15"
                        : "bg-warning/20 text-warning hover:bg-warning/20"
                    }`}
                  >
                    {allPaid ? "All Paid" : `${g.pending} Pending`}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Referrals</p>
                    <p className="font-semibold text-sm">{g.total}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-semibold text-sm flex items-center">
                      <IndianRupee className="h-3 w-3" />{g.amount.toFixed(0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Paid</p>
                    <p className="font-semibold text-sm">
                      {g.lastPaid ? new Date(g.lastPaid).toLocaleDateString() : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
