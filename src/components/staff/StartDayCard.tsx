import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useCheckin } from "@/hooks/useCheckin";
import { getCurrentPosition, distanceKm } from "@/lib/geo";

export default function StartDayCard() {
  const { todayCheckin, startDay, endDay } = useCheckin();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [gpsDenied, setGpsDenied] = useState(false);
  const [manualKm, setManualKm] = useState<string>("");

  // Detect permission state up-front so we can show the manual fallback.
  useEffect(() => {
    if (!("permissions" in navigator)) return;
    // @ts-ignore
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((s: any) => {
        setGpsDenied(s.state === "denied");
        s.onchange = () => setGpsDenied(s.state === "denied");
      })
      .catch(() => {});
  }, []);

  const tryGetPosition = async (): Promise<{ lat: number | null; lng: number | null }> => {
    try {
      const pos = await getCurrentPosition();
      console.log("[KM] GPS captured:", pos.coords.latitude, pos.coords.longitude);
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch (err) {
      console.warn("[KM] GPS capture failed:", err);
      setGpsDenied(true);
      return { lat: null, lng: null };
    }
  };

  const handleStartDay = async () => {
    setLoading(true);
    setError("");
    const { lat, lng } = await tryGetPosition();
    const res = await startDay(lat, lng);
    if (res?.error) setError(res.error.message || "Failed to start day");
    setLoading(false);
  };

  const handleEndDay = async () => {
    setLoading(true);
    setError("");
    const { lat, lng } = await tryGetPosition();
    const checkinLat = todayCheckin?.checkin_lat;
    const checkinLng = todayCheckin?.checkin_lng;

    // Manual override — use entered value when provided / when GPS unavailable.
    const manualVal = parseFloat(manualKm);
    const manualProvided = manualKm.trim() !== "" && !Number.isNaN(manualVal);

    let km = 0;
    if (manualProvided) {
      km = manualVal;
      console.log("[KM] Using manual entry:", km);
    } else {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: visits } = await supabase
          .from("visits")
          .select("visit_lat, visit_lng, checkin_time, created_at")
          .eq("checkin_id", todayCheckin!.id)
          .order("checkin_time", { ascending: true });
        const path: { lat: number; lng: number }[] = [];
        if (checkinLat != null && checkinLng != null) path.push({ lat: checkinLat, lng: checkinLng });
        (visits || []).forEach((v: any) => {
          if (v.visit_lat != null && v.visit_lng != null) {
            const last = path[path.length - 1];
            // Skip duplicate / near-duplicate points (<10m) to avoid noise.
            if (!last || distanceKm(last.lat, last.lng, v.visit_lat, v.visit_lng) > 0.01) {
              path.push({ lat: v.visit_lat, lng: v.visit_lng });
            }
          }
        });
        if (lat != null && lng != null) path.push({ lat, lng });
        console.log("[KM] Path waypoints:", path.length, path);
        for (let i = 1; i < path.length; i++) {
          const seg = distanceKm(path[i - 1].lat, path[i - 1].lng, path[i].lat, path[i].lng);
          console.log(`[KM] Segment ${i}: ${seg} km`);
          km += seg;
        }
      } catch (e) {
        console.error("[KM] Path calculation failed:", e);
        if (lat != null && lng != null && checkinLat != null && checkinLng != null) {
          km = distanceKm(checkinLat, checkinLng, lat, lng);
        }
      }
    }

    if (km < 0) km = 0;
    if (km > 300) km = 300;
    km = Math.round(km * 100) / 100;
    console.log("[KM] Final total_km:", km);

    const res = await endDay(lat, lng, km);
    if (res?.error) setError(res.error.message || "Failed to end day");
    setLoading(false);
  };

  if (!todayCheckin) {
    return (
      <Card className="border-dashed border-2 border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Start Your Day
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You can start your day from anywhere. We'll capture your location automatically if available.
          </p>
          {gpsDenied && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded-lg">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Location access required for automatic KM tracking. You can enter KM manually at end of day.</span>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <Button onClick={handleStartDay} disabled={loading} className="w-full" size="lg">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MapPin className="h-4 w-4 mr-2" />}
            {loading ? "Starting..." : "Start Day"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (todayCheckin.status === "checked_in") {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-success">
            <CheckCircle2 className="h-5 w-5" />
            Day Started
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Checked in at {new Date(todayCheckin.checkin_time!).toLocaleTimeString()}
          </p>
          {gpsDenied && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded-lg">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Location access denied — please enter KM manually below.</span>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="manual-km" className="text-xs text-muted-foreground">
              Manual KM (optional — overrides GPS)
            </Label>
            <Input
              id="manual-km"
              type="number"
              inputMode="decimal"
              min={0}
              max={300}
              step={0.1}
              placeholder="e.g. 24.5"
              value={manualKm}
              onChange={(e) => setManualKm(e.target.value)}
            />
          </div>
          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <Button onClick={handleEndDay} disabled={loading} variant="outline" className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            End Day
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-muted">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-muted-foreground">
          <CheckCircle2 className="h-5 w-5" />
          Day Completed
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Check-in:</span>
            <p className="font-medium">{new Date(todayCheckin.checkin_time!).toLocaleTimeString()}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Check-out:</span>
            <p className="font-medium">{new Date(todayCheckin.checkout_time!).toLocaleTimeString()}</p>
          </div>
          <div>
            <span className="text-muted-foreground">KM Travelled:</span>
            <p className="font-medium">{(todayCheckin.total_km ?? 0).toFixed(2)} km</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
