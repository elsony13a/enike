import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendTestPostback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        app_id: z.string().min(1),
        sub_id: z.string().trim().min(1).max(128),
        amount: z.number().min(0).max(10000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: placement, error: placementErr } = await supabase
      .from("placements")
      .select("id, user_id, app_id")
      .eq("app_id", data.app_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (placementErr) throw new Error(placementErr.message);
    if (!placement) throw new Error("Placement not found for this account.");

    const { data: publisher, error: pubErr } = await supabase
      .from("publishers")
      .select("id")
      .maybeSingle();
    if (pubErr) throw new Error(pubErr.message);
    if (!publisher) throw new Error("Publisher profile missing.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const trans_id = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { error: insertErr } = await supabaseAdmin.from("transactions").insert({
      publisher_id: publisher.id,
      network_name: "TEST",
      user_id: data.sub_id,
      trans_id,
      reward_amount: data.amount,
      payout: data.amount,
      status: "success",
      offer_name: "Test Postback",
      country: "US",
    });
    if (insertErr) throw new Error(insertErr.message);

    return { ok: true, trans_id };
  });