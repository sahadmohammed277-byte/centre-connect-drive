import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, MapPin, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { getCurrentPosition } from "@/lib/geo";

type VisitorType = Database["public"]["Enums"]["visitor_type"];

interface Props {
  checkinId: string;
  onAdded: () => void;
}

export default function AddVisitDialog({ checkinId, onAdded }: Props) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [form, setForm] = useState({
    visitor_type: "doctor" as VisitorType,
    visitor_name: "",
    doctor_name: "",
    place: "",
    designation: "",
    contact_number: "",
    purpose: "",
    notes: "",
  });

  const captureLocation = async () => {
    setGpsLoading(true);
    setGpsError("");
    try {
      const pos = await getCurrentPosition();
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch (err: any) {
      setGpsError(err.message || "Failed to capture GPS location.");
    }
    setGpsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile?.centre_id) return;
    if (!coords) {
      setGpsError("GPS location is required for every visit. Tap 'Capture Location'.");
      return;
    }
    setLoading(true);

    const visitorName = form.visitor_type === "doctor" && form.doctor_name
      ? form.doctor_name
      : form.visitor_name;

    const { error } = await supabase.from("visits").insert({
      user_id: user.id,
      checkin_id: checkinId,
      centre_id: profile.centre_id,
      visitor_type: form.visitor_type,
      visitor_name: visitorName,
      doctor_name: form.doctor_name || null,
      place: form.place || null,
      designation: form.designation || null,
      contact_number: form.contact_number || null,
      purpose: form.purpose || null,
      notes: form.notes || null,
      visit_lat: coords.lat,
      visit_lng: coords.lng,
      checkin_time: new Date().toISOString(),
    });

    if (error) {
      toast.error("Failed to add visit");
    } else {
      toast.success("Visit started");
      setForm({ visitor_type: "doctor", visitor_name: "", doctor_name: "", place: "", designation: "", contact_number: "", purpose: "", notes: "" });
      setCoords(null);
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
          {/* GPS Capture - mandatory */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <Label className="flex items-center gap-1 text-sm">
              <MapPin className="h-4 w-4" /> Visit Location *
            </Label>
            {coords ? (
              <p className="text-xs text-success font-medium">
                ✓ Captured: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">GPS is required for every visit.</p>
            )}
            {gpsError && (
              <div className="flex items-start gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" /> <span>{gpsError}</span>
              </div>
            )}
            <Button type="button" size="sm" variant="outline" onClick={captureLocation} disabled={gpsLoading} className="w-full">
              {gpsLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <MapPin className="h-3 w-3 mr-1" />}
              {coords ? "Recapture Location" : "Capture Location"}
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Visitor Type *</Label>
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

          {form.visitor_type === "doctor" ? (
            <div className="space-y-2">
              <Label>Doctor Name *</Label>
              <Input value={form.doctor_name} onChange={set("doctor_name")} required />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Visitor Name *</Label>
              <Input value={form.visitor_name} onChange={set("visitor_name")} required />
            </div>
          )}

          <div className="space-y-2">
            <Label>Place *</Label>
            <Input
              value={form.place}
              onChange={set("place")}
              placeholder="Hospital / clinic / area name"
              required
            />
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
          <Button type="submit" className="w-full" disabled={loading || !coords}>
            {loading ? "Saving..." : "Save Visit"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
