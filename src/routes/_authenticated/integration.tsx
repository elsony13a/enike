import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Copy, Check, Code2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/integration")({
  head: () => ({ meta: [{ title: "Integration — Offerdeck" }] }),
  component: Integration,
});

function Integration() {
  const { data: publisher } = useQuery({
    queryKey: ["publisher-me"],
    queryFn: async () => {
      const { data, error } = await supabase.from("publishers").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const appId = publisher?.app_id ?? "YOUR_APP_ID";
  const iframeCode = `<iframe
  src="https://offerdeck.io/wall?app_id=${appId}&user_id=USER_ID"
  width="100%"
  height="600"
  frameborder="0"
  allow="clipboard-write"
  style="border:0;border-radius:12px;">
</iframe>`;

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(iframeCode);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
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
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Your App ID</div>
        <div className="mt-2 rounded-lg bg-muted/60 px-4 py-3 font-mono text-lg">{appId}</div>
        <p className="mt-3 text-sm text-muted-foreground">
          Replace <code className="rounded bg-muted px-1 py-0.5">USER_ID</code> with the unique identifier of the visitor in your app. This is how conversions are attributed back to individual users via postback.
        </p>
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

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          { n: "1", t: "Copy the snippet", d: "Grab the iframe code above." },
          { n: "2", t: "Paste in your site", d: "Drop it anywhere in your HTML/JSX." },
          { n: "3", t: "Earn per conversion", d: "Postbacks fire the moment offers complete." },
        ].map((s) => (
          <div key={s.n} className="rounded-xl border border-border/60 bg-card/40 p-5">
            <div className="text-xs text-primary">Step {s.n}</div>
            <div className="mt-1 font-semibold">{s.t}</div>
            <div className="mt-1 text-sm text-muted-foreground">{s.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}