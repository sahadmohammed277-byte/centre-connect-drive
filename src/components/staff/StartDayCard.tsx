import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useCheckin } from "@/hooks/useCheckin";
import { getCurrentPosition, distanceKm } from "@/lib/geo";

export default function StartDayCard() {
  const { todayCheckin, startDay, endDay } = useCheckin();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Try to grab GPS but don't block start/end if denied — staff can start from anywhere.
  const tryGetPosition = async (): Promise<{ lat: number | null; lng: number | null }> => {
    try {
      const pos = await getCurrentPosition();
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
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

    // Build waypoint path: start → each visit (in chronological order) → end.
    let km = 0;
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
        if (v.visit_lat != null && v.visit_lng != null) path.push({ lat: v.visit_lat, lng: v.visit_lng });
      });
      if (lat != null && lng != null) path.push({ lat, lng });
      for (let i = 1; i < path.length; i++) {
        km += distanceKm(path[i - 1].lat, path[i - 1].lng, path[i].lat, path[i].lng);
      }
    } catch {
      // Fallback: simple start→end distance
      if (lat != null && lng != null && checkinLat != null && checkinLng != null) {
        km = distanceKm(checkinLat, checkinLng, lat, lng);
      }
    }
    // Validation: clamp to realistic daily limit.
    if (km < 0) km = 0;
    if (km > 300) km = 300;
    km = Math.round(km * 10) / 10;

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
            <p className="font-medium">{todayCheckin.total_km ?? 0} km</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
