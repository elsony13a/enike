import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

// Public S2S postback endpoint used by ad networks.
// URL: /api/public/postback
// Query params: click_id, payout, status, secret_key, [network], [trans_id], [reward]
//
// - Verifies secret_key against a publisher placement (constant-time).
// - Upserts the transaction with the reported status (defaults to "success").
// - Credits points to the end user via points_per_dollar on the network.
// - Appends every attempt (successful or not) to postback_logs.
// Responds "1" on success/duplicate, "0\n<reason>" on failure — the industry
// standard for offerwall S2S postbacks.

function ok(msg = "1") {
  return new Response(msg, { status: 200, headers: { "Content-Type": "text/plain" } });
}
function fail(reason: string, status = 400) {
  return new Response(`0\n${reason}`, { status, headers: { "Content-Type": "text/plain" } });
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// Cointo / AdsWedMedia HMAC signature over the canonical payload string
// `${event}:${user_id}:${click_id}:${reward}` using the network's site_secret.
function computeHmac(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

async function readParams(request: Request): Promise<URLSearchParams> {
  const cleanUrl = request.url.replace(/&amp;/g, "&");
  const params = new URL(cleanUrl).searchParams;
  if (request.method === "POST") {
    try {
      const contentType = request.headers.get("content-type") ?? "";
      const body = await request.text();
      const cleanBody = body.replace(/&amp;/g, "&");
      if (contentType.includes("application/json")) {
        const json = JSON.parse(cleanBody) as Record<string, unknown>;
        for (const [k, v] of Object.entries(json)) {
          if (v !== undefined && v !== null && !params.has(k)) params.set(k, String(v));
        }
      } else if (cleanBody.includes("=")) {
        const bodyParams = new URLSearchParams(cleanBody);
        for (const [k, v] of bodyParams.entries()) if (!params.has(k)) params.set(k, v);
      }
    } catch {
      // ignore body parse errors — query-string is authoritative
    }
  }
  return params;
}

async function handle(request: Request): Promise<Response> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const params = await readParams(request);

  const rawParams: Record<string, string> = {};
  params.forEach((v, k) => (rawParams[k] = v));

  const click_id = params.get("click_id")?.trim();
  const payoutStr = params.get("payout")?.trim();
  const eventParam = params.get("event")?.trim().toLowerCase();
  const status = (params.get("status")?.trim() || eventParam || "success").toLowerCase();
  const secret_key = params.get("secret_key")?.trim();
  const site_key = params.get("site_key")?.trim();
  const signature = params.get("signature")?.trim();
  const rewardStr = params.get("reward")?.trim();
  const userIdParam = params.get("user_id")?.trim() ?? params.get("sub_id")?.trim() ?? "";
  const network = params.get("network")?.trim() || (site_key ? "Cointo" : "unknown");
  const trans_id = params.get("trans_id")?.trim() || click_id;

  const logAttempt = async (fields: {
    verified: boolean;
    response_code: number;
    response_message: string;
    publisher_id?: string | null;
    placement_id?: string | null;
    points_awarded?: number | null;
  }) => {
    await supabaseAdmin.from("postback_logs").insert({
      network_name: network,
      publisher_id: fields.publisher_id ?? null,
      placement_id: fields.placement_id ?? null,
      click_id: click_id ?? null,
      payout: payoutStr ? Number(payoutStr) : null,
      points_awarded: fields.points_awarded ?? null,
      status,
      raw_params: rawParams,
      verified: fields.verified,
      response_code: fields.response_code,
      response_message: fields.response_message,
    });
  };

  // ---- Cointo / AdsWedMedia HMAC branch ------------------------------------
  // Triggered when the request carries `site_key` + `signature`. Uses the
  // network's `postback_secure_key` as the shared site_secret.
  if (site_key || signature) {
    if (!eventParam || !userIdParam || !click_id || rewardStr === undefined || !signature) {
      await logAttempt({ verified: false, response_code: 422, response_message: "missing parameters" });
      return fail("missing parameters", 422);
    }

    const { data: cointoNet } = await supabaseAdmin
      .from("ad_networks")
      .select("id, name, postback_secure_key, points_per_dollar, profit_margin_pct, is_active")
      .ilike("name", "Cointo")
      .maybeSingle();
    if (!cointoNet?.postback_secure_key) {
      await logAttempt({ verified: false, response_code: 401, response_message: "network not configured" });
      return fail("network not configured", 401);
    }

    const expected = computeHmac(
      cointoNet.postback_secure_key,
      `${eventParam}:${userIdParam}:${click_id}:${rewardStr}`,
    );
    if (!safeEqual(expected, signature.toLowerCase())) {
      await logAttempt({ verified: false, response_code: 401, response_message: "invalid signature" });
      return fail("invalid signature", 401);
    }

    // Resolve placement via site_key (matched against placement.secret_key).
    let placement: { id: string; user_id: string } | null = null;
    if (site_key) {
      const { data: cands } = await supabaseAdmin
        .from("placements")
        .select("id, user_id, secret_key")
        .limit(1000);
      placement =
        cands?.find((p) => p.secret_key && safeEqual(p.secret_key, site_key)) ?? null;
    }

    const publisherRes = placement
      ? await supabaseAdmin.from("publishers").select("id").eq("user_id", placement.user_id).maybeSingle()
      : null;
    const publisher = publisherRes?.data ?? null;
    if (!placement || !publisher?.id) {
      await logAttempt({
        verified: true,
        response_code: 404,
        response_message: "placement/publisher not found",
        placement_id: placement?.id ?? null,
      });
      return fail("placement not found", 404);
    }

    const reward = Number(rewardStr);
    const rate = Number(cointoNet.points_per_dollar ?? 1000);
    const marginPct = Math.min(Math.max(Number(cointoNet.profit_margin_pct ?? 0), 0), 100);
    // Cointo `reward` is dollars. Apply margin then convert.
    const netReward = Number.isFinite(reward) ? reward * (1 - marginPct / 100) : 0;
    let points = Math.round(netReward * rate);

    let finalStatus: string;
    if (eventParam === "credit") {
      finalStatus = "success";
    } else if (eventParam === "reject" || eventParam === "chargeback") {
      finalStatus = eventParam === "reject" ? "rejected" : "chargeback";
      points = -Math.abs(points); // reverse points
    } else {
      finalStatus = eventParam;
    }

    const { error: upErr } = await supabaseAdmin.from("transactions").upsert(
      {
        publisher_id: publisher.id,
        network_name: cointoNet.name,
        user_id: userIdParam,
        trans_id: trans_id ?? click_id,
        click_id,
        reward_amount: points,
        points_awarded: points,
        payout: Number.isFinite(reward) ? reward : 0,
        status: finalStatus,
        offer_name: rawParams["offer_name"] ?? undefined,
        country: rawParams["country"] ?? undefined,
      },
      { onConflict: "network_name,trans_id" },
    );
    if (upErr) {
      await logAttempt({
        verified: true,
        response_code: 500,
        response_message: upErr.message,
        publisher_id: publisher.id,
        placement_id: placement.id,
        points_awarded: points,
      });
      return fail("db error", 500);
    }

    await logAttempt({
      verified: true,
      response_code: 200,
      response_message: `ok:${eventParam}`,
      publisher_id: publisher.id,
      placement_id: placement.id,
      points_awarded: points,
    });
    return ok("1");
  }
  // -------------------------------------------------------------------------

  if (!click_id) {
    await logAttempt({ verified: false, response_code: 400, response_message: "missing click_id" });
    return fail("missing click_id");
  }
  if (!secret_key) {
    await logAttempt({ verified: false, response_code: 400, response_message: "missing secret_key" });
    return fail("missing secret_key");
  }

  // Look up the placement whose secret_key matches. We fetch a small set of
  // candidates then constant-time compare to avoid timing side-channels.
  const { data: placementCandidates } = await supabaseAdmin
    .from("placements")
    .select("id, user_id, secret_key, app_id")
    .limit(500);
  const placement =
    placementCandidates?.find((p) => p.secret_key && safeEqual(p.secret_key, secret_key)) ?? null;

  if (!placement) {
    await logAttempt({ verified: false, response_code: 401, response_message: "invalid secret_key" });
    return fail("invalid secret_key", 401);
  }

  const { data: publisher } = await supabaseAdmin
    .from("publishers")
    .select("id")
    .eq("user_id", placement.user_id)
    .maybeSingle();

  if (!publisher?.id) {
    await logAttempt({
      verified: true,
      response_code: 404,
      response_message: "publisher not found",
      placement_id: placement.id,
    });
    return fail("publisher not found", 404);
  }

  // Resolve points conversion rate from the network (fallback 1000 pts/$).
  const { data: netRow } = await supabaseAdmin
    .from("ad_networks")
    .select("points_per_dollar, profit_margin_pct, is_active")
    .ilike("name", network)
    .maybeSingle();
  const rate = Number(netRow?.points_per_dollar ?? 1000);
  const marginPct = Math.min(Math.max(Number(netRow?.profit_margin_pct ?? 0), 0), 100);
  const payout = payoutStr ? Number(payoutStr) : 0;
  if (!Number.isFinite(payout) || payout < 0) {
    await logAttempt({
      verified: true,
      response_code: 400,
      response_message: "invalid payout",
      publisher_id: publisher.id,
      placement_id: placement.id,
    });
    return fail("invalid payout");
  }
  const netPayout = payout * (1 - marginPct / 100);
  const points = Math.round(netPayout * rate);

  const finalStatus = ["success", "paid", "approved", "completed"].includes(status)
    ? "success"
    : status;

  // Deduplicate on (network, trans_id).
  const { error: upErr } = await supabaseAdmin.from("transactions").upsert(
    {
      publisher_id: publisher?.id ?? null,
      network_name: network,
      user_id: rawParams["user_id"] ?? rawParams["sub_id"] ?? "",
      trans_id: trans_id ?? click_id,
      click_id,
      reward_amount: points,
      points_awarded: points,
      payout,
      status: finalStatus,
      offer_name: rawParams["offer_name"] ?? undefined,
      country: rawParams["country"] ?? undefined,
    },
    { onConflict: "network_name,trans_id" },
  );

  if (upErr) {
    await logAttempt({
      verified: true,
      response_code: 500,
      response_message: upErr.message,
      publisher_id: publisher?.id ?? null,
      placement_id: placement.id,
      points_awarded: points,
    });
    return fail("db error", 500);
  }

  await logAttempt({
    verified: true,
    response_code: 200,
    response_message: "ok",
    publisher_id: publisher?.id ?? null,
    placement_id: placement.id,
    points_awarded: points,
  });

  return ok("1");
}

export const Route = createFileRoute("/api/public/postback")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});