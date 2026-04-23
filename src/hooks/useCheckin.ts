import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DailyCheckin {
  id: string;
  user_id: string;
  centre_id: string;
  checkin_date: string;
  checkin_time: string | null;
  checkin_lat: number | null;
  checkin_lng: number | null;
  checkout_time: string | null;
  checkout_lat: number | null;
  checkout_lng: number | null;
  gps_km: number | null;
  manual_start_km: number | null;
  manual_end_km: number | null;
  manual_km_approved: boolean | null;
  total_km: number | null;
  status: string;
}

export function useCheckin() {
  const { user, profile } = useAuth();
  const [todayCheckin, setTodayCheckin] = useState<DailyCheckin | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchToday = async () => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("daily_checkins")
      .select("*")
      .eq("user_id", user.id)
      .eq("checkin_date", today)
      .maybeSingle();
    setTodayCheckin(data as DailyCheckin | null);
    setLoading(false);
  };

  useEffect(() => {
    fetchToday();
  }, [user]);

  const startDay = async (lat: number, lng: number) => {
    if (!user) return null;
    // centre_id is kept for reporting but no longer restricts check-in.
    // If staff has no centre assigned, pick the first available centre as a fallback.
    let centreId = profile?.centre_id;
    if (!centreId) {
      const { data: c } = await supabase.from("centres").select("id").limit(1).maybeSingle();
      centreId = c?.id;
    }
    if (!centreId) return null;
    const { data, error } = await supabase
      .from("daily_checkins")
      .insert({
        user_id: user.id,
        centre_id: centreId,
        checkin_time: new Date().toISOString(),
        checkin_lat: lat,
        checkin_lng: lng,
        status: "checked_in",
      })
      .select()
      .single();
    if (!error && data) {
      setTodayCheckin(data as DailyCheckin);
    }
    return { data, error };
  };

  const endDay = async (lat: number, lng: number, gpsKm: number) => {
    if (!todayCheckin) return null;
    const { data, error } = await supabase
      .from("daily_checkins")
      .update({
        checkout_time: new Date().toISOString(),
        checkout_lat: lat,
        checkout_lng: lng,
        gps_km: gpsKm,
        status: "checked_out",
      })
      .eq("id", todayCheckin.id)
      .select()
      .single();
    if (!error && data) {
      setTodayCheckin(data as DailyCheckin);
    }
    return { data, error };
  };

  return { todayCheckin, loading, startDay, endDay, refetch: fetchToday };
}
