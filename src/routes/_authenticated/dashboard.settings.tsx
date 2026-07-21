import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, KeyRound, MessageCircle } from "lucide-react";
import { toast } from "sonner";

type Publisher = {
  name: string | null;
  email: string | null;
  telegram: string | null;
  whatsapp: string | null;
};

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  head: () => ({ meta: [{ title: "Settings — Offerdeck" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["my-publisher"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("publishers")
        .select("name, email, telegram, whatsapp")
        .maybeSingle();
      if (error) throw error;
      return (data as Publisher | null) ?? null;
    },
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [telegram, setTelegram] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setEmail(profile.email ?? "");
      setTelegram(profile.telegram ?? "");
      setWhatsapp(profile.whatsapp ?? "");
    }
  }, [profile]);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");

      const { error: pubErr } = await supabase
        .from("publishers")
        .update({
          name: name.trim() || (profile?.name ?? ""),
          telegram: telegram.trim(),
          whatsapp: whatsapp.trim(),
        })
        .eq("user_id", userData.user.id);
      if (pubErr) throw pubErr;

      if (email.trim() && email.trim() !== profile?.email) {
        const { error: emailErr } = await supabase.auth.updateUser({ email: email.trim() });
        if (emailErr) throw emailErr;
      }

      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["my-publisher"] });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingProfile(false);
    }
  };

  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);

  const changePassword = async () => {
    if (pwd.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (pwd !== pwd2) {
      toast.error("Passwords don't match");
      return;
    }
    setChangingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      toast.success("Password updated");
      setPwd("");
      setPwd2("");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setChangingPwd(false);
    }
  };

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your profile and how our team can reach you.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Profile</h2>
          </div>
          <div className="mt-5 space-y-4">
            <div>
              <Label htmlFor="s-name">Full name</Label>
              <Input
                id="s-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2"
                maxLength={100}
              />
            </div>
            <div>
              <Label htmlFor="s-email">Email</Label>
              <Input
                id="s-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2"
                maxLength={255}
              />
            </div>
            <Button
              onClick={saveProfile}
              disabled={savingProfile}
              className="bg-gradient-to-r from-primary to-accent text-primary-foreground"
            >
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save profile"}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Contact channels</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Help our support and account managers reach you.
          </p>
          <div className="mt-5 space-y-4">
            <div>
              <Label htmlFor="s-tg">Telegram username</Label>
              <Input
                id="s-tg"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                placeholder="@yourhandle"
                className="mt-2"
                maxLength={64}
              />
            </div>
            <div>
              <Label htmlFor="s-wa">WhatsApp number</Label>
              <Input
                id="s-wa"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+1 555 000 1234"
                className="mt-2"
                maxLength={32}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Contact fields are saved along with your profile above.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur lg:col-span-2">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">Change password</h2>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="s-pwd">New password</Label>
              <Input
                id="s-pwd"
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                className="mt-2"
                maxLength={72}
              />
            </div>
            <div>
              <Label htmlFor="s-pwd2">Confirm new password</Label>
              <Input
                id="s-pwd2"
                type="password"
                value={pwd2}
                onChange={(e) => setPwd2(e.target.value)}
                className="mt-2"
                maxLength={72}
              />
            </div>
          </div>
          <div className="mt-5">
            <Button
              onClick={changePassword}
              disabled={changingPwd}
              className="bg-gradient-to-r from-primary to-accent text-primary-foreground"
            >
              {changingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}