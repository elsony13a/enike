import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Copy, Check, Globe, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

type Placement = {
  id: string;
  name: string;
  site_url: string;
  app_id: string;
  secret_key: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/dashboard/placements")({
  head: () => ({ meta: [{ title: "Placements — Offerdeck" }] }),
  component: PlacementsPage,
});

function PlacementsPage() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["my-placements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("placements")
        .select("id, name, site_url, app_id, secret_key, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Placement[];
    },
  });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const wallOrigin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://elsonyads.lovable.app";

  const copy = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    toast.success("Copied");
    setTimeout(() => setCopied(null), 1500);
  };

  const create = async () => {
    if (!name.trim() || !siteUrl.trim()) {
      toast.error("Name and Site URL are required");
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const { error } = await supabase.from("placements").insert({
        user_id: userData.user.id,
        name: name.trim(),
        site_url: siteUrl.trim(),
      });
      if (error) throw error;
      toast.success("Placement created");
      setName("");
      setSiteUrl("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["my-placements"] });
    } catch (err) {
      console.error("Create placement failed", err);
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Placements</h1>
          <p className="mt-1 text-sm text-muted-foreground">Register a site or app to get a unique wall link and secret key.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/25">
          <Plus className="mr-2 h-4 w-4" /> Create New Placement
        </Button>
      </div>

      <div className="mt-8 space-y-4">
        {isLoading && (
          <div className="rounded-2xl border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">Loading…</div>
        )}
        {!isLoading && rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-12 text-center">
            <Globe className="mx-auto h-8 w-8 text-muted-foreground/70" />
            <p className="mt-4 text-sm text-muted-foreground">No placements yet. Create your first one to grab an embed link.</p>
          </div>
        )}
        {rows.map((p) => {
          const wallLink = `${wallOrigin}/wall/${p.app_id}?userId=[USER_ID]`;
          return (
            <div key={p.id} className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  <a href={p.site_url} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                    <Globe className="h-3 w-3" /> {p.site_url}
                  </a>
                </div>
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs text-primary">Active</span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">App ID</div>
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
                    <code className="flex-1 font-mono text-sm">{p.app_id}</code>
                    <Button size="sm" variant="ghost" onClick={() => copy(p.app_id, `${p.id}-app`)}>
                      {copied === `${p.id}-app` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground">
                    <KeyRound className="h-3 w-3" /> Secret Key
                  </div>
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
                    <code className="flex-1 truncate font-mono text-sm">{p.secret_key}</code>
                    <Button size="sm" variant="ghost" onClick={() => copy(p.secret_key, `${p.id}-sec`)}>
                      {copied === `${p.id}-sec` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Wall Link</div>
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-[oklch(0.11_0.02_260)] px-3 py-2 ring-1 ring-border/60">
                  <code className="flex-1 truncate font-mono text-sm text-primary">{wallLink}</code>
                  <Button size="sm" variant="ghost" onClick={() => copy(wallLink, `${p.id}-wall`)}>
                    {copied === `${p.id}-wall` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new placement</DialogTitle>
            <DialogDescription>Register a new site or app. You'll get a unique App ID and Secret Key.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="p-name">Site name</Label>
              <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Rewards App" className="mt-2" />
            </div>
            <div>
              <Label htmlFor="p-url">Site URL</Label>
              <Input id="p-url" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://example.com" className="mt-2" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={create} disabled={saving} className="bg-gradient-to-r from-primary to-accent text-primary-foreground">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create placement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}