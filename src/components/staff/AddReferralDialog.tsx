import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HeartHandshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

type ServiceType = Database["public"]["Enums"]["service_type"];

interface Props {
  checkinId: string;
  onAdded: () => void;
}

export default function AddReferralDialog({ checkinId, onAdded }: Props) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    referral_received: true,
    patient_name: "",
    service_type: "lab" as ServiceType,
    estimated_value: "",
    referral_centre: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile?.centre_id) return;
    setLoading(true);

    const { error } = await supabase.from("referrals").insert({
      user_id: user.id,
      checkin_id: checkinId,
      centre_id: profile.centre_id,
      referral_received: form.referral_received,
      patient_name: form.patient_name || null,
      service_type: form.service_type,
      estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
      referral_centre: form.referral_centre || null,
    });

    if (error) {
      toast.error("Failed to add referral");
    } else {
      toast.success("Referral added");
      setOpen(false);
      onAdded();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <HeartHandshake className="h-4 w-4" /> Add Referral
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Referral</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Referral Received</Label>
            <Switch checked={form.referral_received} onCheckedChange={(v) => setForm((p) => ({ ...p, referral_received: v }))} />
          </div>
          <div className="space-y-2">
            <Label>Patient Name (optional)</Label>
            <Input value={form.patient_name} onChange={(e) => setForm((p) => ({ ...p, patient_name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Service Type</Label>
            <Select value={form.service_type} onValueChange={(v) => setForm((p) => ({ ...p, service_type: v as ServiceType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lab">Lab</SelectItem>
                <SelectItem value="opd">OPD</SelectItem>
                <SelectItem value="scan">Scan</SelectItem>
                <SelectItem value="admission">Admission</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Estimated Value (₹)</Label>
            <Input type="number" value={form.estimated_value} onChange={(e) => setForm((p) => ({ ...p, estimated_value: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Referral Centre</Label>
            <Input value={form.referral_centre} onChange={(e) => setForm((p) => ({ ...p, referral_centre: e.target.value }))} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving..." : "Save Referral"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
