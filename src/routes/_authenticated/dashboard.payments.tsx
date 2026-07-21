import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wallet, Clock, CheckCircle2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

type PaymentSetting = {
  method: string;
  address: string;
};

type Payout = {
  id: string;
  invoice_id: string;
  amount: number;
  method: string;
  status: string;
  created_at: string;
};

const METHODS = [
  "Vodafone Cash",
  "USDT (TRC20)",
  "USDT (BEP20)",
  "PayPal",
  "Bank Transfer",
];

export const Route = createFileRoute("/_authenticated/dashboard/payments")({
  head: () => ({ meta: [{ title: "Payments — Offerdeck" }] }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const qc = useQueryClient();

  const { data: userId } = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    },
  });

  const { data: setting } = useQuery({
    queryKey: ["payment-setting"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_settings")
        .select("method, address")
        .maybeSingle();
      if (error) throw error;
      return (data as PaymentSetting | null) ?? null;
    },
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ["my-payouts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payouts")
        .select("id, invoice_id, amount, method, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Payout[];
    },
  });

  const { data: earnings } = useQuery({
    queryKey: ["earnings-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("payout, status");
      if (error) throw error;
      const total = (data ?? []).reduce(
        (acc, r) => acc + Number(r.payout ?? 0),
        0,
      );
      return { total };
    },
  });

  const totalEarned = earnings?.total ?? 0;
  const totalPaid = payouts
    .filter((p) => p.status === "paid")
    .reduce((a, p) => a + Number(p.amount), 0);
  const pending = payouts
    .filter((p) => p.status === "pending")
    .reduce((a, p) => a + Number(p.amount), 0);
  const balance = Math.max(0, totalEarned - totalPaid - pending);

  const [method, setMethod] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [savingSetting, setSavingSetting] = useState(false);

  useEffect(() => {
    if (setting) {
      setMethod(setting.method);
      setAddress(setting.address);
    }
  }, [setting]);

  const saveSetting = async () => {
    if (!userId) return;
    if (!method || !address.trim()) {
      toast.error("Choose a method and enter your address");
      return;
    }
    setSavingSetting(true);
    try {
      const { error } = await supabase
        .from("payment_settings")
        .upsert(
          { user_id: userId, method, address: address.trim(), updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      if (error) throw error;
      toast.success("Payment settings saved");
      qc.invalidateQueries({ queryKey: ["payment-setting"] });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingSetting(false);
    }
  };

  const [amount, setAmount] = useState("");
  const [requesting, setRequesting] = useState(false);

  const requestPayout = async () => {
    if (!userId) return;
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (n > balance) {
      toast.error("Amount exceeds current balance");
      return;
    }
    if (!method || !address.trim()) {
      toast.error("Save a payment method first");
      return;
    }
    setRequesting(true);
    try {
      const { error } = await supabase.from("payouts").insert({
        user_id: userId,
        amount: n,
        method,
        address: address.trim(),
      });
      if (error) throw error;
      toast.success("Payout requested");
      setAmount("");
      qc.invalidateQueries({ queryKey: ["my-payouts"] });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to request");
    } finally {
      setRequesting(false);
    }
  };

  const fmt = (v: number) =>
    v.toLocaleString(undefined, { style: "currency", currency: "USD" });

  const statusBadge = (s: string) => {
    const base = "rounded-full px-2 py-0.5 text-xs font-medium";
    if (s === "paid") return `${base} bg-emerald-500/15 text-emerald-400`;
    if (s === "cancelled") return `${base} bg-rose-500/15 text-rose-400`;
    return `${base} bg-amber-500/15 text-amber-400`;
  };

  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payments & Payouts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track your balance, set your payout method, and review payout history.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          { label: "Current Balance", value: balance, icon: Wallet, tint: "from-primary to-accent" },
          { label: "Pending Balance", value: pending, icon: Clock, tint: "from-amber-500 to-orange-500" },
          { label: "Total Paid Out", value: totalPaid, icon: CheckCircle2, tint: "from-emerald-500 to-teal-500" },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">{c.label}</span>
              <div className={`rounded-lg bg-gradient-to-br ${c.tint} p-2 text-white shadow-lg`}>
                <c.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 text-3xl font-bold">{fmt(c.value)}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur">
          <h2 className="text-lg font-semibold">Payment Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose how you want to receive your earnings.
          </p>
          <div className="mt-5 space-y-4">
            <div>
              <Label>Payout Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select a method" />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pay-address">Payment address / number</Label>
              <Input
                id="pay-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. TXk... or you@example.com"
                className="mt-2"
                maxLength={200}
              />
            </div>
            <Button
              onClick={saveSetting}
              disabled={savingSetting}
              className="bg-gradient-to-r from-primary to-accent text-primary-foreground"
            >
              {savingSetting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save settings"}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur">
          <h2 className="text-lg font-semibold">Request a payout</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Withdraw available balance to your saved payout method.
          </p>
          <div className="mt-5 space-y-4">
            <div>
              <Label htmlFor="pay-amount">Amount (USD)</Label>
              <Input
                id="pay-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="mt-2"
              />
              <div className="mt-2 text-xs text-muted-foreground">
                Available: <span className="font-medium text-foreground">{fmt(balance)}</span>
              </div>
            </div>
            <Button
              onClick={requestPayout}
              disabled={requesting}
              className="bg-gradient-to-r from-primary to-accent text-primary-foreground"
            >
              {requesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" /> Request payout
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-border/60 bg-card/40 backdrop-blur">
        <div className="border-b border-border/60 p-6">
          <h2 className="text-lg font-semibold">Payment History</h2>
          <p className="mt-1 text-sm text-muted-foreground">All your past payout requests.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-3">Invoice ID</th>
                <th className="px-6 py-3">Request Date</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Method</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {payouts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                    No payouts yet.
                  </td>
                </tr>
              )}
              {payouts.map((p) => (
                <tr key={p.id} className="hover:bg-muted/20">
                  <td className="px-6 py-4 font-mono text-xs">{p.invoice_id}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 font-medium">{fmt(Number(p.amount))}</td>
                  <td className="px-6 py-4">{p.method}</td>
                  <td className="px-6 py-4">
                    <span className={statusBadge(p.status)}>{p.status}</span>
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