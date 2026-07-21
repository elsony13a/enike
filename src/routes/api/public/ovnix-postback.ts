import { createFileRoute } from "@tanstack/react-router";

// OVNIX Postback (Server-to-Server conversion notice)
// Registered URL:
//   https://<host>/api/public/ovnix-postback?status={status}&user_id={sub1}&payout={payout}&offer_id={oi}&offer_name={on}&trans_id={trans_id}
//
// Behavior:
//  - Parses the query parameters and logs the raw payload for debugging.
//  - Finds the matching "clicked" transaction row for (user_id, offer_id).
//  - Updates its status to "credited" and stores the network payout / points.
//  - Returns plain "OK" 200 as required by most offerwall networks.

const okText = (body = "OK", status = 200) =>
  new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

async function handleOvnixPostback(request: Request) {
  const rawUrl = request.url.replace(/&amp;/g, "&");
  const url = new URL(rawUrl);
  const q = url.searchParams;

  const payload = {
    status: q.get("status") ?? "",
    user_id: q.get("user_id") ?? q.get("sub1") ?? "",
    payout: q.get("payout") ?? "0",
    offer_id: q.get("offer_id") ?? q.get("oi") ?? "",
    offer_name: q.get("offer_name") ?? q.get("on") ?? "",
    trans_id: q.get("trans_id") ?? q.get("tid") ?? "",
    ip: q.get("ip") ?? "",
    country: q.get("country") ?? q.get("geo") ?? "",
  };

  console.log("[ovnix-postback] incoming", payload);

  if (!payload.user_id || !payload.offer_id) {
    console.warn("[ovnix-postback] missing user_id or offer_id");
    return okText("OK");
  }

  const payoutUsd = Number(payload.payout) || 0;
  // Same conversion the wall uses: payout USD * 2000 => points, with the
  // network's platform margin already baked into the offer feed.
  const points = Math.max(0, Math.round(payoutUsd * 2000));

  const incomingStatus = payload.status.toLowerCase();
  const finalStatus =
    incomingStatus === "reversed" ||
    incomingStatus === "rejected" ||
    incomingStatus === "chargeback"
      ? "rejected"
      : "credited";

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Locate the original click row for this (user, offer).
    const { data: clickRow, error: findErr } = await supabaseAdmin
      .from("transactions")
      .select("id, status, points_awarded")
      .eq("network_name", "OVNIX")
      .eq("user_id", payload.user_id)
      .eq("offer_id", payload.offer_id)
      .in("status", ["clicked", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findErr) {
      console.error("[ovnix-postback] lookup failed", findErr.message);
      return okText("OK");
    }

    if (!clickRow) {
      console.warn("[ovnix-postback] no matching click row", {
        user_id: payload.user_id,
        offer_id: payload.offer_id,
      });
      return okText("OK");
    }

    const { error: updErr } = await supabaseAdmin
      .from("transactions")
      .update({
        status: finalStatus,
        payout: payoutUsd,
        reward_amount: payoutUsd,
        points_awarded: points,
        offer_name: payload.offer_name || undefined,
        trans_id: payload.trans_id || undefined,
      })
      .eq("id", clickRow.id);

    if (updErr) {
      console.error("[ovnix-postback] update failed", updErr.message);
      return okText("OK");
    }

    console.log("[ovnix-postback] credited", {
      row: clickRow.id,
      user_id: payload.user_id,
      offer_id: payload.offer_id,
      points,
      finalStatus,
    });
  } catch (e) {
    console.error("[ovnix-postback] exception", e);
  }

  return okText("OK");
}

export const Route = createFileRoute("/api/public/ovnix-postback")({
  server: {
    handlers: {
      GET: async ({ request }) => handleOvnixPostback(request),
      POST: async ({ request }) => handleOvnixPostback(request),
    },
  },
});