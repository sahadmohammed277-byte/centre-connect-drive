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

  const [rates, setRates] = useState<RateRow[]>([]);
  const [savingRates, setSavingRates] = useState(false);

  useEffect(() => {
    fetchSettings().then((v) => { setS(v); setLoading(false); });
    void loadRates();
  }, []);

  async function loadRates() {
    const { data: centres } = await supabase.from("centres").select("id, name").order("name");
    const { data: existing } = await (supabase as any).from("centre_procedure_rates").select("*");
    const map = new Map<string, any>();
    (existing || []).forEach((r: any) => map.set(r.centre_id, r));
    const rows: RateRow[] = (centres || []).map((c: any) => ({
      centre_id: c.id,
      centre_name: c.name,
      cag_rate: Number(map.get(c.id)?.cag_rate ?? 0),
      ptca_rate: Number(map.get(c.id)?.ptca_rate ?? 0),
    }));
    setRates(rows);
  }

  function updateRateRow(centre_id: string, field: "cag_rate" | "ptca_rate", value: number) {
    setRates((prev) => prev.map((r) => (r.centre_id === centre_id ? { ...r, [field]: value } : r)));
  }

  async function saveRates() {
    setSavingRates(true);
    try {
      const payload = rates.map((r) => ({
        centre_id: r.centre_id,
        cag_rate: Number(r.cag_rate) || 0,
        ptca_rate: Number(r.ptca_rate) || 0,
      }));
      const { error } = await (supabase as any)
        .from("centre_procedure_rates")
        .upsert(payload, { onConflict: "centre_id" });
      if (error) throw error;
      toast.success("Procedure rates saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save rates");
    } finally {
      setSavingRates(false);
    }
  }

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

      <Card>
        <CardHeader>
          <CardTitle>Procedure Rates by Centre</CardTitle>
          <p className="text-xs text-muted-foreground">Revenue = (CAG × CAG Rate) + (PTCA × PTCA Rate). Rates are applied per centre.</p>
        </CardHeader>
        <CardContent>
          {rates.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No centres found. Create centres first.</div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Centre Name</TableHead>
                    <TableHead className="text-right w-[180px]">CAG Rate (₹)</TableHead>
                    <TableHead className="text-right w-[180px]">PTCA Rate (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rates.map((r) => (
                    <TableRow key={r.centre_id}>
                      <TableCell className="font-medium">{r.centre_name}</TableCell>
                      <TableCell className="text-right">
                        <Input type="number" min={0} value={r.cag_rate}
                          onChange={(e) => updateRateRow(r.centre_id, "cag_rate", Number(e.target.value))}
                          className="text-right" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input type="number" min={0} value={r.ptca_rate}
                          onChange={(e) => updateRateRow(r.centre_id, "ptca_rate", Number(e.target.value))}
                          className="text-right" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={saveRates} disabled={savingRates}>
              {savingRates ? "Saving…" : "Save Procedure Rates"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
      </div>
    </div>
  );
}
