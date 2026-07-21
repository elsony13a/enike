import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RawOffer = {
  offer_id?: string | number;
  offerId?: string | number;
  offerid?: string | number;
  id?: string | number;
  campaign_id?: string | number;
  campaignId?: string | number;
  campaignID?: string | number;
  title?: string;
  name?: string;
  offer_name?: string;
  campaign_name?: string;
  description?: string;
  desc?: string;
  short_description?: string;
  conversion?: string;
  requirements?: string;
  instructions?: string;
  payout?: number | string;
  amount?: number | string;
  reward?: number | string;
  price?: number | string;
  image?: string;
  image_url?: string;
  icon?: string;
  country?: string;
  target_country?: string;
  countries?: string | string[];
  tracking_url?: string;
  tracking_link?: string;
  click_url?: string;
  clickUrl?: string;
  offer_url?: string;
  url?: string;
  link?: string;
  preview_url?: string;
  device?: string | string[];
  devices?: string | string[];
  os?: string;
  operating_system?: string;
  platform?: string;
  creatives?: Array<{ url?: string; type?: string }> | { url?: string } | string;
};

function pickString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return undefined;
}
function pickNumber(...vals: unknown[]): number | undefined {
  for (const v of vals) {
    const cleaned = typeof v === "string" ? v.replace(/,/g, "").replace(/[^0-9.-]/g, "") : v;
    const n =
      typeof cleaned === "number"
        ? cleaned
        : typeof cleaned === "string"
          ? parseFloat(cleaned)
          : NaN;
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

const ISO_COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS",
  "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN",
  "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE",
  "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF",
  "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM",
  "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM",
  "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC",
  "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK",
  "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA",
  "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG",
  "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
  "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO",
  "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
  "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW",
];

const COUNTRY_NAME_ALIASES: Record<string, string> = {
  "america": "US",
  "bolivia": "BO",
  "brunei": "BN",
  "czech republic": "CZ",
  "ivory coast": "CI",
  "iran": "IR",
  "laos": "LA",
  "macedonia": "MK",
  "moldova": "MD",
  "palestine": "PS",
  "palestinian territory": "PS",
  "republic of korea": "KR",
  "republic of south korea": "KR",
  "russia": "RU",
  "south korea": "KR",
  "syria": "SY",
  "taiwan": "TW",
  "tanzania": "TZ",
  "the netherlands": "NL",
  "turkey": "TR",
  "uk": "GB",
  "united kingdom": "GB",
  "united states": "US",
  "united states of america": "US",
  "usa": "US",
  "vatican": "VA",
  "venezuela": "VE",
  "vietnam": "VN",
};

const COUNTRY_NAME_TO_CODE: Record<string, string> = (() => {
  const out: Record<string, string> = { ...COUNTRY_NAME_ALIASES };
  try {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    for (const code of ISO_COUNTRY_CODES) {
      const name = names.of(code);
      if (name) out[name.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, " ").trim()] = code;
    }
  } catch {
    // Intl.DisplayNames is available in modern runtimes; aliases above cover
    // the known network-specific names if it is not.
  }
  return out;
})();

const GLOBAL_COUNTRY_TOKENS = new Set(["ALL", "GLOBAL", "WW", "WORLDWIDE", "ANY", "INTL", "INTERNATIONAL", "*"]);

function splitCountryValues(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(splitCountryValues);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return splitCountryValues(obj.code ?? obj.country ?? obj.name);
  }
  const raw = String(value).trim();
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return splitCountryValues(parsed);
    } catch {
      // fall through to loose splitting
    }
  }
  const cleaned = raw.replace(/["'\[\]]/g, " ").replace(/&amp;/gi, "&").trim();
  if (!cleaned) return [];
  if (/[;,|]/.test(cleaned)) return cleaned.split(/[;,|]+/).map((s) => s.trim()).filter(Boolean);
  if (/^(?:[A-Za-z]{2,3}\s+)+[A-Za-z]{2,3}$/.test(cleaned)) {
    return cleaned.split(/\s+/).map((s) => s.trim()).filter(Boolean);
  }
  return [cleaned];
}

function countryTokenToCode(token: string): string | undefined {
  const compact = token.trim().replace(/["'\[\]]/g, "");
  if (!compact) return undefined;
  const upper = compact.toUpperCase();
  if (GLOBAL_COUNTRY_TOKENS.has(upper)) return "ALL";
  if (upper === "UK") return "GB";
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  const key = compact.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();
  return COUNTRY_NAME_TO_CODE[key];
}

function normalizeCountry(v: unknown): string | undefined {
  const tokens = splitCountryValues(v);
  const normalized = tokens
    .map(countryTokenToCode)
    .filter((code): code is string => Boolean(code));
  if (normalized.includes("ALL")) return "ALL";
  return [...new Set(normalized)].join(",") || undefined;
}

function normalizeDevice(v: unknown): string | undefined {
  const raw = Array.isArray(v)
    ? v
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object") {
            const obj = item as Record<string, unknown>;
            return pickString(obj.name, obj.device, obj.os, obj.platform);
          }
          return undefined;
        })
        .filter(Boolean)
        .join(",")
    : typeof v === "string"
      ? v
      : "";
  if (!raw) return undefined;
  const s = raw.toLowerCase();
  const out: string[] = [];
  if (s.includes("android")) out.push("Android");
  if (s.includes("ios") || s.includes("iphone") || s.includes("ipad")) out.push("iOS");
  if (s.includes("web") || s.includes("desktop") || s.includes("windows") || s.includes("mac"))
    out.push("Web");
  return out.length ? [...new Set(out)].join(",") : raw.slice(0, 60);
}

function pickCreativeUrl(c: RawOffer["creatives"]): string | undefined {
  if (!c) return undefined;
  if (typeof c === "string") return c.trim() || undefined;
  if (Array.isArray(c)) {
    for (const item of c) if (item?.url) return item.url;
    return undefined;
  }
  return c.url;
}

// Gemiwall returns offers with a numeric `id`, a localized `description`
// object keyed by language, and a `url` containing an unencoded [USER_ID]
// macro we want to preserve for client-side substitution.
function normalizeGemiwallOffer(raw: unknown): RawOffer {
  const o = (raw ?? {}) as Record<string, unknown>;
  const rawId = pickString(o.id, o.offer_id, o.offerId);
  const descObj = o.description;
  let description: string | undefined;
  if (descObj && typeof descObj === "object" && !Array.isArray(descObj)) {
    const d = descObj as Record<string, unknown>;
    description = pickString(d.en, d.EN, d.default) ?? pickString(...Object.values(d));
  } else {
    description = pickString(descObj);
  }
  return {
    offer_id: rawId ? `gemi_${rawId}` : undefined,
    title: pickString(o.name, o.title),
    description,
    icon: pickString(o.icon, o.image, o.image_url),
    payout: pickNumber(o.payout, o.amount, o.reward),
    url: pickString(o.url, o.tracking_url, o.link),
    device: (o.device ?? o.devices) as string | string[] | undefined,
    target_country: pickString(o.country, o.target_country) ?? undefined,
  };
}

// OVNIX returns offers with `offer_id`, `offer_name`, `offer_payout`,
// `offer_image`, `offer_desc`, and `tracking_url` per their official docs.
function normalizeOvnixOffer(raw: unknown): RawOffer {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    offer_id: pickString(o.offer_id, o.offerId, o.id),
    title: pickString(o.offer_name, o.name, o.title),
    description: pickString(o.offer_desc, o.description, o.desc),
    payout: pickNumber(o.offer_payout, o.payout, o.amount),
    image_url: pickString(o.offer_image, o.image, o.icon, o.image_url),
    tracking_url: pickString(o.tracking_url, o.tracking_link, o.link, o.url),
    target_country: normalizeCountry(o.country ?? o.countries ?? o.target_country),
    device: (o.device ?? o.devices ?? o.os) as string | string[] | undefined,
  };
}

// COINTO returns { success: true, offers: [{ offer_id, name, preview, payout,
// device, click_url, ... }] }. Map their field names to our RawOffer shape.
function normalizeCointoOffer(raw: unknown): RawOffer {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    offer_id: pickString(o.offer_id, o.offerId, o.id),
    title: pickString(o.name, o.title, o.offer_name),
    description: pickString(o.description, o.desc, o.requirements, o.conversion),
    payout: pickNumber(o.payout, o.amount, o.reward),
    image_url: pickString(o.preview, o.image, o.icon, o.image_url),
    tracking_url: pickString(o.click_url, o.tracking_url, o.link, o.url),
    device: (o.device ?? o.devices ?? o.os) as string | string[] | undefined,
    target_country: normalizeCountry(o.country ?? o.countries ?? o.target_country),
  };
}

function parsePossiblyWrappedJson(text: string): unknown {
  const trimmed = text.trim().replace(/^\uFEFF/, "");
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "string" && /^[\s\uFEFF]*[\x5B{]/.test(parsed)) {
      return parsePossiblyWrappedJson(parsed);
    }
    return parsed;
  } catch (firstError) {
    console.error("Failed to parse as JSON, trying to clean string:", firstError);
    const withoutJsonp = trimmed.replace(/^\s*[\w$.]+\s*\(\s*/, "").replace(/\s*\)\s*;?\s*$/, "");
    try {
      return JSON.parse(withoutJsonp);
    } catch {
      const firstBrace = trimmed.search(/[\x5B{]/);
      const lastBrace = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      }
      throw firstError;
    }
  }
}

function redactSensitiveUrl(input: string): string {
  try {
    const u = new URL(input);
    for (const key of ["apiKey", "apikey", "secretKey", "secret_key", "key", "token"]) {
      if (u.searchParams.has(key)) u.searchParams.set(key, "[redacted]");
    }
    const nested = u.searchParams.get("url");
    if (nested) u.searchParams.set("url", redactSensitiveUrl(nested));
    return u.toString();
  } catch {
    return input
      .replace(/([?&](?:apiKey|apikey|secretKey|secret_key|key|token)=)[^&]+/gi, "$1[redacted]")
      .replace(/(X-API-KEY\s*[:=]\s*)[^\s,}]+/gi, "$1[redacted]");
  }
}

function redactSensitiveText(input: string, secret?: string | null): string {
  let redacted = input
    .replace(/([?&](?:apiKey|apikey|secretKey|secret_key|key|token)=)[^&\s"'}]+/gi, "$1[redacted]")
    .replace(/(X-API-KEY\s*[:=]\s*)[^\s,}"']+/gi, "$1[redacted]");
  if (secret) redacted = redacted.split(secret).join("[redacted]");
  return redacted;
}

function buildGemiwallFetchPlan(feedUrl: string, fallbackSecret?: string | null) {
  const normalizedFeedUrl = feedUrl
    .replace(/&amp;/gi, "&")
    .replace(/^http:\/\/api\.(gemiwall|gemiad)\.com/i, "https://api.$1.com");
  let original: URL | null = null;
  try {
    original = new URL(normalizedFeedUrl);
  } catch {
    original = null;
  }

  const param = (name: string) => original?.searchParams.get(name) ?? undefined;
  const placementId = pickString(
    param("placementId"),
    param("placement_id"),
    param("placementID"),
    param("placement"),
  );
  const apiKey = pickString(
    param("apiKey"),
    param("apikey"),
    param("secretKey"),
    param("secret_key"),
    param("key"),
    fallbackSecret,
  );

  // Locked endpoint: `api.gemiwall.com` is the only responsive route. Wrap it
  // strictly through the AllOrigins raw proxy, and pass ONLY the standard
  // `placementId` and `apiKey` query params — no experimental aliases.
  const directUrls: string[] = [];
  try {
    const u = new URL("https://api.gemiwall.com/api/offers/static");
    if (placementId) u.searchParams.set("placementId", placementId);
    if (apiKey) u.searchParams.set("apiKey", apiKey);
    directUrls.push(u.toString());
  } catch {
    // ignore
  }
  // This module runs inside `createServerFn` handlers — server-to-server
  // fetches aren't subject to browser CORS, so hit Gemiwall directly and
  // skip the flaky AllOrigins proxy entirely (it 408s on this endpoint).
  const urls = [...directUrls];

  return {
    urls,
    apiKey,
    placementId,
  };
}

function looksLikeOffer(value: unknown): value is RawOffer {
  if (!value || typeof value !== "object") return false;
  const obj = value as RawOffer;
  return Boolean(
    pickString(obj.title, obj.name, obj.offer_name, obj.campaign_name) &&
    (pickString(obj.link, obj.tracking_url, obj.click_url, obj.url) ||
      pickString(
        obj.offer_id,
        obj.offerId,
        obj.offerid,
        obj.id,
        obj.campaign_id,
        obj.campaignId,
        obj.campaignID,
      )),
  );
}

function extractOffersArray(payload: unknown): RawOffer[] {
  if (Array.isArray(payload)) return payload as RawOffer[];
  if (typeof payload === "string" && payload.trim()) {
    try {
      const parsed = parsePossiblyWrappedJson(payload);
      return parsed === payload ? [] : extractOffersArray(parsed);
    } catch {
      return [];
    }
  }
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    for (const key of [
      "offers",
      "data",
      "results",
      "campaigns",
      "items",
      "response",
      "offers_list",
      "contents",
    ]) {
      const v = obj[key];
      if (Array.isArray(v)) return v as RawOffer[];
      const nested = extractOffersArray(v);
      if (nested.length) return nested;
    }
    const objectValues = Object.values(obj).filter(looksLikeOffer);
    if (objectValues.length) return objectValues;
  }
  return [];
}

// Deterministic fallback demo feed so admins can preview the import flow when
// a network's feed URL is missing or unreachable.
function demoFeed(networkName: string): RawOffer[] {
  const seeds = [
    {
      title: "MONOPOLY GO!",
      req: "Reach Album Level 12",
      payout: 4.2,
      country: "US",
      os: "Android",
    },
    { title: "Royal Match", req: "Reach Level 400", payout: 18.5, country: "US,GB,CA", os: "iOS" },
    { title: "Coin Master", req: "Reach Village 15", payout: 3.1, country: "US", os: "Android" },
    { title: "June's Journey", req: "Play 7 days", payout: 2.65, country: "US,CA", os: "iOS" },
    { title: "Match Masters", req: "Win 25 matches", payout: 1.98, country: "US", os: "Android" },
    {
      title: "Solitaire Cash",
      req: "First cash tournament",
      payout: 5.4,
      country: "US",
      os: "iOS",
    },
    { title: "Stumble Guys", req: "Reach Level 20", payout: 2.9, country: "US,GB", os: "Android" },
    { title: "Crypto Wallet Signup", req: "Verify email", payout: 0.62, country: "US", os: "Web" },
  ];
  return seeds.map((s, i) => ({
    offer_id: `${networkName.toLowerCase()}-${String(i + 1).padStart(4, "0")}`,
    title: s.title,
    description: s.req,
    payout: s.payout,
    image_url: `https://picsum.photos/seed/${encodeURIComponent(networkName + s.title)}/200`,
    target_country: s.country,
    tracking_url: `https://track.example.com/${networkName.toLowerCase()}/${i + 1}?click_id={click_id}&sub_id={user_id}`,
  }));
}

type NetworkRow = {
  id: string;
  name: string;
  offer_feed_url: string | null;
  postback_secure_key: string | null;
  is_active: boolean;
};

async function runImportForNetwork(net: NetworkRow): Promise<{
  imported: number;
  source: "feed" | "demo";
  skipped: number;
  debug: {
    attempted: Array<{ url: string; status?: number; ok?: boolean; error?: string; sample?: string }>;
    rawCount: number;
  };
}> {

  // Try to fetch the network's feed; fall back to a deterministic demo feed
  // so admins can preview the import UX before real feeds are wired up.
  let rawOffers: RawOffer[] = [];
  let source: "feed" | "demo" = "demo";
  const debug: {
    attempted: Array<{
      url: string;
      status?: number;
      ok?: boolean;
      error?: string;
      sample?: string;
    }>;
    rawCount: number;
  } = { attempted: [], rawCount: 0 };
  if (net.offer_feed_url) {
    let feedUrl = net.offer_feed_url
      .replace(/&amp;/gi, "&")
      .replace(/\{site_key\}/gi, encodeURIComponent(net.postback_secure_key ?? ""))
      .replace(/\{user_id\}|\[USER_ID\]/gi, "0");
    // CPALead's API can restrict the response when country/device filters
    // are present. Strip those import-time filters so we store the network's
    // full inventory and use each offer's own geo/device metadata later.
    if (/cpalead/i.test(net.name)) {
      try {
        const u = new URL(feedUrl);
        for (const key of ["country", "countries", "geo", "device", "devices", "os"]) {
          u.searchParams.delete(key);
        }
        feedUrl = u.toString();
      } catch {
        // leave feedUrl as-is
      }
    }
    // Upwall requires userid/country/os to be present or it errors out.
    // Inject sensible defaults for the admin-side fetch when missing.
    if (/upwall/i.test(net.name)) {
      try {
        const u = new URL(feedUrl);
        if (!u.searchParams.get("userid")) u.searchParams.set("userid", "admin_fetch");
        if (!u.searchParams.get("country")) u.searchParams.set("country", "US");
        if (!u.searchParams.get("os")) u.searchParams.set("os", "web");
        feedUrl = u.toString();
        // Upwall's API requires NO trailing slash between /api and ?query.
        // Force `/api?` (strip an accidental `/api/?`) or the server returns
        // a 404 HTML page.
        feedUrl = feedUrl.replace(/\/api\/\?/, "/api?");
      } catch {
        // leave feedUrl as-is
      }
    }
    const isCpaLead = /cpalead/i.test(net.name);
    const isUpwall = /upwall/i.test(net.name);
    const isGemiwall = /gemi(?:wall|ad)/i.test(net.name);
    const isOvnix = /ovnix/i.test(net.name);
    const isCointo = /cointo/i.test(net.name);
    const requestHeaders: Record<string, string> = {
      Accept: "application/json,text/plain,*/*",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    };
    // OVNIX requires header-based Bearer authentication — do NOT put the
    // publisher key in the query string. Read the token from the network's
    // secure key column configured in the admin panel.
    let ovnixUrl: string | null = null;
    if (isOvnix) {
      const bearerToken = net.postback_secure_key?.trim();
      if (!bearerToken) {
        throw new Error(
          "OVNIX requires a publisher API key. Set the Secure Postback Key on the OVNIX network row.",
        );
      }
      requestHeaders["Authorization"] = `Bearer ${bearerToken}`;
      try {
        const u = new URL("https://api.ovnix.io/v1/offers");
        // Preserve optional dashboard filters (country, etc.) from the
        // configured feed URL, and always enforce limit=250.
        try {
          const configured = new URL(feedUrl);
          configured.searchParams.forEach((value, key) => {
            const k = key.toLowerCase();
            if (["apikey", "api_key", "key", "token", "secret", "secret_key"].includes(k)) return;
            u.searchParams.set(key, value);
          });
        } catch {
          // feedUrl may be a placeholder — ignore parse errors
        }
        u.searchParams.set("limit", "250");
        ovnixUrl = u.toString();
      } catch {
        ovnixUrl = "https://api.ovnix.io/v1/offers?limit=250";
      }
    }
    // COINTO wants `site_key` and `site_secret` in the query string plus a
    // default `limit`. Read the credentials from the configured feed URL
    // (admin pastes `...?site_key=...&site_secret=...`) or, as a fallback,
    // from the Secure Postback Key field formatted as `site_key:site_secret`.
    let cointoPaginationError: string | null = null;
    if (isCointo) {
      let siteKey: string | undefined;
      let siteSecret: string | undefined;
      let extraParams: Array<[string, string]> = [];
      try {
        const configured = new URL(feedUrl);
        siteKey =
          configured.searchParams.get("site_key") ??
          configured.searchParams.get("siteKey") ??
          undefined;
        siteSecret =
          configured.searchParams.get("site_secret") ??
          configured.searchParams.get("siteSecret") ??
          undefined;
        configured.searchParams.forEach((value, key) => {
          const k = key.toLowerCase();
          if (["site_key", "sitekey", "site_secret", "sitesecret"].includes(k)) return;
          // Do not persist admin/import-time geo or device filters into the
          // fetch URL — COINTO returns per-offer country/device metadata, and
          // restricting here would leave valid countries out of the database.
          if (["country", "countries", "geo", "device", "devices", "os", "platform"].includes(k)) return;
          // Strip category/tier/status/payout filters so we import the FULL
          // Cointiply catalog (Apps, Games, Surveys, Fast Earnings, etc.)
          // regardless of what was configured in the feed URL.
          if ([
            "category", "categories", "type", "types", "offer_type", "offertype",
            "tier", "tiers", "status", "state",
            "min_payout", "max_payout", "minpayout", "maxpayout",
            "vertical", "verticals", "tag", "tags",
          ].includes(k)) return;
          extraParams.push([key, value]);
        });
      } catch {
        // feedUrl may be empty — fall through to key:secret fallback below
      }
      if ((!siteKey || !siteSecret) && net.postback_secure_key?.includes(":")) {
        const [k, s] = net.postback_secure_key.split(":");
        siteKey ||= k?.trim();
        siteSecret ||= s?.trim();
      }
      if (!siteKey || !siteSecret) {
        throw new Error(
          "COINTO requires site_key and site_secret. Set them as query params on the feed URL (site_key=...&site_secret=...) or as 'site_key:site_secret' in the Secure Postback Key.",
        );
      }
      // COINTO caps a single response at 500 offers but exposes 2000+.
      // Loop with limit=500 + increasing offset until an empty page or
      // a safety cap is hit. Server-to-server fetch, no CORS proxy.
      const buildCointoPageUrl = (offset: number): string => {
        const u = new URL("https://offerwall.cointo.co/api/v1/offers");
        u.searchParams.set("site_key", siteKey!);
        u.searchParams.set("site_secret", siteSecret!);
        for (const [k, v] of extraParams) {
          if (k.toLowerCase() === "limit" || k.toLowerCase() === "offset") continue;
          u.searchParams.set(k, v);
        }
        u.searchParams.set("limit", "500");
        u.searchParams.set("offset", String(offset));
        return u.toString();
      };
      const PAGE_SIZE = 500;
      const MAX_PAGES = 20; // hard safety cap → up to 10,000 offers
      const aggregated: RawOffer[] = [];
      let offset = 0;
      for (let page = 0; page < MAX_PAGES; page++) {
        const pageUrl = buildCointoPageUrl(offset);
        const attempt: (typeof debug.attempted)[number] = {
          url: redactSensitiveUrl(pageUrl),
        };
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20_000);
        try {
          const resp = await fetch(pageUrl, {
            headers: requestHeaders,
            signal: controller.signal,
          });
          attempt.status = resp.status;
          attempt.ok = resp.ok;
          if (resp.status === 429) {
            console.warn("COINTO Rate limit hit");
            cointoPaginationError =
              "COINTO Rate limit hit — the network allows only 10 fetches per hour. Please wait and try again shortly.";
            debug.attempted.push(attempt);
            break;
          }
          const text = await resp.text();
          attempt.sample = text.slice(0, 400);
          if (!resp.ok) {
            debug.attempted.push(attempt);
            cointoPaginationError = `COINTO returned HTTP ${resp.status} on page ${page + 1}`;
            break;
          }
          let json: unknown;
          try {
            json = parsePossiblyWrappedJson(text);
          } catch (e) {
            attempt.error = `invalid JSON: ${(e as Error).message}`;
            debug.attempted.push(attempt);
            cointoPaginationError = attempt.error;
            break;
          }
          if (json && typeof json === "object") {
            const jo = json as Record<string, unknown>;
            if (jo.success === false) {
              const msg = pickString(jo.message, jo.error) ?? "unknown error";
              cointoPaginationError = `COINTO API rejected the request: ${msg}`;
              attempt.error = cointoPaginationError;
              debug.attempted.push(attempt);
              break;
            }
          }
          const parsed = extractOffersArray(json);
          attempt.sample = `page=${page + 1} offset=${offset} offers=${parsed.length}`;
          debug.attempted.push(attempt);
          console.log(
            `COINTO page ${page + 1} (offset=${offset}) → ${parsed.length} offers`,
          );
          if (parsed.length === 0) break;
          for (const p of parsed) aggregated.push(normalizeCointoOffer(p));
          if (parsed.length < PAGE_SIZE) break;
          offset += PAGE_SIZE;
        } catch (error) {
          attempt.error = (error as Error).message;
          debug.attempted.push(attempt);
          cointoPaginationError = attempt.error;
          break;
        } finally {
          clearTimeout(timeoutId);
        }
      }
      console.log(`COINTO pagination complete: ${aggregated.length} total offers`);
      if (aggregated.length > 0) {
        rawOffers = aggregated;
        source = "feed";
      } else if (cointoPaginationError) {
        throw new Error(cointoPaginationError);
      }
    }
    const gemiwallPlan = isGemiwall
      ? buildGemiwallFetchPlan(feedUrl, net.postback_secure_key)
      : null;
    if (gemiwallPlan?.apiKey) requestHeaders["X-API-KEY"] = gemiwallPlan.apiKey;
    if (gemiwallPlan) {
      console.log("Gemiwall Adaptive Fetch Plan:", {
        urls: gemiwallPlan.urls.map(redactSensitiveUrl),
        hasPlacementId: Boolean(gemiwallPlan.placementId),
        hasApiKey: Boolean(gemiwallPlan.apiKey),
      });
    }
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`;
    // Server-side fetch bypasses CORS entirely. Send a browser-like UA
    // because some networks (CPALead included) block empty/default UAs.
    // For Upwall the AllOrigins proxy has been 408-timing out, so hit
    // the API directly first and only fall back to the proxy.
    // Gemiwall uses insecure HTTP + strict CORS/origin checks, so route
    // through the AllOrigins proxy first and only fall back to direct.
    const candidates =
      gemiwallPlan?.urls ??
      (isOvnix && ovnixUrl
        ? [ovnixUrl]
        : isCointo
          ? [] // COINTO handled via pagination loop above
          : [feedUrl, proxyUrl]);
    let gemiwallConnected = false;
    for (const url of candidates) {
      const attempt: (typeof debug.attempted)[number] = { url: redactSensitiveUrl(url) };
      const controller = new AbortController();
      const timeoutMs = isGemiwall ? 10_000 : 20_000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const resp = await fetch(url, {
          headers: requestHeaders,
          signal: controller.signal,
        });
        attempt.status = resp.status;
        attempt.ok = resp.ok;
        // COINTO enforces a strict 10-req/hour cap. Surface a clear error
        // to the admin instead of falling back to demo data.
        if (isCointo && resp.status === 429) {
          console.warn("COINTO Rate limit hit");
          throw new Error(
            "COINTO Rate limit hit — the network allows only 10 fetches per hour. Please wait and try again shortly.",
          );
        }
        const text = await resp.text();
        const safeText = isGemiwall ? redactSensitiveText(text, gemiwallPlan?.apiKey) : text;
        attempt.sample = safeText.slice(0, 400);
        if (isUpwall) {
          console.log("Raw Upwall Data:", text);
          console.log("Upwall fetch status:", resp.status, "url:", url);
        }
        if (isGemiwall) {
          console.log("Gemiwall Raw Response Text:", safeText);
        }
        // Strict content check: some networks return an HTML 404 page with
        // a 200 status. Do not feed HTML into JSON.parse.
        const trimmedText = text.trimStart();
        if (
          trimmedText.toLowerCase().startsWith("<!doctype html") ||
          trimmedText.toLowerCase().startsWith("<html")
        ) {
          attempt.error = "HTML response (likely 404 page)";
          debug.attempted.push(attempt);
          if (isUpwall) {
            throw new Error(
              "Upwall API returned a 404 Page. Please double check if your App ID '677d3a27216aa' is fully activated on the Upwall dashboard.",
            );
          }
          continue;
        }
        if (!resp.ok) {
          debug.attempted.push(attempt);
          continue;
        }
        let json: unknown;
        try {
          json = parsePossiblyWrappedJson(text);
        } catch (e) {
          attempt.error = `invalid JSON: ${(e as Error).message}`;
          console.error("Fetch error:", e);
          if (isGemiwall) console.log("Gemiwall Raw Error/Data:", e);
          debug.attempted.push(attempt);
          continue;
        }
        // AllOrigins sometimes wraps the payload as either
        // { contents: "<stringified json>" } or { data: { contents: "..." } }.
        // Unwrap the string before extracting offers.
        const allOriginsContents =
          json && typeof json === "object"
            ? ((json as Record<string, unknown>).contents ??
              ((json as Record<string, unknown>).data &&
              typeof (json as Record<string, unknown>).data === "object"
                ? ((json as Record<string, unknown>).data as Record<string, unknown>).contents
                : undefined))
            : undefined;
        if (typeof allOriginsContents === "string") {
          try {
            json = parsePossiblyWrappedJson(allOriginsContents);
          } catch (e) {
            console.error("Failed to parse AllOrigins contents wrapper:", e);
            if (isGemiwall) console.log("Gemiwall Raw Error/Data:", e);
          }
        }
        if (isCpaLead) console.log("CPALead Data:", json);
        if (isUpwall) console.log("Upwall Data:", json);
        if (isGemiwall) console.log("Gemiwall Data:", json);
        const parsed = extractOffersArray(json);
        const keys =
          json && typeof json === "object" ? Object.keys(json as object).join(",") : typeof json;
        attempt.sample = redactSensitiveText(
          `keys=[${keys}] offers=${parsed.length} first=${JSON.stringify(parsed[0] ?? null).slice(0, 300)}`,
          gemiwallPlan?.apiKey,
        );
        debug.attempted.push(attempt);
        if (parsed.length > 0) {
          rawOffers = isGemiwall
            ? parsed.map(normalizeGemiwallOffer)
            : isOvnix
              ? parsed.map(normalizeOvnixOffer)
              : isCointo
                ? parsed.map(normalizeCointoOffer)
                : parsed;
          source = "feed";
          break;
        }
        // COINTO returns { success: true, offers: [...] } — if success is
        // explicitly false, surface the error message instead of falling
        // back silently.
        if (isCointo && json && typeof json === "object") {
          const jo = json as Record<string, unknown>;
          if (jo.success === false) {
            const msg = pickString(jo.message, jo.error) ?? "unknown error";
            throw new Error(`COINTO API rejected the request: ${msg}`);
          }
        }
        // Gemiwall reached successfully but zero offers — treat as a
        // connected success and stop trying further candidates.
        if (isGemiwall) {
          const successFlag =
            json && typeof json === "object"
              ? (json as Record<string, unknown>).success
              : undefined;
          if (successFlag === true || Array.isArray((json as Record<string, unknown>)?.offers)) {
            gemiwallConnected = true;
            source = "feed";
            console.log("Gemiwall connected successfully: 0 active offers available for this zone.");
            break;
          }
        }
      } catch (error) {
        if (isGemiwall) console.log("Gemiwall Raw Error/Data:", error);
        attempt.error = (error as Error).message;
        debug.attempted.push(attempt);
      } finally {
        clearTimeout(timeoutId);
      }
    }
    if (isGemiwall && gemiwallConnected && rawOffers.length === 0) {
      // Purge any stale offers stored under this network so the count in
      // the admin panel reflects the live zero-offer state.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("offers").delete().eq("network_id", net.id);
      return { imported: 0, source: "feed" as const, skipped: 0, debug };
    }
  }
  if (rawOffers.length === 0 && /upwall/i.test(net.name)) {
    // Demo fallback disabled for Upwall — surface the real error so we can
    // inspect the exact HTTP status and response body from the attempts.
    throw new Error(
      `Upwall live fetch failed. Attempts: ${JSON.stringify(debug.attempted, null, 2)}`,
    );
  }
  if (rawOffers.length === 0 && /gemi(?:wall|ad)/i.test(net.name)) {
    // Never fall back to CPALead-style demo offers for Gemiwall — surface
    // the real failure so the isolated Gemiwall handler can log it.
    throw new Error(
      `Gemiwall Fetch Failed. Attempts: ${JSON.stringify(debug.attempted, null, 2)}`,
    );
  }
  if (rawOffers.length === 0 && /cointo/i.test(net.name)) {
    // Do not fall back to demo offers for COINTO — surface the real error
    // (auth failure, rate limit, etc.) so the admin can react.
    throw new Error(
      `COINTO Fetch Failed. Attempts: ${JSON.stringify(debug.attempted, null, 2)}`,
    );
  }
  if (rawOffers.length === 0) {
    rawOffers = demoFeed(net.name);
    source = "demo";
  }
  debug.rawCount = rawOffers.length;

  const rows = rawOffers
    .map((o) => {
      const offer_id = pickString(
        o.offer_id,
        o.offerId,
        o.offerid,
        o.id,
        o.campaign_id,
        o.campaignId,
        o.campaignID,
      );
      const title = pickString(o.title, o.name, o.offer_name, o.campaign_name);
      const tracking_url = pickString(
        o.tracking_url,
        o.tracking_link,
        o.link,
        o.click_url,
        o.clickUrl,
        o.offer_url,
        o.url,
        o.preview_url,
      );
      if (!offer_id || !title || !tracking_url) return null;
      const grossPayout = pickNumber(o.payout, o.amount, o.reward, o.price) ?? 0;
      return {
        network_id: net.id,
        network_name: net.name,
        offer_id,
        title,
        description:
          pickString(
            o.description,
            o.desc,
            o.short_description,
            o.conversion,
            o.requirements,
            o.instructions,
          ) ?? null,
        payout: grossPayout,
        image_url: pickString(o.image_url, o.image, o.icon, pickCreativeUrl(o.creatives)) ?? null,
        target_country: normalizeCountry(o.target_country ?? o.country ?? o.countries) ?? null,
        target_device:
          normalizeDevice(o.device ?? o.devices ?? o.os ?? o.operating_system ?? o.platform) ??
          null,
        tracking_url,
        is_active: true,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) {
    return { imported: 0, source, skipped: rawOffers.length, debug };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Clear previously stored demo/stale offers for this network so a
  // successful live import replaces the demo inventory with real data.
  // IMPORTANT: preserve manually-added offers (offer_id prefixed `manual_`)
  // so admin-created offers are never wiped by the auto-sync.
  if (source === "feed") {
    await supabaseAdmin
      .from("offers")
      .delete()
      .eq("network_id", net.id)
      .not("offer_id", "ilike", "manual_%");
  }
  const { error: upErr, count } = await supabaseAdmin
    .from("offers")
    .upsert(rows, { onConflict: "network_name,offer_id", count: "exact" });
  if (upErr) throw new Error(upErr.message);

  // Update the cache timestamp so subsequent wall loads skip re-hitting
  // the network's API for the next hour.
  await supabaseAdmin
    .from("ad_networks")
    .update({ last_synced_at: new Date().toISOString(), last_sync_error: null })
    .eq("id", net.id);

  return {
    imported: count ?? rows.length,
    skipped: rawOffers.length - rows.length,
    source,
    debug,
  };
}

export const importNetworkOffers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { networkId: string }) => {
    if (!input?.networkId) throw new Error("networkId required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: net, error: netErr } = await supabase
      .from("ad_networks")
      .select("id, name, offer_feed_url, postback_secure_key, is_active")
      .eq("id", data.networkId)
      .maybeSingle();
    if (netErr) throw new Error(netErr.message);
    if (!net) throw new Error("Network not found");

    return runImportForNetwork(net as NetworkRow);
  });

// Public cache-refresh endpoint used by the offerwall on load. If the
// Cointiply catalog was refreshed within the past hour, this is a no-op
// (serves from the cached `offers` table). Otherwise it re-fetches the
// full catalog from Cointiply and overwrites the cache. This is the only
// path that hits the live Cointiply API, which enforces a 10 req/hour cap.
export const ensureCointoOffersFresh = createServerFn({ method: "GET" }).handler(
  async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ONE_HOUR_MS = 60 * 60 * 1000;

    const { data: net, error: netErr } = await supabaseAdmin
      .from("ad_networks")
      .select("id, name, offer_feed_url, postback_secure_key, is_active, last_synced_at, last_sync_error")
      .ilike("name", "%cointo%")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (netErr) {
      console.warn("[cointo-cache] Serving from Cache (network lookup error):", netErr.message);
      return { cached: true, refreshed: false, error: netErr.message };
    }
    if (!net) {
      console.log("[cointo-cache] Serving from Cache (no active cointo network configured)");
      return { cached: true, refreshed: false, reason: "no active cointo network" };
    }

    const lastMs = net.last_synced_at ? new Date(net.last_synced_at).getTime() : 0;
    const ageMs = Date.now() - lastMs;
    if (lastMs && ageMs < ONE_HOUR_MS) {
      console.log(
        `[cointo-cache] Serving from Cache — cache is ${Math.round(ageMs / 60000)} min old (TTL 60 min).`,
      );
      return {
        cached: true,
        refreshed: false,
        ageMinutes: Math.round(ageMs / 60000),
        lastSyncedAt: net.last_synced_at,
      };
    }

    // Optimistic backoff lock: stamp `last_synced_at` BEFORE hitting the API.
    // If the fetch fails (rate-limit, network error, invalid payload), the
    // stamp stays and every visitor for the next hour serves the previously
    // cached rows from the `offers` table instead of retrying the API.
    // This is what prevents the 10-req/hour cap from being burned through.
    const attemptStartedAt = new Date().toISOString();
    await supabaseAdmin
      .from("ad_networks")
      .update({ last_synced_at: attemptStartedAt })
      .eq("id", net.id);

    console.log(
      `[cointo-cache] Fetching from API… (cache was ${lastMs ? Math.round(ageMs / 60000) + " min old" : "empty"})`,
    );

    try {
      const result = await runImportForNetwork(net as NetworkRow);
      console.log(
        `[cointo-cache] Fetch OK — imported ${result.imported} offers (source=${result.source}). Next refresh in 60 min.`,
      );
      return {
        cached: false,
        refreshed: true,
        imported: result.imported,
        source: result.source,
      };
    } catch (e) {
      const msg = (e as Error).message ?? "unknown error";
      // IMPORTANT: never rethrow. The wall reads from the cached `offers`
      // table regardless — a failed refresh just means we keep serving the
      // last successful catalog for the next hour. This is the emergency
      // rate-limit bypass: users never see "Rate limit hit".
      console.warn(
        `[cointo-cache] Fetch FAILED — serving stale cache for the next 60 min. Reason: ${msg}`,
      );
      await supabaseAdmin
        .from("ad_networks")
        .update({ last_sync_error: msg })
        .eq("id", net.id);
      return {
        cached: false,
        refreshed: false,
        error: msg,
        lastSyncedAt: net.last_synced_at,
      };
    }
  },
);
