import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3 } from "lucide-react";

type Row = {
  id: string;
  created_at: string;
  offer_name: string | null;
  user_id: string;
  country: string | null;
  payout: number;
  status: string;
  network_name: string;
};

export const Route = createFileRoute("/_authenticated/dashboard/reports")({
  head: () => ({ meta: [{ title: "Leads & Reports — Offerdeck" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data: publisher } = useQuery({
    queryKey: ["publisher-me"],
    queryFn: async () => {
      const { data, error } = await supabase.from("publishers").select("id").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["my-transactions", publisher?.id],
    enabled: !!publisher?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, created_at, offer_name, user_id, country, payout, status, network_name")
        .eq("publisher_id", publisher!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Row[];
    },
  });

  const totalPayout = rows
    .filter((r) => r.status === "success")
    .reduce((sum, r) => sum + Number(r.payout), 0);

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 ring-1 ring-primary/30">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Reporting</p>
          <h1 className="text-2xl font-bold tracking-tight">Leads & Reports</h1>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Leads" value={rows.length.toString()} />
        <StatCard label="Successful" value={rows.filter((r) => r.status === "success").length.toString()} />
        <StatCard label="Total Payout" value={`$${totalPayout.toFixed(2)}`} />
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-border/60 bg-card/60 backdrop-blur">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Offer</th>
                <th className="px-4 py-3">User ID</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3 text-right">Payout</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No leads yet. Send a test postback from Setup to see one here.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {r.offer_name || r.network_name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.user_id}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.country || "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">${Number(r.payout).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        r.status === "success"
                          ? "bg-green-500/15 text-green-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.status === "success" ? "Paid" : r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}