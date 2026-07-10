import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  trigger?: React.ReactNode;
}

type Suggestion = {
  name: string;
  place: string | null;
  contact_number: string | null;
  count: number;
  last: string;
};

export default function AddVisitDialog({ checkinId, onAdded, trigger }: Props) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [referral, setReferral] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState<Suggestion[]>([]);
  const [placeSuggestions, setPlaceSuggestions] = useState<{ place: string; count: number }[]>([]);
  const [showNameSug, setShowNameSug] = useState(false);
  const [showPlaceSug, setShowPlaceSug] = useState(false);
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
      console.log("[KM] Visit GPS captured:", pos.coords.latitude, pos.coords.longitude);
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch (err: any) {
      console.warn("[KM] Visit GPS failed:", err);
      setGpsError(err.message || "Failed to capture GPS location.");
    }
    setGpsLoading(false);
  };

  // Auto-capture GPS when the dialog opens so each visit becomes a real waypoint.
  useEffect(() => {
    if (open && !coords && !gpsLoading) {
      captureLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Load suggestions from user's own past visits.
  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const { data } = await supabase
        .from("visits")
        .select("visitor_type, visitor_name, doctor_name, place, contact_number, visit_date")
        .eq("user_id", user.id)
        .order("visit_date", { ascending: false })
        .limit(500);
      const rows = (data as any[]) || [];

      // Names aggregated by current visitor_type
      const nameMap = new Map<string, Suggestion>();
      rows.filter((r) => r.visitor_type === form.visitor_type).forEach((r) => {
        const name = (r.visitor_type === "doctor" ? r.doctor_name : r.visitor_name) || "";
        if (!name) return;
        const key = name.trim().toLowerCase();
        const cur = nameMap.get(key) || { name: name.trim(), place: r.place, contact_number: r.contact_number, count: 0, last: r.visit_date };
        cur.count += 1;
        if (!cur.place && r.place) cur.place = r.place;
        if (!cur.contact_number && r.contact_number) cur.contact_number = r.contact_number;
        if (r.visit_date > cur.last) cur.last = r.visit_date;
        nameMap.set(key, cur);
      });
      setNameSuggestions(Array.from(nameMap.values()).sort((a, b) => b.count - a.count));

      // Places aggregated across all types
      const placeMap = new Map<string, number>();
      rows.forEach((r) => {
        const p = (r.place || "").trim();
        if (!p) return;
        placeMap.set(p, (placeMap.get(p) || 0) + 1);
      });
      setPlaceSuggestions(Array.from(placeMap.entries()).map(([place, count]) => ({ place, count })).sort((a, b) => b.count - a.count));
    })();
  }, [open, user, form.visitor_type]);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    let centreId = profile?.centre_id;
    if (!centreId) {
      const { data: c } = await supabase.from("centres").select("id").limit(1).maybeSingle();
      centreId = c?.id;
    }
    if (!centreId) {
      toast.error("No centre available");
      return;
    }
    setLoading(true);

    const visitorName =
      form.visitor_type === "doctor" && form.doctor_name ? form.doctor_name : form.visitor_name;

    const { error } = await supabase.from("visits").insert({
      user_id: user.id,
      checkin_id: checkinId,
      centre_id: centreId,
      visitor_type: form.visitor_type,
      visitor_name: visitorName,
      doctor_name: form.doctor_name || null,
      place: form.place || null,
      designation: form.designation || null,
      contact_number: form.contact_number || null,
      purpose: form.purpose || null,
      notes: form.notes || null,
      visit_lat: coords?.lat ?? null,
      visit_lng: coords?.lng ?? null,
      checkin_time: new Date().toISOString(),
    });

    if (error) {
      toast.error("Failed to add visit");
      setLoading(false);
      return;
    }

    // Optional referral marker — record a lightweight referral row.
    if (referral) {
      await supabase.from("referrals").insert({
        user_id: user.id,
        checkin_id: checkinId,
        centre_id: centreId,
        referral_received: true,
        patient_count: 1,
        hospital_name: form.place || null,
        referral_centre: form.doctor_name || form.visitor_name || null,
        notes: form.notes || null,
      } as any);
    }

    toast.success("Visit added");
    setForm({
      visitor_type: "doctor", visitor_name: "", doctor_name: "", place: "",
      designation: "", contact_number: "", purpose: "", notes: "",
    });
    setCoords(null);
    setReferral(false);
    setOpen(false);
    onAdded();
    setLoading(false);
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-1">
            <Plus className="h-4 w-4" /> Add Visit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Visit</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* GPS Capture - optional */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <Label className="flex items-center gap-1 text-sm">
              <MapPin className="h-4 w-4" /> Location{" "}
              <span className="text-muted-foreground text-xs font-normal">(optional)</span>
            </Label>
            {coords ? (
              <p className="text-xs text-success font-medium">
                ✓ Captured: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Tap to record where this visit happened.</p>
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
            <Select
              value={form.visitor_type}
              onValueChange={(v) => setForm((p) => ({ ...p, visitor_type: v as VisitorType }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="doctor">Doctor</SelectItem>
                <SelectItem value="ambulance">Ambulance</SelectItem>
                <SelectItem value="hospital">Hospital</SelectItem>
                <SelectItem value="lab">Lab</SelectItem>
                <SelectItem value="kol">KOL</SelectItem>
                <SelectItem value="pharmacy">Pharmacy</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(() => {
            const isDoc = form.visitor_type === "doctor";
            const nameVal = isDoc ? form.doctor_name : form.visitor_name;
            const nameKey = isDoc ? "doctor_name" : "visitor_name";
            const q = nameVal.trim().toLowerCase();
            const filteredNames = q
              ? nameSuggestions.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 6)
              : nameSuggestions.slice(0, 6);
            return (
              <div className="space-y-2 relative">
                <Label>{isDoc ? "Doctor Name *" : "Visitor Name *"}</Label>
                <Input
                  value={nameVal}
                  onChange={set(nameKey)}
                  onFocus={() => setShowNameSug(true)}
                  onBlur={() => setTimeout(() => setShowNameSug(false), 150)}
                  autoComplete="off"
                  required
                />
                {showNameSug && filteredNames.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 top-full mt-1 rounded-md border bg-popover shadow-md max-h-56 overflow-y-auto">
                    {filteredNames.map((s) => (
                      <button
                        type="button"
                        key={s.name}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setForm((p) => ({
                            ...p,
                            [nameKey]: s.name,
                            place: p.place || s.place || "",
                            contact_number: p.contact_number || s.contact_number || "",
                          }));
                          setShowNameSug(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-b-0"
                      >
                        <div className="font-medium">{isDoc ? `Dr. ${s.name}` : s.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.place || "—"} · Visited {s.count} time{s.count > 1 ? "s" : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="space-y-2 relative">
            <Label>Place</Label>
            <Input
              value={form.place}
              onChange={set("place")}
              onFocus={() => setShowPlaceSug(true)}
              onBlur={() => setTimeout(() => setShowPlaceSug(false), 150)}
              placeholder="Hospital / clinic / area"
              autoComplete="off"
            />
            {showPlaceSug && (() => {
              const q = form.place.trim().toLowerCase();
              const list = (q
                ? placeSuggestions.filter((s) => s.place.toLowerCase().includes(q))
                : placeSuggestions
              ).slice(0, 6);
              if (list.length === 0) return null;
              return (
                <div className="absolute z-20 left-0 right-0 top-full mt-1 rounded-md border bg-popover shadow-md max-h-56 overflow-y-auto">
                  {list.map((s) => (
                    <button
                      type="button"
                      key={s.place}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setForm((p) => ({ ...p, place: s.place }));
                        setShowPlaceSug(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-b-0"
                    >
                      <div className="font-medium">{s.place}</div>
                      <div className="text-xs text-muted-foreground">Previously visited {s.count} time{s.count > 1 ? "s" : ""}</div>
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>


          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Designation</Label>
              <Input value={form.designation} onChange={set("designation")} />
            </div>
            <div className="space-y-2">
              <Label>Contact</Label>
              <Input value={form.contact_number} onChange={set("contact_number")} type="tel" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Purpose</Label>
            <Input value={form.purpose} onChange={set("purpose")} />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={set("notes")} rows={2} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">Mark as Referral</Label>
              <p className="text-xs text-muted-foreground">Did this visit produce a referral?</p>
            </div>
            <Switch checked={referral} onCheckedChange={setReferral} />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving..." : "Save Visit"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
