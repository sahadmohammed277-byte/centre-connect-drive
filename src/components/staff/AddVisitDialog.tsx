import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

type VisitorType = Database["public"]["Enums"]["visitor_type"];

interface Props {
  checkinId: string;
  onAdded: () => void;
}

export default function AddVisitDialog({ checkinId, onAdded }: Props) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    visitor_type: "doctor" as VisitorType,
    visitor_name: "",
    designation: "",
    contact_number: "",
    purpose: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile?.centre_id) return;
    setLoading(true);

    const { error } = await supabase.from("visits").insert({
      user_id: user.id,
      checkin_id: checkinId,
      centre_id: profile.centre_id,
      visitor_type: form.visitor_type,
      visitor_name: form.visitor_name,
      designation: form.designation || null,
      contact_number: form.contact_number || null,
      purpose: form.purpose || null,
      notes: form.notes || null,
      checkin_time: new Date().toISOString(),
    });

    if (error) {
      toast.error("Failed to add visit");
    } else {
      toast.success("Visit added");
      setForm({ visitor_type: "doctor", visitor_name: "", designation: "", contact_number: "", purpose: "", notes: "" });
      setOpen(false);
      onAdded();
    }
    setLoading(false);
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> Add Visit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Visit</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Visitor Type</Label>
            <Select value={form.visitor_type} onValueChange={(v) => setForm((p) => ({ ...p, visitor_type: v as VisitorType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="doctor">Doctor</SelectItem>
                <SelectItem value="lab">Lab</SelectItem>
                <SelectItem value="ambulance_driver">Ambulance Driver</SelectItem>
                <SelectItem value="hospital">Hospital</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Visitor Name *</Label>
            <Input value={form.visitor_name} onChange={set("visitor_name")} required />
          </div>
          <div className="space-y-2">
            <Label>Designation</Label>
            <Input value={form.designation} onChange={set("designation")} />
          </div>
          <div className="space-y-2">
            <Label>Contact Number</Label>
            <Input value={form.contact_number} onChange={set("contact_number")} type="tel" />
          </div>
          <div className="space-y-2">
            <Label>Purpose</Label>
            <Input value={form.purpose} onChange={set("purpose")} />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={set("notes")} rows={2} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving..." : "Save Visit"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
