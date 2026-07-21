import { createFileRoute } from "@tanstack/react-router";

// Universal Postback (Server-to-Server conversion notice) for all networks.
// Register per-network in each dashboard, using ?network=<slug>:
//
//   OVNIX      https://<host>/api/public/universal-postback?network=ovnix&status={status}&user_id={sub1}&payout={payout}&offer_id={oi}&offer_name={on}&trans_id={trans_id}
//   CPAlead    https://<host>/api/public/universal-postback?network=cpalead&subid={subid}&payout={payout}&campaign_id={campaign_id}&campaign_name={campaign_name}&lead_id={lead_id}
//   Cointiply  https://<host>/api/public/universal-postback?network=cointiply&userid={userid}&amount={amount}&offerid={offerid}&offername={offername}&transid={transid}
//
// Behavior:
//  - Parses the query parameters per network and logs the raw payload.
//  - Finds the matching "clicked"/"pending" transaction row for
//    (network_name, user_id, offer_id) and updates its status to "credited"
//    with the network payout and calculated points.
//  - Responds with plain "OK" so most networks accept it.

type NetworkKey = "ovnix" | "cpalead" | "cointiply";

const NETWORK_LABELS: Record<NetworkKey, string> = {
  ovnix: "OVNIX",
  cpalead: "CPA LEAD",
  cointiply: "COINTO",
};

function detectNetwork(raw: string | null): NetworkKey | null {
  if (!raw) return null;
  const n = raw.trim().toLowerCase();
  if (n === "ovnix") return "ovnix";
  if (n === "cpalead" || n === "cpa-lead" || n === "cpa_lead") return "cpalead";
  if (n === "cointiply" || n === "cointo" || n === "cointo.co") return "cointiply";
  return null;
}

type ParsedPayload = {
  network: NetworkKey;
  network_label: string;
  user_id: string;
  app_id: string;
  click_id: string;
  offer_id: string;
  offer_name: string;
  trans_id: string;
  payout_usd: number;
  status_raw: string;
  country: string;
};

function parsePayload(q: URLSearchParams, network: NetworkKey): ParsedPayload {
  // Networks sometimes forward raw macro tokens like `{userid}` when a
  // parameter wasn't substituted. Treat those as empty so we don't try to
  // match a literal `{userid}` in the DB.
  const clean = (v: string | null): string => {
    if (!v) return "";
    const s = v.trim();
    if (!s) return "";
    if (/^\{[^}]*\}$/.test(s)) return ""; // {userid}, {payout}, ...
    if (/^\[[^\]]*\]$/.test(s)) return ""; // [USER_ID]
    if (/^%7B.*%7D$/i.test(s)) return ""; // url-encoded {..}
    return s;
  };
  const g = (...keys: string[]): string => {
    for (const k of keys) {
      const v = clean(q.get(k));
      if (v) return v;
    }
    return "";
  };
  const num = (...keys: string[]): number => {
    for (const k of keys) {
      const v = clean(q.get(k));
      if (!v) continue;
      const n = Number(v.replace(/[^0-9.\-]/g, ""));
      if (Number.isFinite(n)) return n;
    }
    return 0;
  };
  const base = {
    network,
    network_label: NETWORK_LABELS[network],
    app_id: g("app_id", "appId", "appid", "placement_app_id", "site_id", "siteid"),
    click_id: g("click_id", "clickid", "cid", "click", "tid"),
    country: g("country", "geo", "country_code"),
    status_raw: (clean(q.get("status")) || "").toLowerCase(),
  };
  if (network === "ovnix") {
    return {
      ...base,
      user_id: g("user_id", "sub1", "userid", "subid"),
      offer_id: g("offer_id", "oi", "offerid"),
      offer_name: g("offer_name", "on", "offername"),
      trans_id: g("trans_id", "tid", "transid"),
      payout_usd: num("payout", "amount", "reward"),
    };
  }
  if (network === "cpalead") {
    return {
      ...base,
      user_id: g("subid", "sub_id", "user_id", "sub1", "userid"),
      offer_id: g("campaign_id", "offer_id", "offerid", "campaignid"),
      offer_name: g("campaign_name", "offer_name", "offername"),
      trans_id: g("lead_id", "trans_id", "transid", "tid"),
      payout_usd: num("payout", "amount", "reward", "virtual_currency"),
    };
  }
  // cointiply / cointo — accept every commonly-seen variant of each field
  // and treat unresolved `{macro}` values as missing.
  return {
    ...base,
    user_id: g("userid", "user_id", "subid", "sub_id", "sub1"),
    offer_id: g("offerid", "offer_id", "campaign_id", "offer"),
    offer_name: g("offername", "offer_name", "campaign_name", "name"),
    trans_id: g("transid", "trans_id", "tid", "transaction_id"),
    payout_usd: num("amount", "payout", "currency_amount", "reward", "usd_amount", "coins"),
  };
}

function okResponse(network: NetworkKey | null) {
  // CPAlead accepts "1" or "OK"; most others accept "OK". Return "OK" universally
  // and additionally "1" body for CPAlead to be safe.
  const body = network === "cpalead" ? "1" : "OK";
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function sendTelegramNotification(payload: ParsedPayload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  console.log("[tg] entry", { hasToken: !!token, tokenLen: token?.length ?? 0, chatId });
  if (!token || !chatId) {
    console.warn("[universal-postback] telegram creds missing, skipping notify");
    return;
  }

  const text =
    `🔹 <b>New Conversion Alert!</b> 🚀\n` +
    `----------------------------------------\n` +
    `💰 <b>Network:</b> ${payload.network.toUpperCase()}\n` +
    `👤 <b>User ID:</b> <code>${payload.user_id}</code>\n` +
    `🎮 <b>Offer Name:</b> ${payload.offer_name || "Unknown Offer"}\n` +
    `🆔 <b>Offer ID:</b> <code>${payload.offer_id}</code>\n` +
    `💵 <b>Payout:</b> $${payload.payout_usd}\n` +
    `🔑 <b>Transaction ID:</b> <code>${payload.trans_id || "N/A"}</code>\n` +
    `----------------------------------------\n` +
    `✨ <i>Balance credited successfully!</i> ✅`;

  try {
    // Diagnostic: verify chat access first
    try {
      const chk = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chatId)}`);
      console.log("[tg] getChat", chk.status, (await chk.text()).slice(0, 400));
    } catch (e) {
      console.error("[tg] getChat threw", String(e));
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const body = await res.text();
    console.log("[tg] sendMessage", res.status, body.slice(0, 400));
  } catch (e) {
    console.error("[universal-postback] telegram notify exception", e);
  }
}

function isCreditStatus(status: string | null | undefined) {
  return status === "credited" || status === "completed" || status === "success";
}

function logDbError(label: string, error: unknown, context?: Record<string, unknown>) {
  const err = error as { message?: string; code?: string; details?: string; hint?: string } | null;
  console.error(`[universal-postback] ${label}`, {
    message: err?.message ?? String(error),
    code: err?.code,
    details: err?.details,
    hint: err?.hint,
    context,
  });
}

async function resolvePublisherId(
  supabaseAdmin: any,
  payload: ParsedPayload,
): Promise<{ publisherId: string | null; source: string }> {
  if (payload.app_id) {
    const { data: placement, error: placementErr } = await supabaseAdmin
      .from("placements")
      .select("user_id, app_id")
      .eq("app_id", payload.app_id)
      .maybeSingle();
    if (placementErr) logDbError("placement lookup failed", placementErr, { app_id: payload.app_id });

    if (placement?.user_id) {
      const { data: publisher, error: publisherErr } = await supabaseAdmin
        .from("publishers")
        .select("id")
        .eq("user_id", placement.user_id)
        .maybeSingle();
      if (publisherErr) logDbError("publisher lookup by placement owner failed", publisherErr, { app_id: payload.app_id });
      if (publisher?.id) return { publisherId: publisher.id, source: "placement.app_id" };
    }

    const { data: publisherByApp, error: publisherByAppErr } = await supabaseAdmin
      .from("publishers")
      .select("id")
      .eq("app_id", payload.app_id)
      .maybeSingle();
    if (publisherByAppErr) logDbError("publisher lookup by publisher app_id failed", publisherByAppErr, { app_id: payload.app_id });
    if (publisherByApp?.id) return { publisherId: publisherByApp.id, source: "publishers.app_id" };
  }

  // Test-mode fallback: the public wall is placement-based, so use the newest
  // placement owner before reusing old transactions that may have been written
  // under the wrong publisher during earlier tests.
  const { data: latestPlacement, error: latestPlacementErr } = await supabaseAdmin
    .from("placements")
    .select("user_id, app_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestPlacementErr) logDbError("latest placement fallback lookup failed", latestPlacementErr);
  if (latestPlacement?.user_id) {
    const { data: publisher, error: publisherErr } = await supabaseAdmin
      .from("publishers")
      .select("id")
      .eq("user_id", latestPlacement.user_id)
      .maybeSingle();
    if (publisherErr) logDbError("latest placement publisher fallback failed", publisherErr, { app_id: latestPlacement.app_id });
    if (publisher?.id) return { publisherId: publisher.id, source: "latest placement fallback" };
  }

  const { data: recentTx, error: recentTxErr } = await supabaseAdmin
    .from("transactions")
    .select("publisher_id")
    .eq("user_id", payload.user_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recentTxErr) logDbError("recent transaction publisher lookup failed", recentTxErr, { user_id: payload.user_id });
  if (recentTx?.publisher_id) return { publisherId: recentTx.publisher_id, source: "recent transaction user_id" };

  const { data: firstPub, error: firstPubErr } = await supabaseAdmin
    .from("publishers")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (firstPubErr) logDbError("publisher fallback lookup failed", firstPubErr);
  return { publisherId: firstPub?.id ?? null, source: "publisher fallback" };
}

async function readBalancePoints(supabaseAdmin: any, publisherId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_balances")
    .select("balance_points")
    .eq("publisher_id", publisherId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    logDbError("balance read failed", error, { publisher_id: publisherId, user_id: userId });
    return 0;
  }
  return Number(data?.balance_points ?? 0);
}

async function ensureBalanceCredited(
  supabaseAdmin: any,
  publisherId: string,
  userId: string,
  points: number,
  payoutUsd: number,
  beforeBalance: number,
) {
  if (points <= 0) return;
  const afterBalance = await readBalancePoints(supabaseAdmin, publisherId, userId);
  const expectedBalance = beforeBalance + points;
  if (afterBalance >= expectedBalance) {
    console.log("[universal-postback] balance credited", {
      publisher_id: publisherId,
      user_id: userId,
      beforeBalance,
      afterBalance,
      points,
    });
    return;
  }

  const delta = expectedBalance - afterBalance;
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from("user_balances")
    .select("balance_points, total_earned_points, total_credited_usd")
    .eq("publisher_id", publisherId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingErr) {
    logDbError("manual balance repair lookup failed", existingErr, { publisher_id: publisherId, user_id: userId });
    return;
  }

  const nowIso = new Date().toISOString();
  const balancePayload = {
    publisher_id: publisherId,
    user_id: userId,
    balance_points: Number(existing?.balance_points ?? 0) + delta,
    total_earned_points: Number(existing?.total_earned_points ?? 0) + delta,
    total_credited_usd: Number(existing?.total_credited_usd ?? 0) + payoutUsd,
    last_credited_at: nowIso,
    updated_at: nowIso,
  };

  const write = existing
    ? supabaseAdmin
        .from("user_balances")
        .update(balancePayload)
        .eq("publisher_id", publisherId)
        .eq("user_id", userId)
    : supabaseAdmin.from("user_balances").insert({ ...balancePayload, created_at: nowIso });

  const { error: repairErr } = await write;
  if (repairErr) {
    logDbError("manual balance repair failed", repairErr, {
      publisher_id: publisherId,
      user_id: userId,
      delta,
      points,
    });
  } else {
    console.log("[universal-postback] manual balance repair applied", {
      publisher_id: publisherId,
      user_id: userId,
      delta,
      points,
    });
  }
}

async function handle(request: Request) {
  const rawUrl = request.url.replace(/&amp;/g, "&");
  const url = new URL(rawUrl);
  const q = url.searchParams;

  const network = detectNetwork(q.get("network"));
  console.log("[universal-postback] raw", {
    url: rawUrl,
    network_param: q.get("network"),
    params: Object.fromEntries(q.entries()),
  });

  if (!network) {
    console.warn("[universal-postback] unknown network param");
    return okResponse(null);
  }

  const payload = parsePayload(q, network);
  console.log("[universal-postback] parsed", payload);

  if (!payload.user_id || !payload.offer_id) {
    console.warn("[universal-postback] missing user_id or offer_id", {
      network,
      user_id: payload.user_id,
      offer_id: payload.offer_id,
    });
    return okResponse(network);
  }

  // Same conversion the wall uses: payout USD * 2000 => points (platform
  // margin already baked into the offer feed).
  const points = Math.max(0, Math.round(payload.payout_usd * 2000));

  const finalStatus =
    payload.status_raw === "reversed" ||
    payload.status_raw === "rejected" ||
    payload.status_raw === "chargeback"
      ? "rejected"
      : "completed";

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let clickRow: { id: string; status: string; publisher_id: string; points_awarded: number | null } | null = null;
    let findErr: unknown = null;

    if (payload.click_id) {
      const byClick = await supabaseAdmin
        .from("transactions")
        .select("id, status, publisher_id, points_awarded")
        .eq("click_id", payload.click_id)
        .eq("user_id", payload.user_id)
        .maybeSingle();
      clickRow = byClick.data ?? null;
      findErr = byClick.error;
    }

    if (!clickRow && !findErr) {
      const byUserOffer = await supabaseAdmin
        .from("transactions")
        .select("id, status, publisher_id, points_awarded")
        .eq("user_id", payload.user_id)
        .eq("offer_id", payload.offer_id)
        .in("status", ["clicked", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      clickRow = byUserOffer.data ?? null;
      findErr = byUserOffer.error;
    }

    if (findErr) {
      logDbError("transaction lookup failed", findErr, {
        user_id: payload.user_id,
        offer_id: payload.offer_id,
        click_id: payload.click_id,
      });
      return okResponse(network);
    }

    if (!clickRow) {
      console.warn("[universal-postback] no matching click row", {
        network: payload.network_label,
        user_id: payload.user_id,
        offer_id: payload.offer_id,
      });

      // Fallback: insert a synthetic COMPLETED row directly into the actual
      // history table (`transactions`) so test postbacks are not lost.
      const { publisherId, source } = await resolvePublisherId(supabaseAdmin, payload);
      if (!publisherId) {
        console.error("[universal-postback] no publisher available for fallback insert", {
          user_id: payload.user_id,
          app_id: payload.app_id,
          offer_id: payload.offer_id,
        });
      } else {
        const beforeBalance = isCreditStatus(finalStatus)
          ? await readBalancePoints(supabaseAdmin, publisherId, payload.user_id)
          : 0;
        const fallbackTransId =
          payload.trans_id || `auto_${payload.network}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const nowIso = new Date().toISOString();

        const { data: existingByTrans, error: existingByTransErr } = await supabaseAdmin
          .from("transactions")
          .select("id, status, publisher_id, points_awarded")
          .eq("network_name", payload.network_label)
          .eq("trans_id", fallbackTransId)
          .maybeSingle();
        if (existingByTransErr) {
          logDbError("existing transaction lookup failed", existingByTransErr, {
            network_name: payload.network_label,
            trans_id: fallbackTransId,
          });
        }

        const transactionPayload = {
          publisher_id: existingByTrans?.publisher_id ?? publisherId,
          network_name: payload.network_label,
          user_id: payload.user_id,
          offer_id: payload.offer_id,
          offer_name: payload.offer_name || null,
          country: payload.country || null,
          trans_id: fallbackTransId,
          payout: payload.payout_usd,
          reward_amount: payload.payout_usd,
          points_awarded: points,
          status: finalStatus,
          created_at: nowIso,
        };

        const writeResult = existingByTrans
          ? await supabaseAdmin.from("transactions").update(transactionPayload).eq("id", existingByTrans.id)
          : await supabaseAdmin.from("transactions").insert(transactionPayload);

        if (writeResult.error) {
          logDbError("fallback transaction insert/update failed", writeResult.error, {
            table: "transactions",
            publisher_id: transactionPayload.publisher_id,
            user_id: payload.user_id,
            offer_id: payload.offer_id,
            trans_id: fallbackTransId,
            status: finalStatus,
          });
        } else {
          const shouldCredit = isCreditStatus(finalStatus) && !isCreditStatus(existingByTrans?.status);
          if (shouldCredit) {
            await ensureBalanceCredited(
              supabaseAdmin,
              transactionPayload.publisher_id,
              payload.user_id,
              points,
              payload.payout_usd,
              beforeBalance,
            );
          }
          console.log("[universal-postback] fallback history row saved", {
            network: payload.network_label,
            user_id: payload.user_id,
            offer_id: payload.offer_id,
            publisher_id: transactionPayload.publisher_id,
            publisher_source: source,
            points,
            finalStatus,
            created_at: nowIso,
          });
          if (isCreditStatus(finalStatus)) {
            await sendTelegramNotification(payload);
          }
        }
      }
      return okResponse(network);
    }

    const beforeBalance = isCreditStatus(finalStatus) && !isCreditStatus(clickRow.status)
      ? await readBalancePoints(supabaseAdmin, clickRow.publisher_id, payload.user_id)
      : 0;
    const nowIso = new Date().toISOString();
    const { error: updErr } = await supabaseAdmin
      .from("transactions")
      .update({
        status: finalStatus,
        payout: payload.payout_usd,
        reward_amount: payload.payout_usd,
        points_awarded: points,
        offer_name: payload.offer_name || undefined,
        trans_id: payload.trans_id || undefined,
        country: payload.country || undefined,
        created_at: nowIso,
      })
      .eq("id", clickRow.id);

    if (updErr) {
      logDbError("transaction update failed", updErr, {
        table: "transactions",
        row_id: clickRow.id,
        user_id: payload.user_id,
        offer_id: payload.offer_id,
        trans_id: payload.trans_id,
      });
      return okResponse(network);
    }

    if (isCreditStatus(finalStatus) && !isCreditStatus(clickRow.status)) {
      await ensureBalanceCredited(
        supabaseAdmin,
        clickRow.publisher_id,
        payload.user_id,
        points,
        payload.payout_usd,
        beforeBalance,
      );
    }

    console.log("[universal-postback] credited", {
      row: clickRow.id,
      network: payload.network_label,
      user_id: payload.user_id,
      offer_id: payload.offer_id,
      points,
      finalStatus,
      created_at: nowIso,
    });

    if (isCreditStatus(finalStatus)) {
      await sendTelegramNotification(payload);
    }
  } catch (e) {
    logDbError("database transaction exception", e, {
      user_id: payload.user_id,
      offer_id: payload.offer_id,
      network: payload.network_label,
      app_id: payload.app_id,
    });
  }

  return okResponse(network);
}

export const Route = createFileRoute("/api/public/universal-postback")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});