import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getWallHistory = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        app_id: z.string().min(1).max(64),
        user_id: z.string().min(1).max(256),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: placement, error: placementErr } = await supabaseAdmin
      .from("placements")
      .select("id, user_id, app_id")
      .eq("app_id", data.app_id)
      .maybeSingle();
    if (placementErr) throw new Error(placementErr.message);
    if (!placement) return { rows: [], stats: { clicks: 0, completed: 0, pending: 0, earnings: 0 } };

    const { data: publisher, error: pubErr } = await supabaseAdmin
      .from("publishers")
      .select("id")
      .eq("user_id", placement.user_id)
      .maybeSingle();
    if (pubErr) throw new Error(pubErr.message);
    if (!publisher) return { rows: [], stats: { clicks: 0, completed: 0, pending: 0, earnings: 0 } };

    const { data: txns, error: txErr } = await supabaseAdmin
      .from("transactions")
      .select("id, created_at, offer_name, network_name, status, points_awarded, reward_amount")
      .eq("publisher_id", publisher.id)
      .eq("user_id", data.user_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (txErr) throw new Error(txErr.message);

    const rows = (txns ?? []).map((t) => ({
      id: t.id,
      created_at: t.created_at,
      offer_name: t.offer_name ?? "Offer",
      network_name: t.network_name,
      status: t.status,
      points: Number(t.points_awarded ?? 0),
      reward: Number(t.reward_amount ?? 0),
      action: "conversion" as const,
    }));

    const completed = rows.filter((r) => r.status === "success" || r.status === "credited" || r.status === "completed").length;
    const pending = rows.filter((r) => r.status === "pending").length;
    const earnings = rows
      .filter((r) => r.status === "success" || r.status === "credited" || r.status === "completed")
      .reduce((s, r) => s + r.points, 0);

    const { data: bal } = await supabaseAdmin
      .from("user_balances")
      .select("balance_points, total_earned_points, last_credited_at")
      .eq("publisher_id", publisher.id)
      .eq("user_id", data.user_id)
      .maybeSingle();

    return {
      rows,
      stats: { clicks: rows.length, completed, pending, earnings },
      balance: {
        points: Number(bal?.balance_points ?? 0),
        total_earned: Number(bal?.total_earned_points ?? 0),
        last_credited_at: bal?.last_credited_at ?? null,
      },
    };
  });

export const logOfferClick = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        app_id: z.string().min(1).max(64),
        user_id: z.string().min(1).max(256),
        offer_id: z.string().min(1).max(128),
        offer_name: z.string().max(512).optional(),
        network_name: z.string().min(1).max(64),
        payout_usd: z.number().nonnegative().default(0),
        points_payout: z.number().nonnegative().default(0),
        country: z.string().max(8).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    // NOTE: touch to refresh server-fn manifest hash on deploy.
    // v: 2026-07-19
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: placement, error: placementErr } = await supabaseAdmin
      .from("placements")
      .select("id, user_id, app_id")
      .eq("app_id", data.app_id)
      .maybeSingle();
    if (placementErr) throw new Error(placementErr.message);
    if (!placement) throw new Error("Invalid app_id");

    const { data: publisher, error: pubErr } = await supabaseAdmin
      .from("publishers")
      .select("id")
      .eq("user_id", placement.user_id)
      .maybeSingle();
    if (pubErr) throw new Error(pubErr.message);
    if (!publisher) throw new Error("Publisher not found");

    // Generate a click_id we can correlate with the eventual postback.
    const click_id =
      "clk_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 10);

    // trans_id starts as the click_id (unique). The postback route will
    // update this row's status/trans_id when the network confirms conversion.
    const { error: insertErr } = await supabaseAdmin.from("transactions").insert({
      publisher_id: publisher.id,
      network_name: data.network_name,
      user_id: data.user_id,
      trans_id: click_id,
      click_id,
      offer_id: data.offer_id,
      offer_name: data.offer_name ?? null,
      country: data.country ?? null,
      reward_amount: data.payout_usd,
      payout: data.payout_usd,
      points_awarded: Math.round(data.points_payout),
      status: "clicked",
    });
    if (insertErr) throw new Error(insertErr.message);

    return { ok: true, click_id };
  });