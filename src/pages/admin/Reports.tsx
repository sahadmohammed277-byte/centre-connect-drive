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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { fetchSettings, AppSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { DATE_RANGE_PRESETS, getPresetDates, detectPreset, todayISO } from "@/lib/date-range";

const VISIT_TYPES = ["doctor", "ambulance", "ambulance_driver", "hospital", "lab", "kol", "pharmacy", "other"] as const;
const VISIT_COLUMNS: { key: string; label: string; types: string[] }[] = [
  { key: "doctor", label: "Doctor", types: ["doctor"] },
  { key: "ambulance", label: "Ambulance", types: ["ambulance", "ambulance_driver"] },
  { key: "hospital", label: "Hospital", types: ["hospital"] },
  { key: "lab", label: "Lab", types: ["lab"] },
  { key: "kol", label: "KOL", types: ["kol"] },
  { key: "pharmacy", label: "Pharmacy", types: ["pharmacy"] },
  { key: "other", label: "Other", types: ["other"] },
];

type StaffRow = {
  user_id: string;
  centre_id: string | null;
  working_days: number;
  total_km: number;
  doctor_visits: number;
  total_visits: number;
  visits_by_type: Record<string, number>;
  referrals: number;
  cag: number;
  ptca: number;
  da_eligible_days: number;
  total_ta: number;
  total_da: number;
  revenue: number;
  grand_total: number;
};

export default function ReportsPage() {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [datePreset, setDatePreset] = useState(detectPreset(from, to));
  const [centreFilter, setCentreFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [centres, setCentres] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [rates, setRates] = useState<Record<string, { cag: number; ptca: number }>>({});
  const [report, setReport] = useState<StaffRow[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [c, p, s, r] = await Promise.all([
        supabase.from("centres").select("*").order("name"),
        supabase.from("profiles").select("*"),
        fetchSettings(),
        (supabase as any).from("centre_procedure_rates").select("*"),
      ]);
      setCentres(c.data || []);
      setProfiles(p.data || []);
      setSettings(s);
      const rateMap: Record<string, { cag: number; ptca: number }> = {};
      ((r as any).data || []).forEach((row: any) => {
        rateMap[row.centre_id] = { cag: Number(row.cag_rate) || 0, ptca: Number(row.ptca_rate) || 0 };
      });
      setRates(rateMap);
    })();
  }, []);

  useEffect(() => { void run(); }, [from, to, centreFilter, staffFilter, rates, settings]);

  // Realtime: re-run report when procedures or referrals change
  useEffect(() => {
    const ch = supabase
      .channel("admin-reports-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "procedures" }, () => { void run(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "referrals" }, () => { void run(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_checkins" }, () => { void run(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "visits" }, () => { void run(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, centreFilter, staffFilter]);

  async function run() {
    setLoading(true);
    let cq = supabase.from("daily_checkins").select("*").gte("checkin_date", from).lte("checkin_date", to);
    let vq = supabase.from("visits").select("user_id, visitor_type, visit_date, centre_id").gte("visit_date", from).lte("visit_date", to);
    // Use procedures table (single source of truth for referrals + procedure status)
    let pq = supabase
      .from("procedures")
      .select("user_id, centre_id, procedure_type, procedure_status, estimated_value, procedure_date")
      .gte("procedure_date", from).lte("procedure_date", to);
    if (centreFilter !== "all") {
      cq = cq.eq("centre_id", centreFilter);
      vq = vq.eq("centre_id", centreFilter);
      pq = pq.eq("centre_id", centreFilter);
    }
    if (staffFilter !== "all") {
      cq = cq.eq("user_id", staffFilter);
      vq = vq.eq("user_id", staffFilter);
      pq = pq.eq("user_id", staffFilter);
    }
    const [cRes, vRes, pRes] = await Promise.all([cq, vq, pq]);
    const map: Record<string, StaffRow> = {};
    const ensure = (uid: string, centre_id: string | null) => {
      if (!map[uid]) {
        map[uid] = {
          user_id: uid, centre_id,
          working_days: 0, total_km: 0, doctor_visits: 0,
          total_visits: 0, visits_by_type: {},
          referrals: 0, cag: 0, ptca: 0,
          da_eligible_days: 0, total_ta: 0, total_da: 0, revenue: 0, grand_total: 0,
        };
      } else if (!map[uid].centre_id && centre_id) {
        map[uid].centre_id = centre_id;
      }
      return map[uid];
    };

    (cRes.data || []).forEach((ci: any) => {
      const row = ensure(ci.user_id, ci.centre_id);
      row.working_days += 1;
      row.total_km += ci.total_km ?? 0;
    });

    // Per-day TOTAL visit count drives DA eligibility (flat amount per day)
    const visitsByUserDate: Record<string, number> = {};
    (vRes.data || []).forEach((v: any) => {
      const row = ensure(v.user_id, v.centre_id);
      const k = `${v.user_id}|${v.visit_date}`;
      visitsByUserDate[k] = (visitsByUserDate[k] || 0) + 1;
      row.total_visits += 1;
      const t = String(v.visitor_type || "other");
      row.visits_by_type[t] = (row.visits_by_type[t] || 0) + 1;
      if (v.visitor_type === "doctor") row.doctor_visits += 1;
    });
    Object.entries(visitsByUserDate).forEach(([k, count]) => {
      if (count >= settings.min_doctor_visits_for_da) {
        const [uid] = k.split("|");
        const row = ensure(uid, null);
        row.da_eligible_days += 1;
      }
    });

    // Referrals = total procedure records; CAG/PTCA = only DONE procedures
    (pRes.data || []).forEach((r: any) => {
      const row = ensure(r.user_id, r.centre_id);
      row.referrals += 1;
      if (r.procedure_status !== "done") return;
      const rate = rates[r.centre_id] || { cag: 0, ptca: 0 };
      const type = String(r.procedure_type || "").toLowerCase();
      if (type === "cag") {
        row.cag += 1;
        row.revenue += rate.cag || Number(r.estimated_value) || 0;
      } else if (type === "ptca") {
        row.ptca += 1;
        row.revenue += rate.ptca || Number(r.estimated_value) || 0;
      } else {
        row.revenue += Number(r.estimated_value) || 0;
      }
    });

    // DA flat per eligible day
    Object.values(map).forEach((r) => {
      r.total_da = r.da_eligible_days * settings.da_rate_per_km;
      const km = Math.max(0, Math.min(r.total_km, settings.max_daily_km || 300));
      r.total_ta = Math.round(km * settings.ta_rate_per_km);
      r.grand_total = r.total_ta + r.total_da + r.revenue;
    });

    setReport(Object.values(map));
    setLoading(false);
  }

  const filtered = report;

  // Centre-wise aggregation
  const byCentre = (() => {
    const m: Record<string, StaffRow & { centre_name: string }> = {};
    filtered.forEach((r) => {
      const cid = r.centre_id || "unassigned";
      const cname = centres.find((c) => c.id === cid)?.name || "Unassigned";
      if (!m[cid]) {
        m[cid] = { ...r, visits_by_type: { ...r.visits_by_type }, centre_id: cid, centre_name: cname, user_id: cid };
      } else {
        const t = m[cid];
        t.working_days += r.working_days;
        t.total_km += r.total_km;
        t.doctor_visits += r.doctor_visits;
        t.total_visits += r.total_visits;
        for (const [k, v] of Object.entries(r.visits_by_type)) {
          t.visits_by_type[k] = (t.visits_by_type[k] || 0) + v;
        }
        t.referrals += r.referrals;
        t.cag += r.cag;
        t.ptca += r.ptca;
        t.da_eligible_days += r.da_eligible_days;
        t.total_ta += r.total_ta;
        t.total_da += r.total_da;
        t.revenue += r.revenue;
        t.grand_total += r.grand_total;
      }
    });
    return Object.values(m);
  })();

  function downloadCSV() {
    const header = ["Staff", "Employee ID", "Centre", "Working Days", "KM", "Doctor Visits", "Referrals", "CAG", "PTCA", "DA Days", "TA (₹)", "DA (₹)", "Revenue (₹)", "Total (₹)"];
    const lines = [header.join(",")];
    filtered.forEach((r) => {
      const p = profiles.find((x) => x.user_id === r.user_id);
      const c = centres.find((x) => x.id === (p?.centre_id || r.centre_id));
      lines.push([
        `"${p?.full_name || ""}"`,
        p?.employee_id || "",
        `"${c?.name || ""}"`,
        r.working_days,
        r.total_km.toFixed(1),
        r.doctor_visits,
        r.referrals,
        r.cag,
        r.ptca,
        r.da_eligible_days,
        r.total_ta.toFixed(0),
        r.total_da.toFixed(0),
        r.revenue.toFixed(0),
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
      const c = centres.find((x) => x.id === (p?.centre_id || r.centre_id));
      return `<tr>
        <td>${p?.full_name || ""}</td>
        <td>${c?.name || ""}</td>
        <td style="text-align:right">${r.working_days}</td>
        <td style="text-align:right">${r.total_km.toFixed(1)}</td>
        <td style="text-align:right">${r.doctor_visits}</td>
        <td style="text-align:right">${r.referrals}</td>
        <td style="text-align:right">${r.cag}</td>
        <td style="text-align:right">${r.ptca}</td>
        <td style="text-align:right">${r.da_eligible_days}</td>
        <td style="text-align:right">₹${r.total_ta.toFixed(0)}</td>
        <td style="text-align:right">₹${r.total_da.toFixed(0)}</td>
        <td style="text-align:right">₹${r.revenue.toFixed(0)}</td>
        <td style="text-align:right"><strong>₹${r.grand_total.toFixed(0)}</strong></td>
      </tr>`;
    }).join("");
    w.document.write(`
      <html><head><title>Performance Report</title>
      <style>body{font-family:system-ui;padding:24px}h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ddd;padding:5px 6px;text-align:left}th{background:#f3f4f6}</style>
      </head><body>
      <h1>KH Referral — Performance Report</h1>
      <p>Period: <strong>${from}</strong> to <strong>${to}</strong></p>
      <table><thead><tr><th>Staff</th><th>Centre</th><th>Days</th><th>KM</th><th>Docs</th><th>Refs</th><th>CAG</th><th>PTCA</th><th>DA Days</th><th>TA</th><th>DA</th><th>Revenue</th><th>Total</th></tr></thead>
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
    refs: acc.refs + r.referrals,
    cag: acc.cag + r.cag,
    ptca: acc.ptca + r.ptca,
    ta: acc.ta + r.total_ta,
    da: acc.da + r.total_da,
    revenue: acc.revenue + r.revenue,
    total: acc.total + r.grand_total,
  }), { days: 0, km: 0, docs: 0, refs: 0, cag: 0, ptca: 0, ta: 0, da: 0, revenue: 0, total: 0 });

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Date range:</span>
            {DATE_RANGE_PRESETS.map(({ value, label }) => (
              <Button
                key={value}
                size="sm"
                variant={datePreset === value ? "default" : "outline"}
                className="h-8 text-xs"
                onClick={() => {
                  setDatePreset(value);
                  if (value !== "custom") {
                    const { from: f, to: t } = getPresetDates(value);
                    setFrom(f);
                    setTo(t);
                  }
                }}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setDatePreset(detectPreset(e.target.value, to));
                }}
                className="w-[160px]"
              />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setDatePreset(detectPreset(from, e.target.value));
                }}
                className="w-[160px]"
              />
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
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryTile label="Working Days" value={totals.days} />
        <SummaryTile label="Total Referrals" value={totals.refs} />
        <SummaryTile label="Total CAG" value={totals.cag} />
        <SummaryTile label="Total PTCA" value={totals.ptca} />
        <SummaryTile label="Total Revenue" value={`₹${totals.revenue.toFixed(0)}`} highlight />
      </div>

      <Tabs defaultValue="staff" className="w-full">
        <TabsList>
          <TabsTrigger value="staff">Staff-wise</TabsTrigger>
          <TabsTrigger value="centre">Centre-wise</TabsTrigger>
        </TabsList>

        <TabsContent value="staff">
          <div className="rounded-lg border bg-card overflow-x-auto">
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
                    <TableHead className="text-right">Working Days</TableHead>
                    <TableHead className="text-right">KM</TableHead>
                    <TableHead className="text-right">Doctor Visits</TableHead>
                    <TableHead className="text-right">Referrals</TableHead>
                    <TableHead className="text-right">CAG</TableHead>
                    <TableHead className="text-right">PTCA</TableHead>
                    <TableHead className="text-right">DA Days</TableHead>
                    <TableHead className="text-right">TA</TableHead>
                    <TableHead className="text-right">DA</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const p = profiles.find((x) => x.user_id === r.user_id);
                    const c = centres.find((x) => x.id === (p?.centre_id || r.centre_id));
                    return (
                      <TableRow key={r.user_id}>
                        <TableCell className="font-medium">{p?.full_name || "—"}</TableCell>
                        <TableCell>{c?.name || "—"}</TableCell>
                        <TableCell className="text-right">{r.working_days}</TableCell>
                        <TableCell className="text-right">{r.total_km.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{r.doctor_visits}</TableCell>
                        <TableCell className="text-right">{r.referrals}</TableCell>
                        <TableCell className="text-right">{r.cag}</TableCell>
                        <TableCell className="text-right">{r.ptca}</TableCell>
                        <TableCell className="text-right">{r.da_eligible_days}</TableCell>
                        <TableCell className="text-right">₹{r.total_ta.toFixed(0)}</TableCell>
                        <TableCell className="text-right">₹{r.total_da.toFixed(0)}</TableCell>
                        <TableCell className="text-right">₹{r.revenue.toFixed(0)}</TableCell>
                        <TableCell className="text-right font-semibold">₹{r.grand_total.toFixed(0)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="centre">
          <div className="rounded-lg border bg-card overflow-x-auto">
            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
            ) : byCentre.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No data for selected filters.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Centre</TableHead>
                    <TableHead className="text-right">Working Days</TableHead>
                    <TableHead className="text-right">KM</TableHead>
                    <TableHead className="text-right">Doctor Visits</TableHead>
                    <TableHead className="text-right">Referrals</TableHead>
                    <TableHead className="text-right">CAG</TableHead>
                    <TableHead className="text-right">PTCA</TableHead>
                    <TableHead className="text-right">TA</TableHead>
                    <TableHead className="text-right">DA</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byCentre.map((r) => (
                    <TableRow key={r.centre_id || "unassigned"}>
                      <TableCell className="font-medium">{r.centre_name}</TableCell>
                      <TableCell className="text-right">{r.working_days}</TableCell>
                      <TableCell className="text-right">{r.total_km.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{r.doctor_visits}</TableCell>
                      <TableCell className="text-right">{r.referrals}</TableCell>
                      <TableCell className="text-right">{r.cag}</TableCell>
                      <TableCell className="text-right">{r.ptca}</TableCell>
                      <TableCell className="text-right">₹{r.total_ta.toFixed(0)}</TableCell>
                      <TableCell className="text-right">₹{r.total_da.toFixed(0)}</TableCell>
                      <TableCell className="text-right">₹{r.revenue.toFixed(0)}</TableCell>
                      <TableCell className="text-right font-semibold">₹{r.grand_total.toFixed(0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>
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
