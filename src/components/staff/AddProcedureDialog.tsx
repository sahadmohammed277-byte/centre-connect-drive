import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HeartPulse, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  checkinId?: string | null;
  onAdded?: () => void;
  trigger?: React.ReactNode;
}

type ProcKind = "cag" | "ptca" | "other";

export default function AddProcedureDialog({ checkinId, onAdded, trigger }: Props) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    procedure_type: "cag" as ProcKind,
    patient_name: "",
    doctor_name: "",
    hospital_name: "",
    estimated_value: "",
    procedure_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const reset = () =>
    setForm({
      procedure_type: "cag",
      patient_name: "",
      doctor_name: "",
      hospital_name: "",
      estimated_value: "",
      procedure_date: new Date().toISOString().slice(0, 10),
      notes: "",
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.patient_name.trim()) return toast.error("Patient name required");
    let centreId = profile?.centre_id;
    if (!centreId) {
      const { data: c } = await supabase.from("centres").select("id").limit(1).maybeSingle();
      centreId = c?.id;
    }
    if (!centreId) return toast.error("No centre available");

    setLoading(true);
    const { error } = await supabase.from("procedures").insert({
      user_id: user.id,
      centre_id: centreId,
      checkin_id: checkinId || null,
      procedure_type: form.procedure_type,
      patient_name: form.patient_name.trim(),
      doctor_name: form.doctor_name.trim() || null,
      hospital_name: form.hospital_name.trim() || null,
      estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
      procedure_date: form.procedure_date,
      notes: form.notes.trim() || null,
    });
    setLoading(false);

    if (error) return toast.error(error.message);
    toast.success("Procedure added");
    reset();
    setOpen(false);
    onAdded?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-1">
            <Plus className="h-4 w-4" /> Add Procedure
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-destructive" /> New Procedure
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Procedure Type *</Label>
            <Select
              value={form.procedure_type}
              onValueChange={(v) => setForm((p) => ({ ...p, procedure_type: v as ProcKind }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cag">CAG (Coronary Angiogram)</SelectItem>
                <SelectItem value="ptca">PTCA (Angioplasty)</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Patient Name *</Label>
            <Input
              value={form.patient_name}
              onChange={(e) => setForm((p) => ({ ...p, patient_name: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Doctor</Label>
              <Input
                value={form.doctor_name}
                onChange={(e) => setForm((p) => ({ ...p, doctor_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Hospital</Label>
              <Input
                value={form.hospital_name}
                onChange={(e) => setForm((p) => ({ ...p, hospital_name: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.procedure_date}
                onChange={(e) => setForm((p) => ({ ...p, procedure_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Estimated Value (₹)</Label>
              <Input
                type="number"
                value={form.estimated_value}
                onChange={(e) => setForm((p) => ({ ...p, estimated_value: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving…" : "Save Procedure"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
