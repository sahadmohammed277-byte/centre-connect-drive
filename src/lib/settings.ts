import { supabase } from "@/integrations/supabase/client";

export interface AppSettings {
  da_rate_per_km: number;
  ta_rate_per_km: number;
  min_doctor_visits_for_da: number;
  manual_km_entry_enabled: boolean;
  notifications_enabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  da_rate_per_km: 150,
  ta_rate_per_km: 4,
  min_doctor_visits_for_da: 5,
  manual_km_entry_enabled: true,
  notifications_enabled: true,
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
  const { error } = await supabase
    .from("app_settings")
    .update({ value })
    .eq("key", key);
  if (error) throw error;
}

export function calcSummary(totalKm: number, doctorCount: number, s: AppSettings) {
  const ta = totalKm * s.ta_rate_per_km;
  const daEligible = doctorCount >= s.min_doctor_visits_for_da;
  const da = daEligible ? totalKm * s.da_rate_per_km : 0;
  return { totalKm, doctorCount, daEligible, ta, da, total: ta + da };
}
