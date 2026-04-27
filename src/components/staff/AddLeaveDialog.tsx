import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarPlus, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type LeaveKind = "casual" | "sick" | "earned" | "unpaid" | "other";

export default function AddLeaveDialog({ onAdded }: { onAdded?: () => void }) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    leave_type: "casual" as LeaveKind,
    from_date: today,
    to_date: today,
    reason: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.reason.trim()) return toast.error("Reason required");
    if (form.to_date < form.from_date) return toast.error("End date can't be before start date");

    setLoading(true);
    const { error } = await supabase.from("leave_requests").insert({
      user_id: user.id,
      centre_id: profile?.centre_id || null,
      leave_type: form.leave_type,
      from_date: form.from_date,
      to_date: form.to_date,
      reason: form.reason.trim(),
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Leave request submitted");
    setOpen(false);
    setForm({ leave_type: "casual", from_date: today, to_date: today, reason: "" });
    onAdded?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> Apply Leave
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" /> Apply for Leave
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Leave Type *</Label>
            <Select value={form.leave_type} onValueChange={(v) => setForm((p) => ({ ...p, leave_type: v as LeaveKind }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="sick">Sick</SelectItem>
                <SelectItem value="earned">Earned</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>From *</Label>
              <Input type="date" value={form.from_date} onChange={(e) => setForm((p) => ({ ...p, from_date: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>To *</Label>
              <Input type="date" value={form.to_date} onChange={(e) => setForm((p) => ({ ...p, to_date: e.target.value }))} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Reason *</Label>
            <Textarea rows={3} value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Submitting…" : "Submit Request"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
