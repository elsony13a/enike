import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { sendTestPostback } from "@/lib/placements.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, Code2, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Placement = { id: string; name: string; app_id: string };

export const Route = createFileRoute("/_authenticated/dashboard/setup")({
  head: () => ({ meta: [{ title: "Setup & Integration — Offerdeck" }] }),
  component: SetupPage,
});

function SetupPage() {
  const { data: placements = [] } = useQuery({
    queryKey: ["my-placements-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("placements")
        .select("id, name, app_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Placement[];
    },
  });

  const [selected, setSelected] = useState<string>("");
  const activeAppId = selected || placements[0]?.app_id || "";
  const iframeCode = `<iframe src="https://elsonytop.lovable.app/wall/${activeAppId || "APP_ID"}?userId=[USER_ID]" width="100%" height="800px"></iframe>`;

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(iframeCode);
    setCopied(true);
    toast.success("Copied");
    setTimeout(() => setCopied(false), 1500);
  };

  const testFn = useServerFn(sendTestPostback);
  const [subId, setSubId] = useState("test-user-1");
  const [amount, setAmount] = useState("0.50");
  const [sending, setSending] = useState(false);

  const sendTest = async () => {
    if (!activeAppId) {
      toast.error("Create a placement first");
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSending(true);
    try {
      const res = await testFn({ data: { app_id: activeAppId, sub_id: subId, amount: n } });
      toast.success(`Postback logged (${res.trans_id})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 ring-1 ring-primary/30">
          <Code2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Integration</p>
          <h1 className="text-2xl font-bold tracking-tight">Embed your offerwall</h1>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-border/60 bg-card/40 p-6">
        <Label>Placement</Label>
        {placements.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No placements yet.{" "}
            <Link to="/dashboard/placements" className="text-primary hover:underline">Create one first</Link>.
          </p>
        ) : (
          <select
            value={activeAppId}
            onChange={(e) => setSelected(e.target.value)}
            className="mt-2 w-full rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm"
          >
            {placements.map((p) => (
              <option key={p.id} value={p.app_id}>{p.name} — {p.app_id}</option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border/60 bg-[oklch(0.11_0.02_260)]">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-destructive/70" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
            <div className="h-3 w-3 rounded-full bg-green-500/70" />
            <span className="ml-2 text-xs text-muted-foreground">iframe snippet</span>
          </div>
          <Button size="sm" variant="ghost" onClick={copy}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="ml-1.5 text-xs">{copied ? "Copied" : "Copy"}</span>
          </Button>
        </div>
        <pre className="overflow-x-auto p-6 text-sm leading-relaxed text-muted-foreground">
          <code>{iframeCode}</code>
        </pre>
      </div>

      <div className="mt-8 rounded-2xl border border-border/60 bg-card/40 p-6">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Test your postback</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Simulate a conversion to verify server-to-server logging. A test transaction will be inserted for the selected placement.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="subid">subId (User ID)</Label>
            <Input id="subid" value={subId} onChange={(e) => setSubId(e.target.value)} placeholder="user-123" className="mt-2" />
          </div>
          <div>
            <Label htmlFor="amt">Amount ($)</Label>
            <Input id="amt" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-2" />
          </div>
        </div>
        <Button
          onClick={sendTest}
          disabled={sending || !activeAppId}
          className="mt-5 bg-gradient-to-r from-primary to-accent text-primary-foreground"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send test postback"}
        </Button>
      </div>
    </div>
  );
}