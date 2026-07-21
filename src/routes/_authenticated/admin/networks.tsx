import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { importNetworkOffers } from "@/lib/offers.functions";

type Network = {
  id: string;
  name: string;
  base_url: string;
  offer_feed_url: string | null;
  postback_secure_key: string;
  points_per_dollar: number;
  profit_margin_pct: number;
  is_active: boolean;
};

export const Route = createFileRoute("/_authenticated/admin/networks")({
  head: () => ({ meta: [{ title: "Networks — Admin" }] }),
  component: NetworksPage,
});

type FormState = {
  name: string;
  base_url: string;
  offer_feed_url: string;
  postback_secure_key: string;
  points_per_dollar: number;
  profit_margin_pct: number;
  is_active: boolean;
};

const emptyForm: FormState = {
  name: "",
  base_url: "",
  offer_feed_url: "",
  postback_secure_key: "",
  points_per_dollar: 1000,
  profit_margin_pct: 20,
  is_active: true,
};

function NetworksPage() {
  const qc = useQueryClient();
  const runImport = useServerFn(importNetworkOffers);
  const [importing, setImporting] = useState<string | null>(null);

  const fetchGemiwallOffers = async (n: Network) => {
    console.log("[Gemiwall] Fetch & Import triggered for network:", n.name, "feed:", n.offer_feed_url);
    if (!n.offer_feed_url) {
      throw new Error("Gemiwall feed URL is not configured on this network row.");
    }
    const res = await runImport({ data: { networkId: n.id } });
    console.log("[Gemiwall] Import result:", res);
    if (res.source !== "feed") {
      throw new Error("Gemiwall Fetch Failed — no live offers returned from the Gemiwall API.");
    }
    return res;
  };

  const fetchGenericOffers = async (n: Network) => {
    const label = n.name;
    const res = await runImport({ data: { networkId: n.id } });
    console.log(`[${label}] Import result:`, res);
    return res;
  };

  const handleImport = async (n: Network) => {
    setImporting(n.id);
    const isGemiwall = /gemiwall/i.test(n.name);
    try {
      const res = isGemiwall ? await fetchGemiwallOffers(n) : await fetchGenericOffers(n);
      if (isGemiwall && res.source === "feed" && res.imported === 0) {
        toast.success(
          "Gemiwall connected successfully: 0 active offers available for this zone.",
        );
      } else if (res.source === "demo") {
        toast.warning(`Live feed unavailable — imported ${res.imported} demo offers from ${n.name}`);
      } else {
        toast.success(`Successfully imported ${res.imported} live offers from ${n.name}!`);
      }
      qc.invalidateQueries({ queryKey: ["admin-offers"] });
      qc.invalidateQueries({ queryKey: ["admin-offer-counts"] });
    } catch (err) {
      if (isGemiwall) {
        console.error("Gemiwall Fetch Failed:", err);
      } else {
        console.error(`[${n.name}] Fetch error:`, err);
      }
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(null);
    }
  };

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-networks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_networks")
        .select("id, name, base_url, offer_feed_url, postback_secure_key, points_per_dollar, profit_margin_pct, is_active")
        .order("name");
      if (error) throw error;
      return data as Network[];
    },
  });

  const { data: offerCounts = {} } = useQuery({
    queryKey: ["admin-offer-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("offers").select("network_name");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of (data ?? []) as { network_name: string }[]) {
        counts[row.network_name] = (counts[row.network_name] ?? 0) + 1;
      }
      return counts;
    },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Network | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Network | null>(null);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (n: Network) => {
    setEditing(n);
    setForm({
      name: n.name,
      base_url: n.base_url,
      offer_feed_url: n.offer_feed_url ?? "",
      postback_secure_key: n.postback_secure_key,
      points_per_dollar: Number(n.points_per_dollar ?? 1000),
      profit_margin_pct: Number(n.profit_margin_pct ?? 0),
      is_active: n.is_active,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.postback_secure_key.trim()) {
      toast.error("Name and postback secret key are required");
      return;
    }
    if (!Number.isFinite(form.points_per_dollar) || form.points_per_dollar <= 0) {
      toast.error("Conversion rate must be greater than 0");
      return;
    }
    if (form.profit_margin_pct < 0 || form.profit_margin_pct > 100) {
      toast.error("Profit margin must be between 0 and 100");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        base_url: form.base_url.trim(),
        offer_feed_url: form.offer_feed_url.trim() || null,
        postback_secure_key: form.postback_secure_key.trim(),
        points_per_dollar: form.points_per_dollar,
        profit_margin_pct: form.profit_margin_pct,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase
          .from("ad_networks")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Network updated");
      } else {
        const { error } = await supabase.from("ad_networks").insert(payload);
        if (error) throw error;
        toast.success("Network added");
      }
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-networks"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (n: Network) => {
    const { error } = await supabase
      .from("ad_networks")
      .update({ is_active: !n.is_active })
      .eq("id", n.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${n.name} ${!n.is_active ? "activated" : "deactivated"}`);
    qc.invalidateQueries({ queryKey: ["admin-networks"] });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("ad_networks").delete().eq("id", deleteTarget.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Network removed");
    setDeleteTarget(null);
    qc.invalidateQueries({ queryKey: ["admin-networks"] });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ad Networks</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage integrated networks and their secure keys.</p>
        </div>
        <Button
          onClick={openAdd}
          className="bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/25"
        >
          <Plus className="mr-2 h-4 w-4" /> Add New Network
        </Button>
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-border/60 bg-card/60 backdrop-blur">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">API Feed</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">Margin</th>
              <th className="px-4 py-3">Offers</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/40">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.offer_feed_url ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="max-w-[240px] truncate">{r.offer_feed_url}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground/70">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                      Not configured
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {Number(r.points_per_dollar).toLocaleString()} / $
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {Number(r.profit_margin_pct).toFixed(0)}%
                </td>
                <td className="px-4 py-3 tabular-nums">{offerCounts[r.name] ?? 0}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(r)}
                    className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                      r.is_active
                        ? "bg-primary/15 text-primary hover:bg-primary/25"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {r.is_active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleImport(r)}
                      disabled={importing === r.id}
                      className="border-primary/40 text-primary hover:bg-primary/10"
                    >
                      {importing === r.id ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Fetch & Import
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(r)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No networks yet. Click "Add New Network" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit network" : "Add new network"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the network configuration." : "Register a new ad network partner."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Network name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="CPALead"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="base_url">Base URL <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                id="base_url"
                value={form.base_url}
                onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                placeholder="https://cpalead.com"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="feed">Offer API feed URL</Label>
              <Input
                id="feed"
                value={form.offer_feed_url}
                onChange={(e) => setForm({ ...form, offer_feed_url: e.target.value })}
                placeholder="https://api.network.com/feed.json?token=..."
                className="mt-2"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                JSON endpoint used by "Fetch & Import" to bulk-load offers.
              </p>
            </div>
            <div>
              <Label htmlFor="secure">Secure postback secret key</Label>
              <Input
                id="secure"
                value={form.postback_secure_key}
                onChange={(e) => setForm({ ...form, postback_secure_key: e.target.value })}
                placeholder="shared-secret-token"
                className="mt-2 font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="rate">Conversion rate</Label>
                <div className="relative mt-2">
                  <Input
                    id="rate"
                    type="number"
                    min={1}
                    step={1}
                    value={form.points_per_dollar}
                    onChange={(e) => setForm({ ...form, points_per_dollar: Number(e.target.value) })}
                    className="pr-16"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                    pts / $
                  </span>
                </div>
              </div>
              <div>
                <Label htmlFor="margin">Profit margin</Label>
                <div className="relative mt-2">
                  <Input
                    id="margin"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={form.profit_margin_pct}
                    onChange={(e) => setForm({ ...form, profit_margin_pct: Number(e.target.value) })}
                    className="pr-8"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
              <div>
                <div className="text-sm font-medium">Active</div>
                <div className="text-xs text-muted-foreground">Accept incoming postbacks from this network</div>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="bg-gradient-to-r from-primary to-accent text-primary-foreground"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Save changes" : "Add network"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the network configuration. Existing transactions are unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}