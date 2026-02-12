import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCheckin } from "@/hooks/useCheckin";
import { getCurrentPosition, distanceMeters } from "@/lib/geo";
import { supabase } from "@/integrations/supabase/client";

export default function StartDayCard() {
  const { profile } = useAuth();
  const { todayCheckin, startDay, endDay } = useCheckin();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleStartDay = async () => {
    setLoading(true);
    setError("");
    try {
      const pos = await getCurrentPosition();
      const { latitude, longitude } = pos.coords;

      // Fetch centre coordinates
      const { data: centre } = await supabase
        .from("centres")
        .select("*")
        .eq("id", profile!.centre_id!)
        .single();

      if (!centre) {
        setError("Centre not found.");
        setLoading(false);
        return;
      }

      const dist = distanceMeters(latitude, longitude, centre.latitude, centre.longitude);
      if (dist > centre.geo_fence_radius_meters) {
        setError(`You are ${Math.round(dist)}m from your centre. Please reach within ${centre.geo_fence_radius_meters}m to start your day.`);
        setLoading(false);
        return;
      }

      await startDay(latitude, longitude);
    } catch (err: any) {
      setError(err.message || "Failed to get location. Please enable GPS.");
    }
    setLoading(false);
  };

  const handleEndDay = async () => {
    setLoading(true);
    setError("");
    try {
      const pos = await getCurrentPosition();
      const { latitude, longitude } = pos.coords;
      const checkinLat = todayCheckin?.checkin_lat ?? 0;
      const checkinLng = todayCheckin?.checkin_lng ?? 0;
      const { distanceKm } = await import("@/lib/geo");
      const km = distanceKm(checkinLat, checkinLng, latitude, longitude);
      await endDay(latitude, longitude, km);
    } catch (err: any) {
      setError(err.message || "Failed to get location.");
    }
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
            Tap below when you reach your centre. GPS will verify your location.
          </p>
          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <Button onClick={handleStartDay} disabled={loading} className="w-full" size="lg">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MapPin className="h-4 w-4 mr-2" />}
            {loading ? "Verifying Location..." : "Start Day"}
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
