import { createFileRoute } from '@tanstack/react-router';
import { timingSafeEqual } from 'crypto';

// Public postback endpoint for ad networks.
// URL: /api/public/global-postback
// Required params: app_id, network, trans_id, user_id, secure_key
// Optional: reward, payout
//
// Responds with plain-text "1" on success/duplicate (industry standard),
// "0\n<reason>" on failure, so ad networks that only check for "1" work.

function ok(msg = '1') {
  return new Response(msg, { status: 200, headers: { 'Content-Type': 'text/plain' } });
}
function fail(reason: string, status = 400) {
  return new Response(`0\n${reason}`, { status, headers: { 'Content-Type': 'text/plain' } });
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function replaceMacros(url: string, ctx: Record<string, string | number>) {
  return url.replace(/\{([a-zA-Z_]+)\}/g, (_, k) => {
    const v = ctx[k];
    return v === undefined ? '' : encodeURIComponent(String(v));
  });
}

async function handle(request: Request): Promise<Response> {
  try {
    // 1. Sanitize incoming URL — some networks send &amp; instead of &.
    const rawUrl = request.url;
    const cleanUrlString = rawUrl.replace(/&amp;/g, '&');

    let queryParams: URLSearchParams;
    try {
      queryParams = new URL(cleanUrlString).searchParams;
    } catch {
      return fail('invalid_url', 400);
    }

    // For POST bodies (form-encoded), merge them in as well.
    if (request.method === 'POST') {
      const contentType = request.headers.get('content-type') ?? '';
      if (contentType.includes('application/x-www-form-urlencoded')) {
        const bodyText = (await request.text()).replace(/&amp;/g, '&');
        const bodyParams = new URLSearchParams(bodyText);
        bodyParams.forEach((v, k) => {
          if (!queryParams.has(k)) queryParams.append(k, v);
        });
      } else if (contentType.includes('application/json')) {
        try {
          const json = (await request.json()) as Record<string, unknown>;
          for (const [k, v] of Object.entries(json)) {
            if (!queryParams.has(k) && v != null) queryParams.append(k, String(v));
          }
        } catch {
          // ignore malformed JSON body
        }
      }
    }

    const appId = queryParams.get('app_id')?.trim();
    const networkName = queryParams.get('network')?.trim();
    const transId = queryParams.get('trans_id')?.trim();
    const userId = queryParams.get('user_id')?.trim();
    const secureKey = queryParams.get('secure_key')?.trim() ?? '';
    const rewardAmount = Number(queryParams.get('reward') ?? '0') || 0;
    const payout = Number(queryParams.get('payout') ?? '0') || 0;

    if (!appId || !networkName || !transId || !userId) {
      return fail('missing_params', 400);
    }

    // 2. Admin client (service role, bypasses RLS).
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    // 3. Verify network + secure key.
    const { data: network, error: networkErr } = await supabaseAdmin
      .from('ad_networks')
      .select('id, name, postback_secure_key, is_active')
      .ilike('name', networkName)
      .maybeSingle();

    if (networkErr || !network) return fail('unknown_network', 404);
    if (!network.is_active) return fail('network_inactive', 403);
    if (!safeEqual(secureKey, network.postback_secure_key)) {
      return fail('invalid_secure_key', 401);
    }

    // 4. Look up publisher by app_id.
    const { data: publisher, error: pubErr } = await supabaseAdmin
      .from('publishers')
      .select('id, app_id, status')
      .eq('app_id', appId)
      .maybeSingle();

    if (pubErr || !publisher) return fail('unknown_publisher', 404);
    if (publisher.status !== 'active') return fail('publisher_inactive', 403);

    // 5. Insert transaction (deduped by unique (network_name, trans_id)).
    const { error: insertErr } = await supabaseAdmin.from('transactions').insert({
      publisher_id: publisher.id,
      network_name: network.name,
      user_id: userId,
      trans_id: transId,
      reward_amount: rewardAmount,
      payout,
      status: 'success',
    });

    if (insertErr) {
      // Unique-violation on (network_name, trans_id) → duplicate.
      if ((insertErr as { code?: string }).code === '23505') {
        return ok('1'); // acknowledge duplicate so network stops retrying
      }
      console.error('[global-postback] insert error', insertErr);
      return fail('insert_failed', 500);
    }

    // 6. Fire-and-forget forward to publisher's configured postbacks.
    const { data: postbacks } = await supabaseAdmin
      .from('publisher_postbacks')
      .select('postback_url')
      .eq('publisher_id', publisher.id);

    if (postbacks && postbacks.length > 0) {
      const macros = {
        user_id: userId,
        trans_id: transId,
        network: network.name,
        reward: rewardAmount,
        payout,
        app_id: appId,
      };
      await Promise.allSettled(
        postbacks.map((p) =>
          fetch(replaceMacros(p.postback_url, macros), { method: 'GET' }).catch(() => null),
        ),
      );
    }

    return ok('1');
  } catch (err) {
    console.error('[global-postback] unexpected error', err);
    return fail('server_error', 500);
  }
}

export const Route = createFileRoute('/api/public/global-postback')({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});