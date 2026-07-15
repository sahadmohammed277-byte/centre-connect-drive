import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Pencil, MapPin, CalendarClock, Lock } from "lucide-react";
import { toast } from "sonner";
import AddActivityDialog from "./AddActivityDialog";

type Activity = {
  id: string;
  activity_date: string;
  activity_name: string;
  location: string | null;
  expected_completion_date: string;
  completion_date: string | null;
  status: "planning" | "completed" | "cancelled";
  notes: string | null;
  completion_notes: string | null;
};

export default function MonthlyActivitiesList({ refreshKey, onChanged }: { refreshKey?: number; onChanged?: () => void }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [completing, setCompleting] = useState<Activity | null>(null);
  const [compForm, setCompForm] = useState({ completion_date: "", completion_notes: "" });
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("monthly_activities")
      .select("*")
      .eq("staff_id", user.id)
      .order("activity_date", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setRows((data as Activity[]) || []);
        setLoading(false);
      });
  }, [user, refresh, refreshKey]);

  const bump = () => {
    setRefresh((k) => k + 1);
    onChanged?.();
  };

  const openComplete = (a: Activity) => {
    setCompleting(a);
    setCompForm({
      completion_date: new Date().toISOString().slice(0, 10),
      completion_notes: "",
    });
  };

  const submitComplete = async () => {
    if (!completing) return;
    if (!compForm.completion_date) return toast.error("Completion date required");
    const { error } = await supabase
      .from("monthly_activities")
      .update({
        status: "completed",
        completion_date: compForm.completion_date,
        completion_notes: compForm.completion_notes.trim() || null,
      })
      .eq("id", completing.id);
    if (error) return toast.error(error.message);
    toast.success("Marked as completed");
    setCompleting(null);
    bump();
  };

  const cancel = async (a: Activity) => {
    if (!confirm("Cancel this activity?")) return;
    const { error } = await supabase
      .from("monthly_activities")
      .update({ status: "cancelled" })
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success("Activity cancelled");
    bump();
  };

  if (loading) return <p className="text-xs text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Monthly Activities</h2>
        <AddActivityDialog onSaved={bump} />
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-4 text-center">
          No activities yet. Tap "Add Activity" to plan one.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((a) => (
            <Card key={a.id} className="overflow-hidden">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm truncate">{a.activity_name}</p>
                      <StatusPill status={a.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" />
                        {new Date(a.activity_date).toLocaleDateString()}
                      </span>
                      <span>Expected: {new Date(a.expected_completion_date).toLocaleDateString()}</span>
                      {a.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {a.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {a.notes && <p className="text-xs text-muted-foreground">{a.notes}</p>}
                {a.status === "completed" && a.completion_notes && (
                  <p className="text-xs rounded bg-success/10 text-success px-2 py-1">
                    Completed on {a.completion_date && new Date(a.completion_date).toLocaleDateString()} — {a.completion_notes}
                  </p>
                )}

                {a.status === "planning" ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => setEditing(a)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      className="bg-success text-success-foreground hover:bg-success/90"
                      onClick={() => openComplete(a)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Completed
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => cancel(a)}>
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
                    </Button>
                  </div>
                ) : a.status === "completed" ? (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
                    <Lock className="h-3 w-3" /> Locked
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      {editing && (
        <AddActivityDialog
          editing={editing}
          onSaved={bump}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Complete dialog */}
      <Dialog open={!!completing} onOpenChange={() => setCompleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Completed</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Completion Date *</Label>
              <Input
                type="date"
                value={compForm.completion_date}
                onChange={(e) => setCompForm((p) => ({ ...p, completion_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Completion Notes</Label>
              <Textarea
                rows={3}
                value={compForm.completion_notes}
                onChange={(e) => setCompForm((p) => ({ ...p, completion_notes: e.target.value }))}
                placeholder="Outcome, attendees, key notes…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleting(null)}>Cancel</Button>
            <Button onClick={submitComplete} className="bg-success text-success-foreground hover:bg-success/90">
              Confirm Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "completed") return <Badge className="bg-success text-success-foreground hover:bg-success">Completed</Badge>;
  if (status === "cancelled") return <Badge variant="destructive">Cancelled</Badge>;
  return <Badge className="bg-primary text-primary-foreground hover:bg-primary">Planning</Badge>;
}
