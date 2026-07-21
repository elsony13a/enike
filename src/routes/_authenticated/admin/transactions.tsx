import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Tx = {
  id: string;
  network_name: string;
  user_id: string;
  trans_id: string;
  reward_amount: number;
  payout: number;
  status: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/transactions")({
  head: () => ({ meta: [{ title: "Transactions — Admin" }] }),
  component: TxPage,
});

function TxPage() {
  const [rows, setRows] = useState<Tx[]>([]);

  useEffect(() => {
    supabase
      .from("transactions")
      .select("id, network_name, user_id, trans_id, reward_amount, payout, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setRows(data ?? []));
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Recent Transactions</h1>
      <div className="mt-8 overflow-hidden rounded-xl border border-border/60 bg-card/60 backdrop-blur">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Network</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Trans ID</th>
              <th className="px-4 py-3">Reward</th>
              <th className="px-4 py-3">Payout</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/40">
                <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 font-medium">{r.network_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.user_id}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.trans_id}</td>
                <td className="px-4 py-3">{Number(r.reward_amount).toFixed(2)}</td>
                <td className="px-4 py-3">${Number(r.payout).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${r.status === "success" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No transactions yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}