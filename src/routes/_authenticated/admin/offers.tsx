import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Network = {
  id: string;
  name: string;
};

type Offer = {
  id: string;
  network_name: string;
  offer_id: string;
  title: string;
  payout: number;
  image_url: string | null;
  target_country: string | null;
  tracking_url: string;
  is_active: boolean;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/offers")({
  head: () => ({ meta: [{ title: "Offers — Admin" }] }),
  component: OffersPage,
});

type FormState = {
  title: string;
  image_url: string;
  target_country: string;
  payout: number;
  network_id: string;
  tracking_url: string;
  description: string;
};

const emptyForm: FormState = {
  title: "",
  image_url: "",
  target_country: "",
  payout: 0,
  network_id: "",
  tracking_url: "",
  description: "",
};

function OffersPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: networks = [] } = useQuery({
    queryKey: ["admin-networks-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_networks")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as Network[];
    },
  });

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ["admin-offers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select("id, network_name, offer_id, title, payout, image_url, target_country, tracking_url, is_active, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Offer[];
    },
  });

  const openAdd = () => {
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error("Offer name is required");
    if (!form.network_id) return toast.error("Select a network");
    if (!form.tracking_url.trim()) return toast.error("Tracking URL is required");
    if (!Number.isFinite(form.payout) || form.payout < 0) return toast.error("Payout must be 0 or greater");

    const network = networks.find((n) => n.id === form.network_id);
    if (!network) return toast.error("Invalid network");

    setSaving(true);
    try {
      const offer_id = `manual_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const { error } = await supabase.from("offers").insert({
        network_id: network.id,
        network_name: network.name,
        offer_id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        payout: form.payout,
        image_url: form.image_url.trim() || null,
        target_country: form.target_country.trim().toUpperCase() || null,
        tracking_url: form.tracking_url.trim(),
        is_active: true,
      });
      if (error) throw error;
      toast.success("Offer created");
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-offers"] });
      qc.invalidateQueries({ queryKey: ["admin-offer-counts"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (o: Offer) => {
    if (!confirm(`Delete offer "${o.title}"?`)) return;
    const { error } = await supabase.from("offers").delete().eq("id", o.id);
    if (error) return toast.error(error.message);
    toast.success("Offer deleted");
    qc.invalidateQueries({ queryKey: ["admin-offers"] });
    qc.invalidateQueries({ queryKey: ["admin-offer-counts"] });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Offers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manually create individual offers or manage the imported catalog.
          </p>
        </div>
        <Button
          onClick={openAdd}
          className="bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/25"
        >
          <Plus className="mr-2 h-4 w-4" /> Add New Offer
        </Button>
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-border/60 bg-card/60 backdrop-blur">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Offer</th>
              <th className="px-4 py-3">Network</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Payout</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o) => (
              <tr key={o.id} className="border-t border-border/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {o.image_url ? (
                      <img src={o.image_url} alt="" className="h-8 w-8 rounded object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-muted" />
                    )}
                    <div className="max-w-[320px] truncate font-medium">{o.title}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{o.network_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{o.target_country ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums">${Number(o.payout).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${o.is_active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {o.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => remove(o)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
            {!isLoading && offers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No offers yet. Click "Add New Offer" to create one manually.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add new offer</DialogTitle>
            <DialogDescription>Create a single offer manually and publish it to the offerwall.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Offer name</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Install & play Coin Master"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="image_url">Image URL</Label>
              <Input
                id="image_url"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://cdn.example.com/icon.png"
                className="mt-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="country">Target country</Label>
                <Input
                  id="country"
                  value={form.target_country}
                  onChange={(e) => setForm({ ...form, target_country: e.target.value })}
                  placeholder="US"
                  maxLength={8}
                  className="mt-2 uppercase"
                />
              </div>
              <div>
                <Label htmlFor="payout">Payout / Points ($)</Label>
                <Input
                  id="payout"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.payout}
                  onChange={(e) => setForm({ ...form, payout: Number(e.target.value) })}
                  className="mt-2"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="network">Network source</Label>
              <Select value={form.network_id} onValueChange={(v) => setForm({ ...form, network_id: v })}>
                <SelectTrigger id="network" className="mt-2">
                  <SelectValue placeholder="Choose network" />
                </SelectTrigger>
                <SelectContent>
                  {networks.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tracking">Offer tracking URL</Label>
              <Input
                id="tracking"
                value={form.tracking_url}
                onChange={(e) => setForm({ ...form, tracking_url: e.target.value })}
                placeholder="https://track.example.com/click?offer=123&sub={USER_ID}"
                className="mt-2 font-mono text-xs"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Use <code className="rounded bg-muted px-1">{`{USER_ID}`}</code> as a subId macro for tracking.
              </p>
            </div>
            <div>
              <Label htmlFor="desc">Description (optional)</Label>
              <Textarea
                id="desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Short description of what the user needs to do."
                className="mt-2"
                rows={2}
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
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create offer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}