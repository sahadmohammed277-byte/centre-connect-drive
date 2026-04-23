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
type ProcedureType = "cag" | "ptca" | "other";

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
    patient_count: "1",
    service_type: "lab" as ServiceType,
    procedure_type: "cag" as ProcedureType,
    estimated_value: "",
    hospital_name: "",
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
      patient_count: parseInt(form.patient_count) || 1,
      service_type: form.service_type,
      procedure_type: form.procedure_type,
      estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
      hospital_name: form.hospital_name || null,
      referral_centre: form.referral_centre || null,
    } as any);

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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Referral</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Referral Received</Label>
            <Switch checked={form.referral_received} onCheckedChange={(v) => setForm((p) => ({ ...p, referral_received: v }))} />
          </div>

          <div className="space-y-2">
            <Label>Procedure Type *</Label>
            <Select value={form.procedure_type} onValueChange={(v) => setForm((p) => ({ ...p, procedure_type: v as ProcedureType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cag">CAG (Angiogram)</SelectItem>
                <SelectItem value="ptca">PTCA (Angioplasty)</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Patient Count *</Label>
              <Input
                type="number"
                min="1"
                value={form.patient_count}
                onChange={(e) => setForm((p) => ({ ...p, patient_count: e.target.value }))}
                required
              />
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
          </div>

          <div className="space-y-2">
            <Label>Hospital Name *</Label>
            <Input
              value={form.hospital_name}
              onChange={(e) => setForm((p) => ({ ...p, hospital_name: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Estimated Revenue (₹)</Label>
            <Input
              type="number"
              value={form.estimated_value}
              onChange={(e) => setForm((p) => ({ ...p, estimated_value: e.target.value }))}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label>Patient Name (optional)</Label>
            <Input value={form.patient_name} onChange={(e) => setForm((p) => ({ ...p, patient_name: e.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>Referring Doctor / Centre</Label>
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
