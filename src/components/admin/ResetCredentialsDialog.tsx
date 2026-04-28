import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Lock, KeyRound, RefreshCw, Copy } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  staff: { user_id: string; full_name: string; employee_id: string } | null;
}

function generatePassword(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let out = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

export function ResetCredentialsDialog({ open, onOpenChange, staff }: Props) {
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<null | "email" | "password">(null);

  function reset() {
    setNewEmail("");
    setNewPassword("");
  }

  async function doUpdateEmail() {
    if (!staff) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "reset_email", target_user_id: staff.user_id, email: newEmail.trim() },
    });
    setSaving(false);
    setConfirm(null);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error || error?.message || "Failed");
    }
    toast.success("Email updated. New login details sent to staff email.");
    reset();
    onOpenChange(false);
  }

  async function doUpdatePassword() {
    if (!staff) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "reset_password", target_user_id: staff.user_id, password: newPassword },
    });
    setSaving(false);
    setConfirm(null);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error || error?.message || "Failed");
    }
    toast.success("Password updated. Share the new password securely.");
    onOpenChange(false);
  }

  function generate() {
    const p = generatePassword(12);
    setNewPassword(p);
  }

  async function copyPassword() {
    if (!newPassword) return;
    await navigator.clipboard.writeText(newPassword);
    toast.success("Password copied");
  }

  if (!staff) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> Reset Staff Credentials
            </DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{staff.full_name}</span>
              {" · "}
              <span className="font-mono text-xs">{staff.employee_id}</span>
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="email" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email"><Mail className="h-4 w-4 mr-2" /> Change Email</TabsTrigger>
              <TabsTrigger value="password"><Lock className="h-4 w-4 mr-2" /> Reset Password</TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="space-y-3 pt-3">
              <div className="space-y-2">
                <Label>New Email Address</Label>
                <Input
                  type="email"
                  placeholder="staff@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <DialogFooter className="!justify-between gap-2 pt-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button
                  onClick={() => setConfirm("email")}
                  disabled={saving || !newEmail.includes("@")}
                >
                  <Mail className="h-4 w-4 mr-2" /> Update Email
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="password" className="space-y-3 pt-3">
              <div className="space-y-2">
                <Label>New Password</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Min 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="font-mono"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={generate} title="Generate">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="outline" size="icon" onClick={copyPassword} title="Copy" disabled={!newPassword}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Generate a secure password or set one manually. Share with staff securely.
                </p>
              </div>
              <DialogFooter className="!justify-between gap-2 pt-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button
                  onClick={() => setConfirm("password")}
                  disabled={saving || newPassword.length < 8}
                >
                  <Lock className="h-4 w-4 mr-2" /> Update Password
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirm !== null} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm credential reset</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to {confirm === "email" ? "change the login email" : "reset the password"} for{" "}
              <span className="font-medium text-foreground">{staff.full_name}</span>. This action is logged.
              Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirm === "email" ? doUpdateEmail() : doUpdatePassword()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
