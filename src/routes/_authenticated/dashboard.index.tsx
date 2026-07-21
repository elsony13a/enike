import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TrendingUp, MousePointerClick, DollarSign, Code2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({ meta: [{ title: "Overview — Offerdeck" }] }),
  component: DashboardHome,
});

function DashboardHome() {
  const { data: publisher, isLoading } = useQuery({
    queryKey: ["publisher-me"],
    queryFn: async () => {
      const { data, error } = await supabase.from("publishers").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: txStats } = useQuery({
    queryKey: ["tx-stats", publisher?.id],
    enabled: !!publisher?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("payout,status")
        .eq("publisher_id", publisher!.id);
      if (error) throw error;
      const conversions = data.filter((t) => t.status === "success").length;
      const earnings = data
        .filter((t) => t.status === "success")
        .reduce((sum, t) => sum + Number(t.payout), 0);
      return { conversions, earnings, clicks: data.length };
    },
  });

  const stats = [
    { label: "Total Clicks", value: txStats?.clicks ?? 0, icon: MousePointerClick, color: "from-primary/20 to-primary/5" },
    { label: "Conversions", value: txStats?.conversions ?? 0, icon: TrendingUp, color: "from-accent/20 to-accent/5" },
    { label: "Total Earnings", value: `$${(txStats?.earnings ?? 0).toFixed(2)}`, icon: DollarSign, color: "from-green-500/20 to-green-500/5" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Publisher dashboard</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {isLoading ? "Loading…" : `Welcome, ${publisher?.name ?? "Publisher"}`}
          </h1>
        </div>
        <Link to="/dashboard/setup">
          <Button className="bg-gradient-to-r from-primary to-accent text-primary-foreground">
            <Code2 className="mr-2 h-4 w-4" />
            Integration code
          </Button>
        </Link>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br ${color} p-6`}>
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background/60 backdrop-blur">
                <Icon className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="mt-4 text-3xl font-bold tracking-tight">{value}</div>
            <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-border/60 bg-card/40 p-8">
        <h2 className="text-xl font-semibold">Your credentials</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">App ID</div>
            <div className="mt-2 rounded-lg bg-muted/60 px-3 py-2 font-mono text-sm">{publisher?.app_id ?? "…"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Status</div>
            <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              {publisher?.status ?? "active"}
            </div>
          </div>
        </div>
        <div className="mt-6">
          <Link to="/dashboard/placements" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            Manage placements <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}