import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, X } from "lucide-react";
import { toast } from "sonner";

interface LeaveRow {
  id: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  admin_comments: string | null;
  created_at: string;
}

const statusBadge = (s: string) => {
  if (s === "approved") return <Badge className="bg-success text-success-foreground hover:bg-success">Approved</Badge>;
  if (s === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  if (s === "cancelled") return <Badge variant="outline">Cancelled</Badge>;
  return <Badge className="bg-warning text-warning-foreground hover:bg-warning">Pending</Badge>;
};

const dayCount = (from: string, to: string) =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1;

export default function LeaveList({ refreshKey, onChanged }: { refreshKey?: number; onChanged?: () => void }) {
  const { user } = useAuth();
  const [items, setItems] = useState<LeaveRow[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("leave_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("from_date", { ascending: false })
      .then(({ data }) => setItems((data as LeaveRow[]) || []));
  }, [user, refreshKey]);

  const cancel = async (id: string) => {
    if (!confirm("Cancel this leave request?")) return;
    const { error } = await supabase.from("leave_requests").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Cancelled");
    setItems((arr) => arr.map((x) => (x.id === id ? { ...x, status: "cancelled" } : x)));
    onChanged?.();
  };

  if (items.length === 0)
    return <p className="text-sm text-muted-foreground text-center py-6">No leave requests yet.</p>;

  return (
    <div className="space-y-2">
      {items.map((l) => (
        <div key={l.id} className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium capitalize">{l.leave_type} leave</p>
                {statusBadge(l.status)}
                <span className="text-xs text-muted-foreground">
                  {dayCount(l.from_date, l.to_date)} day{dayCount(l.from_date, l.to_date) > 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(l.from_date).toLocaleDateString()} → {new Date(l.to_date).toLocaleDateString()}
              </p>
              <p className="text-xs mt-1">{l.reason}</p>
              {l.admin_comments && (
                <p className="text-xs mt-1 rounded bg-muted px-2 py-1">
                  <span className="font-medium">Admin: </span>{l.admin_comments}
                </p>
              )}
            </div>
            {l.status === "pending" && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => cancel(l.id)} title="Cancel">
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
