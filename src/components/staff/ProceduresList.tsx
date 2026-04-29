import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import {
  HeartPulse, Activity, Trash2, CheckCircle2, XCircle,
  Phone, Building2, User, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  refreshKey?: number;
  onChanged?: () => void;
  filter?: "all" | "pending" | "done" | "not_done";
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
  procedure_status: "pending" | "done" | "not_done";
  not_done_reason: string | null;
  payment_status: "pending" | "released";
  paid_at: string | null;
}

const typeMeta: Record<string, { label: string; tone: string; icon: any }> = {
  cag: { label: "CAG", tone: "bg-warning/15 text-warning", icon: Activity },
  ptca: { label: "PTCA", tone: "bg-destructive/15 text-destructive", icon: HeartPulse },
  other: { label: "Other", tone: "bg-muted text-muted-foreground", icon: HeartPulse },
};

const statusMeta = {
  pending: { label: "Pending", cls: "bg-warning/20 text-warning hover:bg-warning/20" },
  done: { label: "Done", cls: "bg-success/15 text-success hover:bg-success/15" },
  not_done: { label: "Not Done", cls: "bg-destructive/15 text-destructive hover:bg-destructive/15" },
};

export default function ProceduresList({ refreshKey, onChanged, filter = "all" }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<Proc[]>([]);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

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

  const markDone = async (id: string) => {
    const { error } = await supabase
      .from("procedures")
      .update({ procedure_status: "done", not_done_reason: null } as any)
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marked as done");
    setItems((p) => p.map((x) => (x.id === id ? { ...x, procedure_status: "done", not_done_reason: null } : x)));
    onChanged?.();
  };

  const openNotDone = (id: string) => {
    setActiveId(id);
    setReason("");
    setReasonOpen(true);
  };

  const submitNotDone = async () => {
    if (!activeId) return;
    if (!reason.trim()) return toast.error("Reason is required");
    const { error } = await supabase
      .from("procedures")
      .update({ procedure_status: "not_done", not_done_reason: reason.trim() } as any)
      .eq("id", activeId);
    if (error) return toast.error(error.message);
    toast.success("Marked as not done");
    setItems((p) =>
      p.map((x) =>
        x.id === activeId ? { ...x, procedure_status: "not_done", not_done_reason: reason.trim() } : x,
      ),
    );
    setReasonOpen(false);
    setActiveId(null);
    onChanged?.();
  };

  const filtered = items.filter((p) => filter === "all" || p.procedure_status === filter);

  if (filtered.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No referrals to show.</p>;
  }

  return (
    <>
      <div className="space-y-2">
        {filtered.map((p) => {
          const meta = typeMeta[p.procedure_type];
          const Icon = meta.icon;
          const sm = statusMeta[p.procedure_status];
          const isPending = p.procedure_status === "pending";
          const isNotDone = p.procedure_status === "not_done";
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
                    <Badge className={`text-[10px] ${sm.cls}`}>{sm.label}</Badge>
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

              {isNotDone && p.not_done_reason && (
                <div className="flex items-start gap-2 rounded-md bg-destructive/5 border border-destructive/20 px-2 py-1.5 text-xs">
                  <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                  <span className="text-destructive/90">{p.not_done_reason}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-xs border-t pt-2 gap-2 flex-wrap">
                <span className="text-muted-foreground">
                  {new Date(p.procedure_date).toLocaleDateString()}
                  {p.estimated_value != null && (
                    <span className="ml-2 font-medium text-foreground">₹{Number(p.estimated_value).toFixed(0)}</span>
                  )}
                </span>
                {isPending && (
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => markDone(p.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Procedure Done
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => openNotDone(p.id)}>
                      <XCircle className="h-3.5 w-3.5 text-destructive" /> Not Done
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reason — Procedure Not Done</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason *</Label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Patient cancelled, scheduled later, etc."
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReasonOpen(false)}>Cancel</Button>
            <Button onClick={submitNotDone}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
