import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { DataTableShell } from "@/components/admin/DataTableShell";
import { CheckCircle2, XCircle, Eye, RefreshCw, Lock } from "lucide-react";
import { toast } from "sonner";

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [claims, setClaims] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [centres, setCentres] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [reviewClaim, setReviewClaim] = useState<any | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve");
  const [comments, setComments] = useState("");
  const [dayBreakdown, setDayBreakdown] = useState<any[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const [cl, p, c] = await Promise.all([
      supabase.from("monthly_claims").select("*").order("claim_month", { ascending: false }),
      supabase.from("profiles").select("*"),
      supabase.from("centres").select("*"),
    ]);
    setClaims(cl.data || []);
    setProfiles(p.data || []);
    setCentres(c.data || []);
    setLoading(false);
  }

  async function generateClaims() {
    setGenerating(true);
    const claimMonth = `${month}-01`;
    const { data, error } = await supabase.rpc("generate_monthly_claims", { _claim_month: claimMonth });
    setGenerating(false);
    if (error) return toast.error(error.message);
    const res = data?.[0];
    toast.success(`Generated: ${res?.claims_created ?? 0} new, ${res?.claims_updated ?? 0} updated`);
    void load();
  }

  async function loadBreakdown(claim: any) {
    setBreakdownLoading(true);
    const monthStart = claim.claim_month;
    const d = new Date(monthStart);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
    const { data: checkins } = await supabase
      .from("daily_checkins")
      .select("id, checkin_date, total_km, status, checkin_time, checkout_time")
      .eq("user_id", claim.user_id)
      .gte("checkin_date", monthStart)
      .lte("checkin_date", monthEnd)
      .order("checkin_date");
    const ids = (checkins || []).map((c) => c.id);
    let visitMap: Record<string, { total: number; doctors: number }> = {};
    if (ids.length) {
      const { data: visits } = await supabase
        .from("visits")
        .select("checkin_id, visitor_type")
        .in("checkin_id", ids);
      (visits || []).forEach((v) => {
        const k = v.checkin_id;
        if (!visitMap[k]) visitMap[k] = { total: 0, doctors: 0 };
        visitMap[k].total++;
        if (v.visitor_type === "doctor") visitMap[k].doctors++;
      });
    }
    setDayBreakdown((checkins || []).map((c) => ({
      ...c,
      total_visits: visitMap[c.id]?.total || 0,
      doctor_visits: visitMap[c.id]?.doctors || 0,
    })));
    setBreakdownLoading(false);
  }

  function openReview(claim: any, action: "approve" | "reject") {
    setReviewClaim(claim);
    setReviewAction(action);
    setComments("");
    setDayBreakdown([]);
    void loadBreakdown(claim);
  }

  function openDetails(claim: any) {
    setReviewClaim(claim);
    setReviewAction("approve");
    setComments(claim.admin_comments || "");
    setDayBreakdown([]);
    void loadBreakdown(claim);
  }

  async function submitReview() {
    if (!reviewClaim || !user) return;
    if (reviewAction === "reject" && !comments.trim()) {
      return toast.error("Reason required for rejection");
    }
    const newStatus = reviewAction === "approve" ? "approved" : "rejected";
    const { error } = await supabase
      .from("monthly_claims")
      .update({
        status: newStatus,
        admin_comments: comments.trim() || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq("id", reviewClaim.id);
    if (error) return toast.error(error.message);
    await supabase.from("audit_logs").insert({
      action: `claim_${newStatus}`,
      user_id: user.id,
      record_id: reviewClaim.id,
      table_name: "monthly_claims",
      reason: comments.trim() || null,
    });
    toast.success(`Claim ${newStatus}`);
    setReviewClaim(null);
    setComments("");
    void load();
  }

  const filtered = claims.filter((c) => {
    if (!search) return true;
    const p = profiles.find((x) => x.user_id === c.user_id);
    return p?.full_name?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <Label className="text-xs">Claim Month</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
        </div>
        <Button onClick={generateClaims} disabled={generating}>
          <RefreshCw className={`h-4 w-4 mr-2 ${generating ? "animate-spin" : ""}`} />
          {generating ? "Generating…" : "Generate Monthly Claims"}
        </Button>
      </div>

      <DataTableShell
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search staff…"
        isEmpty={!loading && filtered.length === 0}
        emptyMessage='No claims yet. Click "Generate Monthly Claims" to aggregate daily activity.'
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff</TableHead>
              <TableHead>Centre</TableHead>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Days</TableHead>
              <TableHead className="text-right">KM</TableHead>
              <TableHead className="text-right">Dr Visits</TableHead>
              <TableHead className="text-right">TA</TableHead>
              <TableHead className="text-right">DA</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => {
              const p = profiles.find((x) => x.user_id === c.user_id);
              const cn = centres.find((x) => x.id === c.centre_id);
              const locked = c.status === "approved";
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{p?.full_name || "—"}</TableCell>
                  <TableCell>{cn?.name || "—"}</TableCell>
                  <TableCell>{new Date(c.claim_month).toLocaleString("default", { month: "short", year: "numeric" })}</TableCell>
                  <TableCell className="text-right">{c.working_days}</TableCell>
                  <TableCell className="text-right">{Number(c.total_km ?? 0).toFixed(1)}</TableCell>
                  <TableCell className="text-right">{c.total_doctor_visits}</TableCell>
                  <TableCell className="text-right">₹{Number(c.total_ta).toFixed(0)}</TableCell>
                  <TableCell className="text-right">₹{Number(c.total_da).toFixed(0)}</TableCell>
                  <TableCell className="text-right font-semibold">₹{Number(c.grand_total).toFixed(0)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <StatusBadge status={c.status} />
                      {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {c.status === "submitted" ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => openDetails(c)} title="View">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="text-success border-success/30 hover:bg-success/10"
                          onClick={() => openReview(c, "approve")} title="Approve">
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => openReview(c, "reject")} title="Reject">
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => openDetails(c)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DataTableShell>

      <Dialog open={!!reviewClaim} onOpenChange={() => setReviewClaim(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {reviewClaim?.status === "submitted"
                ? `${reviewAction === "approve" ? "Approve" : "Reject"} Claim`
                : "Claim Details"}
            </DialogTitle>
          </DialogHeader>
          {reviewClaim && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Working Days" value={reviewClaim.working_days} />
                <Stat label="Total KM" value={Number(reviewClaim.total_km ?? 0).toFixed(1)} />
                <Stat label="Doctor Visits" value={reviewClaim.total_doctor_visits} />
                <Stat label="DA Eligible Days" value={reviewClaim.da_eligible_days} />
                <Stat label="TA" value={`₹${Number(reviewClaim.total_ta).toFixed(0)}`} />
                <Stat label="DA" value={`₹${Number(reviewClaim.total_da).toFixed(0)}`} />
                <Stat label="Grand Total" value={`₹${Number(reviewClaim.grand_total).toFixed(0)}`} bold />
                <Stat label="Status" value={reviewClaim.status} />
              </div>

              <div>
                <p className="font-medium mb-2">Day-wise Breakdown</p>
                {breakdownLoading ? (
                  <p className="text-muted-foreground text-xs">Loading…</p>
                ) : dayBreakdown.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No daily activity in this month.</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">KM</TableHead>
                          <TableHead className="text-right">Visits</TableHead>
                          <TableHead className="text-right">Dr</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dayBreakdown.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell>{new Date(d.checkin_date).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">{Number(d.total_km ?? 0).toFixed(1)}</TableCell>
                            <TableCell className="text-right">{d.total_visits}</TableCell>
                            <TableCell className="text-right">{d.doctor_visits}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{d.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {reviewClaim.status === "submitted" ? (
                <div className="space-y-2">
                  <Label>{reviewAction === "reject" ? "Reason (required)" : "Comments (optional)"}</Label>
                  <Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} />
                </div>
              ) : (
                reviewClaim.admin_comments && (
                  <div className="rounded-lg bg-muted p-3 text-xs">
                    <p className="font-medium mb-1">Admin comments</p>
                    {reviewClaim.admin_comments}
                  </div>
                )
              )}
              {reviewClaim.status === "approved" && (
                <div className="rounded-lg bg-success/10 border border-success/30 p-3 text-xs flex items-center gap-2">
                  <Lock className="h-3 w-3" /> This claim is approved and locked from edits.
                </div>
              )}
            </div>
          )}
          {reviewClaim?.status === "submitted" && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewClaim(null)}>Cancel</Button>
              <Button
                onClick={submitReview}
                className={reviewAction === "approve" ? "bg-success hover:bg-success/90" : ""}
                variant={reviewAction === "reject" ? "destructive" : "default"}
              >
                Confirm {reviewAction === "approve" ? "Approval" : "Rejection"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: any = {
    draft: <Badge variant="outline">Draft</Badge>,
    submitted: <Badge className="bg-warning text-warning-foreground hover:bg-warning">Submitted</Badge>,
    approved: <Badge className="bg-success text-success-foreground hover:bg-success">Approved</Badge>,
    rejected: <Badge variant="destructive">Rejected</Badge>,
  };
  return map[status] || <Badge variant="outline">{status}</Badge>;
}

function Stat({ label, value, bold }: any) {
  return (
    <div className="rounded-lg border p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={bold ? "text-base font-bold text-primary" : "text-sm font-semibold"}>{value}</p>
    </div>
  );
}
