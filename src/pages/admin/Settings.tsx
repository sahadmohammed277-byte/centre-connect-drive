import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchSettings, updateSetting, AppSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type RateRow = { centre_id: string; centre_name: string; cag_rate: number; ptca_rate: number };

export default function SettingsPage() {
  const [s, setS] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings().then((v) => { setS(v); setLoading(false); });
  }, []);

  async function save() {
    setSaving(true);
    try {
      await Promise.all([
        updateSetting("da_rate_per_km", Number(s.da_rate_per_km)),
        updateSetting("ta_rate_per_km", Number(s.ta_rate_per_km)),
        updateSetting("min_doctor_visits_for_da", Number(s.min_doctor_visits_for_da)),
        updateSetting("manual_km_entry_enabled", !!s.manual_km_entry_enabled),
        updateSetting("notifications_enabled", !!s.notifications_enabled),
      ]);
      toast.success("Settings saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-20 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader><CardTitle>Allowance Rates</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>DA Rate (₹ / KM)</Label>
              <Input type="number" min={0} value={s.da_rate_per_km}
                onChange={(e) => setS({ ...s, da_rate_per_km: Number(e.target.value) })} />
              <p className="text-xs text-muted-foreground">Default ₹150</p>
            </div>
            <div className="space-y-2">
              <Label>TA Rate (₹ / KM)</Label>
              <Input type="number" min={0} value={s.ta_rate_per_km}
                onChange={(e) => setS({ ...s, ta_rate_per_km: Number(e.target.value) })} />
              <p className="text-xs text-muted-foreground">Default ₹4</p>
            </div>
            <div className="space-y-2">
              <Label>Min Doctor Visits for DA</Label>
              <Input type="number" min={0} value={s.min_doctor_visits_for_da}
                onChange={(e) => setS({ ...s, min_doctor_visits_for_da: Number(e.target.value) })} />
              <p className="text-xs text-muted-foreground">Default 5</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>System Controls</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label className="text-base">Manual KM Entry</Label>
              <p className="text-xs text-muted-foreground">Allow staff to enter KM manually (admin approval required)</p>
            </div>
            <Switch checked={s.manual_km_entry_enabled}
              onCheckedChange={(v) => setS({ ...s, manual_km_entry_enabled: v })} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label className="text-base">Notifications</Label>
              <p className="text-xs text-muted-foreground">Send reminders & alerts to staff in-app</p>
            </div>
            <Switch checked={s.notifications_enabled}
              onCheckedChange={(v) => setS({ ...s, notifications_enabled: v })} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
      </div>
    </div>
  );
}
