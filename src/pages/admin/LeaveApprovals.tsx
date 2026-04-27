import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTableShell } from "@/components/admin/DataTableShell";
import { CheckCircle2, XCircle, Eye } from "lucide-react";
import { toast } from "sonner";

const statusBadge = (s: string) => {
  if (s === "approved") return <Badge className="bg-success text-success-foreground hover:bg-success">Approved</Badge>;
  if (s === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  if (s === "cancelled") return <Badge variant="outline">Cancelled</Badge>;
  return <Badge className="bg-warning text-warning-foreground hover:bg-warning">Pending</Badge>;
};

const dayCount = (from: string, to: string) =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1;

export default function LeaveApprovalsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<any | null>(null);
  const [action, setAction] = useState<"approve" | "reject">("approve");
  const [comments, setComments] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const [lr, p] = await Promise.all([
      supabase.from("leave_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*"),
    ]);
    setItems(lr.data || []);
    setProfiles(p.data || []);
    setLoading(false);
  }

  function open(claim: any, a: "approve" | "reject") {
    setReviewing(claim);
    setAction(a);
    setComments(claim.admin_comments || "");
  }

  async function submit() {
    if (!reviewing || !user) return;
    if (action === "reject" && !comments.trim()) return toast.error("Reason required");
    const newStatus = action === "approve" ? "approved" : "rejected";
    const { error } = await supabase
      .from("leave_requests")
      .update({
        status: newStatus,
        admin_comments: comments.trim() || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", reviewing.id);
    if (error) return toast.error(error.message);
    toast.success(`Leave ${newStatus}`);
    setReviewing(null);
    setComments("");
    void load();
  }

  const filtered = items.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (!search) return true;
    const p = profiles.find((x) => x.user_id === l.user_id);
    return p?.full_name?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <>
      <DataTableShell
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search staff…"
        isEmpty={!loading && filtered.length === 0}
        emptyMessage="No leave requests."
        filters={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead className="text-right">Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((l) => {
              const p = profiles.find((x) => x.user_id === l.user_id);
              return (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{p?.full_name || "—"}</TableCell>
                  <TableCell className="capitalize">{l.leave_type}</TableCell>
                  <TableCell>{new Date(l.from_date).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(l.to_date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">{dayCount(l.from_date, l.to_date)}</TableCell>
                  <TableCell>{statusBadge(l.status)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {l.status === "pending" ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => open(l, "approve")}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline"
                          className="text-success border-success/30 hover:bg-success/10"
                          onClick={() => open(l, "approve")}>
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => open(l, "reject")}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => open(l, "approve")}>
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

      <Dialog open={!!reviewing} onOpenChange={() => setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewing?.status === "pending"
                ? `${action === "approve" ? "Approve" : "Reject"} Leave`
                : "Leave Details"}
            </DialogTitle>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">From</p>
                  <p className="font-medium">{new Date(reviewing.from_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">To</p>
                  <p className="font-medium">{new Date(reviewing.to_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{reviewing.leave_type}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Days</p>
                  <p className="font-medium">{dayCount(reviewing.from_date, reviewing.to_date)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Reason</p>
                <p className="rounded bg-muted p-2 text-xs">{reviewing.reason}</p>
              </div>
              {reviewing.status === "pending" ? (
                <div className="space-y-2">
                  <Label>{action === "reject" ? "Reason (required)" : "Comments (optional)"}</Label>
                  <Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} />
                </div>
              ) : (
                reviewing.admin_comments && (
                  <div>
                    <p className="text-xs text-muted-foreground">Admin comments</p>
                    <p className="rounded bg-muted p-2 text-xs">{reviewing.admin_comments}</p>
                  </div>
                )
              )}
            </div>
          )}
          {reviewing?.status === "pending" && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewing(null)}>Cancel</Button>
              <Button
                onClick={submit}
                className={action === "approve" ? "bg-success hover:bg-success/90" : ""}
                variant={action === "reject" ? "destructive" : "default"}
              >
                Confirm {action === "approve" ? "Approval" : "Rejection"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
