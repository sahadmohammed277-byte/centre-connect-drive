import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { fetchSettings, calcSummary, AppSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

export default function ReportsPage() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today.toISOString().split("T")[0]);
  const [centreFilter, setCentreFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [centres, setCentres] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [report, setReport] = useState<any[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [c, p, s] = await Promise.all([
        supabase.from("centres").select("*").order("name"),
        supabase.from("profiles").select("*"),
        fetchSettings(),
      ]);
      setCentres(c.data || []);
      setProfiles(p.data || []);
      setSettings(s);
    })();
  }, []);

  useEffect(() => { void run(); }, [from, to, centreFilter, staffFilter]);

  async function run() {
    setLoading(true);
    let cq = supabase.from("daily_checkins").select("*").gte("checkin_date", from).lte("checkin_date", to);
    let vq = supabase.from("visits").select("user_id, visitor_type, visit_date").gte("visit_date", from).lte("visit_date", to);
    if (centreFilter !== "all") {
      cq = cq.eq("centre_id", centreFilter);
      vq = vq.eq("centre_id", centreFilter);
    }
    if (staffFilter !== "all") {
      cq = cq.eq("user_id", staffFilter);
      vq = vq.eq("user_id", staffFilter);
    }
    const [cRes, vRes] = await Promise.all([cq, vq]);
    const map: Record<string, any> = {};
    (cRes.data || []).forEach((ci: any) => {
      const k = ci.user_id;
      if (!map[k]) map[k] = { user_id: k, working_days: 0, total_km: 0, doctor_visits: 0, da_eligible_days: 0 };
      map[k].working_days += 1;
      map[k].total_km += ci.total_km ?? 0;
    });
    // Group visits by user+date
    const byUserDate: Record<string, number> = {};
    (vRes.data || []).forEach((v: any) => {
      if (v.visitor_type !== "doctor") return;
      const k = `${v.user_id}|${v.visit_date}`;
      byUserDate[k] = (byUserDate[k] || 0) + 1;
    });
    Object.entries(byUserDate).forEach(([k, count]) => {
      const [uid] = k.split("|");
      if (!map[uid]) map[uid] = { user_id: uid, working_days: 0, total_km: 0, doctor_visits: 0, da_eligible_days: 0 };
      map[uid].doctor_visits += count;
      if (count >= settings.min_doctor_visits_for_da) map[uid].da_eligible_days += 1;
    });
    // Compute per-day DA properly: re-iterate checkins
    const checkinsByUserDate: Record<string, number> = {};
    (cRes.data || []).forEach((ci: any) => {
      checkinsByUserDate[`${ci.user_id}|${ci.checkin_date}`] = ci.total_km ?? 0;
    });
    const daTotals: Record<string, number> = {};
    Object.entries(byUserDate).forEach(([k, count]) => {
      if (count >= settings.min_doctor_visits_for_da) {
        const km = checkinsByUserDate[k] || 0;
        const [uid] = k.split("|");
        daTotals[uid] = (daTotals[uid] || 0) + km * settings.da_rate_per_km;
      }
    });
    const final = Object.values(map).map((r: any) => {
      const ta = r.total_km * settings.ta_rate_per_km;
      const da = daTotals[r.user_id] || 0;
      return { ...r, total_ta: ta, total_da: da, grand_total: ta + da };
    });
    setReport(final);
    setLoading(false);
  }

  const filtered = report;

  function downloadCSV() {
    const header = ["Staff", "Employee ID", "Centre", "Working Days", "Total KM", "Doctor Visits", "DA Eligible Days", "TA (₹)", "DA (₹)", "Grand Total (₹)"];
    const lines = [header.join(",")];
    filtered.forEach((r) => {
      const p = profiles.find((x) => x.user_id === r.user_id);
      const c = centres.find((x) => x.id === p?.centre_id);
      lines.push([
        `"${p?.full_name || ""}"`,
        p?.employee_id || "",
        `"${c?.name || ""}"`,
        r.working_days,
        r.total_km.toFixed(1),
        r.doctor_visits,
        r.da_eligible_days,
        r.total_ta.toFixed(0),
        r.total_da.toFixed(0),
        r.grand_total.toFixed(0),
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }

  function downloadPDF() {
    const w = window.open("", "_blank");
    if (!w) return toast.error("Popup blocked");
    const rows = filtered.map((r) => {
      const p = profiles.find((x) => x.user_id === r.user_id);
      const c = centres.find((x) => x.id === p?.centre_id);
      return `<tr>
        <td>${p?.full_name || ""}</td>
        <td>${p?.employee_id || ""}</td>
        <td>${c?.name || ""}</td>
        <td style="text-align:right">${r.working_days}</td>
        <td style="text-align:right">${r.total_km.toFixed(1)}</td>
        <td style="text-align:right">${r.doctor_visits}</td>
        <td style="text-align:right">${r.da_eligible_days}</td>
        <td style="text-align:right">₹${r.total_ta.toFixed(0)}</td>
        <td style="text-align:right">₹${r.total_da.toFixed(0)}</td>
        <td style="text-align:right"><strong>₹${r.grand_total.toFixed(0)}</strong></td>
      </tr>`;
    }).join("");
    w.document.write(`
      <html><head><title>TA & DA Report</title>
      <style>body{font-family:system-ui;padding:24px}h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f3f4f6}</style>
      </head><body>
      <h1>KH Referral — TA & DA Report</h1>
      <p>Period: <strong>${from}</strong> to <strong>${to}</strong></p>
      <table><thead><tr><th>Staff</th><th>Emp ID</th><th>Centre</th><th>Days</th><th>KM</th><th>Doctors</th><th>DA Days</th><th>TA</th><th>DA</th><th>Total</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <script>window.print()</script>
      </body></html>
    `);
    w.document.close();
  }

  const totals = filtered.reduce((acc, r) => ({
    days: acc.days + r.working_days,
    km: acc.km + r.total_km,
    docs: acc.docs + r.doctor_visits,
    ta: acc.ta + r.total_ta,
    da: acc.da + r.total_da,
    total: acc.total + r.grand_total,
  }), { days: 0, km: 0, docs: 0, ta: 0, da: 0, total: 0 });

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[160px]" />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[160px]" />
          </div>
          <div>
            <Label className="text-xs">Centre</Label>
            <Select value={centreFilter} onValueChange={setCentreFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Centres</SelectItem>
                {centres.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Staff</Label>
            <Select value={staffFilter} onValueChange={setStaffFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Staff</SelectItem>
                {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={downloadCSV}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel/CSV</Button>
            <Button onClick={downloadPDF}><Download className="h-4 w-4 mr-2" />PDF</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <SummaryTile label="Working Days" value={totals.days} />
        <SummaryTile label="Total KM" value={totals.km.toFixed(1)} />
        <SummaryTile label="Doctor Visits" value={totals.docs} />
        <SummaryTile label="Total TA" value={`₹${totals.ta.toFixed(0)}`} />
        <SummaryTile label="Total DA" value={`₹${totals.da.toFixed(0)}`} />
        <SummaryTile label="Grand Total" value={`₹${totals.total.toFixed(0)}`} highlight />
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No data for selected filters.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Centre</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead className="text-right">KM</TableHead>
                <TableHead className="text-right">Doctors</TableHead>
                <TableHead className="text-right">DA Days</TableHead>
                <TableHead className="text-right">TA</TableHead>
                <TableHead className="text-right">DA</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const p = profiles.find((x) => x.user_id === r.user_id);
                const c = centres.find((x) => x.id === p?.centre_id);
                return (
                  <TableRow key={r.user_id}>
                    <TableCell className="font-medium">{p?.full_name || "—"}</TableCell>
                    <TableCell>{c?.name || "—"}</TableCell>
                    <TableCell className="text-right">{r.working_days}</TableCell>
                    <TableCell className="text-right">{r.total_km.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{r.doctor_visits}</TableCell>
                    <TableCell className="text-right">{r.da_eligible_days}</TableCell>
                    <TableCell className="text-right">₹{r.total_ta.toFixed(0)}</TableCell>
                    <TableCell className="text-right">₹{r.total_da.toFixed(0)}</TableCell>
                    <TableCell className="text-right font-semibold">₹{r.grand_total.toFixed(0)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function SummaryTile({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary" : ""}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-bold ${highlight ? "text-primary" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
