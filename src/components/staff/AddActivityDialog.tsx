import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarPlus, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Activity = {
  id?: string;
  activity_date: string;
  activity_name: string;
  location: string;
  expected_completion_date: string;
  notes: string;
};

interface Props {
  onSaved?: () => void;
  editing?: any | null;
  onClose?: () => void;
  trigger?: React.ReactNode;
}

export default function AddActivityDialog({ onSaved, editing, onClose, trigger }: Props) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<Activity>({
    activity_date: today,
    activity_name: "",
    location: "",
    expected_completion_date: today,
    notes: "",
  });

  useEffect(() => {
    if (editing) {
      setForm({
        activity_date: editing.activity_date,
        activity_name: editing.activity_name,
        location: editing.location || "",
        expected_completion_date: editing.expected_completion_date,
        notes: editing.notes || "",
      });
      setOpen(true);
    }
  }, [editing]);

  useEffect(() => {
    if (!open || !user) return;
    supabase
      .from("monthly_activities")
      .select("activity_name")
      .eq("staff_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const uniq = Array.from(new Set((data || []).map((r) => r.activity_name).filter(Boolean)));
        setSuggestions(uniq.slice(0, 15));
      });
  }, [open, user]);

  const handleClose = (v: boolean) => {
    setOpen(v);
    if (!v) {
      onClose?.();
      if (!editing) {
        setForm({ activity_date: today, activity_name: "", location: "", expected_completion_date: today, notes: "" });
      }
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.activity_name.trim()) return toast.error("Activity name required");
    if (form.expected_completion_date < form.activity_date)
      return toast.error("Expected completion cannot be before activity date");

    setLoading(true);
    const payload = {
      staff_id: user.id,
      centre_id: profile?.centre_id || null,
      activity_date: form.activity_date,
      activity_name: form.activity_name.trim(),
      location: form.location.trim() || null,
      expected_completion_date: form.expected_completion_date,
      notes: form.notes.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("monthly_activities").update(payload).eq("id", editing.id)
      : await supabase.from("monthly_activities").insert(payload);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Activity updated" : "Activity added");
    handleClose(false);
    onSaved?.();
  };

  const filteredSuggestions = suggestions.filter(
    (s) => s.toLowerCase().includes(form.activity_name.toLowerCase()) && s !== form.activity_name
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {!editing && (
        <DialogTrigger asChild>
          {trigger || (
            <Button size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Add Activity
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            {editing ? "Edit Activity" : "Add Monthly Activity"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Activity Date *</Label>
              <Input
                type="date"
                value={form.activity_date}
                onChange={(e) => setForm((p) => ({ ...p, activity_date: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Expected Completion *</Label>
              <Input
                type="date"
                value={form.expected_completion_date}
                onChange={(e) => setForm((p) => ({ ...p, expected_completion_date: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="space-y-2 relative">
            <Label>Activity / Program Name *</Label>
            <Input
              value={form.activity_name}
              onChange={(e) => setForm((p) => ({ ...p, activity_name: e.target.value }))}
              placeholder="e.g. CME at MIMS, Doctor Meeting, Medical Camp"
              list="activity-suggestions"
              required
            />
            {filteredSuggestions.length > 0 && form.activity_name.length > 0 && (
              <datalist id="activity-suggestions">
                {filteredSuggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            )}
            {suggestions.length > 0 && !form.activity_name && (
              <div className="flex flex-wrap gap-1 pt-1">
                {suggestions.slice(0, 6).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, activity_name: s }))}
                    className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/70 text-muted-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <Input
              value={form.location}
              onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
              placeholder="e.g. MIMS Hospital, Kozhikode"
            />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Optional plan details, contacts, agenda…"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving…" : editing ? "Update Activity" : "Add Activity"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
