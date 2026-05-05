import { supabase } from "@/integrations/supabase/client";

export interface AppSettings {
  /** Flat DA amount per day when visit threshold is met (₹) */
  da_rate_per_km: number;
  /** TA rate per KM (₹) */
  ta_rate_per_km: number;
  /** Minimum total visits per day to qualify for DA */
  min_doctor_visits_for_da: number;
  manual_km_entry_enabled: boolean;
  notifications_enabled: boolean;
  /** Maximum realistic daily KM allowed */
  max_daily_km: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  da_rate_per_km: 150,
  ta_rate_per_km: 5,
  min_doctor_visits_for_da: 5,
  manual_km_entry_enabled: true,
  notifications_enabled: true,
  max_daily_km: 300,
};

export async function fetchSettings(): Promise<AppSettings> {
  const { data } = await supabase.from("app_settings").select("key, value");
  const out: AppSettings = { ...DEFAULT_SETTINGS };
  (data || []).forEach((row: any) => {
    if (row.key in out) {
      (out as any)[row.key] = row.value;
    }
  });
  return out;
}

export async function updateSetting(key: keyof AppSettings, value: any) {
  // Upsert so newly-introduced keys (e.g. max_daily_km) are inserted on first save.
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw error;
}

/**
 * DA is now a flat per-day amount when total visits meet the threshold.
 * TA = km × ta_rate_per_km (capped at max_daily_km).
 */
export function calcSummary(totalKm: number, visitCount: number, s: AppSettings) {
  const km = Math.max(0, Math.min(totalKm || 0, s.max_daily_km || 300));
  const ta = Math.round(km * s.ta_rate_per_km);
  const daEligible = visitCount >= s.min_doctor_visits_for_da;
  const da = daEligible ? s.da_rate_per_km : 0;
  return { totalKm: km, visitCount, doctorCount: visitCount, daEligible, ta, da, total: ta + da };
}
