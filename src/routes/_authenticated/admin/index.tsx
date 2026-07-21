import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Receipt, DollarSign, Network } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin Overview — Offerdeck" }] }),
  component: AdminOverview,
});

function AdminOverview() {
  const [stats, setStats] = useState({ publishers: 0, transactions: 0, networks: 0, revenue: 0 });

  useEffect(() => {
    (async () => {
      const [pub, tx, nets] = await Promise.all([
        supabase.from("publishers").select("id", { count: "exact", head: true }),
        supabase.from("transactions").select("payout", { count: "exact" }),
        supabase.from("ad_networks").select("id", { count: "exact", head: true }),
      ]);
      const revenue = (tx.data ?? []).reduce((s, r) => s + Number(r.payout ?? 0), 0);
      setStats({
        publishers: pub.count ?? 0,
        transactions: tx.count ?? 0,
        networks: nets.count ?? 0,
        revenue,
      });
    })();
  }, []);

  const cards = [
    { label: "Publishers", value: stats.publishers, icon: Users },
    { label: "Ad Networks", value: stats.networks, icon: Network },
    { label: "Transactions", value: stats.transactions, icon: Receipt },
    { label: "Total Payout", value: `$${stats.revenue.toFixed(2)}`, icon: DollarSign },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Admin Overview</h1>
      <p className="mt-2 text-muted-foreground">Platform-wide metrics across all publishers and networks.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border/60 bg-card/60 p-5 backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              <c.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-3 text-2xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}