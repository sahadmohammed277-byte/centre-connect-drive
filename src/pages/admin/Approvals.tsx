import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { DataTableShell } from "@/components/admin/DataTableShell";
import { CheckCircle2, XCircle, Eye } from "lucide-react";
import { toast } from "sonner";

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [claims, setClaims] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [centres, setCentres] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [reviewClaim, setReviewClaim] = useState<any | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve");
  const [comments, setComments] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const [cl, p, c] = await Promise.all([
      supabase.from("monthly_claims").select("*").order("submitted_at", { ascending: false }),
      supabase.from("profiles").select("*"),
      supabase.from("centres").select("*"),
    ]);
    setClaims(cl.data || []);
    setProfiles(p.data || []);
    setCentres(c.data || []);
    setLoading(false);
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
      <DataTableShell
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search staff…"
        isEmpty={!loading && filtered.length === 0}
        emptyMessage="No claim submissions yet."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff</TableHead>
              <TableHead>Centre</TableHead>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">KM</TableHead>
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
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{p?.full_name || "—"}</TableCell>
                  <TableCell>{cn?.name || "—"}</TableCell>
                  <TableCell>{new Date(c.claim_month).toLocaleString("default", { month: "short", year: "numeric" })}</TableCell>
                  <TableCell className="text-right">{(c.total_km ?? 0).toFixed(1)}</TableCell>
                  <TableCell className="text-right">₹{Number(c.total_ta).toFixed(0)}</TableCell>
                  <TableCell className="text-right">₹{Number(c.total_da).toFixed(0)}</TableCell>
                  <TableCell className="text-right font-semibold">₹{Number(c.grand_total).toFixed(0)}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="text-right space-x-1">
                    {c.status === "submitted" ? (
                      <>
                        <Button size="sm" variant="outline" className="text-success border-success/30 hover:bg-success/10"
                          onClick={() => { setReviewClaim(c); setReviewAction("approve"); setComments(""); }}>
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => { setReviewClaim(c); setReviewAction("reject"); setComments(""); }}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => { setReviewClaim(c); setReviewAction("approve"); setComments(c.admin_comments || ""); }}>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewClaim?.status === "submitted"
                ? `${reviewAction === "approve" ? "Approve" : "Reject"} Claim`
                : "Claim Details"}
            </DialogTitle>
          </DialogHeader>
          {reviewClaim && (
            <div className="space-y-3 text-sm">
              <Row label="KM" value={(reviewClaim.total_km ?? 0).toFixed(1)} />
              <Row label="TA" value={`₹${Number(reviewClaim.total_ta).toFixed(0)}`} />
              <Row label="DA" value={`₹${Number(reviewClaim.total_da).toFixed(0)}`} />
              <Row label="Grand Total" value={`₹${Number(reviewClaim.grand_total).toFixed(0)}`} bold />
              {reviewClaim.status === "submitted" ? (
                <div className="space-y-2 pt-2">
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
    submitted: <Badge className="bg-warning text-warning-foreground hover:bg-warning">Pending</Badge>,
    approved: <Badge className="bg-success text-success-foreground hover:bg-success">Approved</Badge>,
    rejected: <Badge variant="destructive">Rejected</Badge>,
  };
  return map[status] || <Badge variant="outline">{status}</Badge>;
}

function Row({ label, value, bold }: any) {
  return (
    <div className="flex justify-between border-b pb-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-bold" : ""}>{value}</span>
    </div>
  );
}
