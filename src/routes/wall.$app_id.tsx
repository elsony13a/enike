import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWallHistory, logOfferClick } from "@/lib/wall.functions";
import { ensureCointoOffersFresh } from "@/lib/offers.functions";
import { detectCountry } from "@/lib/geo.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Zap,
  Coins,
  LifeBuoy,
  AlertTriangle,
  Smartphone,
  Apple,
  Globe,
  Loader2,
  Search,
  History as HistoryIcon,
  LayoutGrid,
  CheckCircle2,
  Clock,
  TrendingUp,
  ExternalLink,
  ListChecks,
} from "lucide-react";

const COMMON_COUNTRIES: { code: string; name: string }[] = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "AR", name: "Argentina" },
  { code: "EG", name: "Egypt" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "IN", name: "India" },
  { code: "PK", name: "Pakistan" },
  { code: "ID", name: "Indonesia" },
  { code: "PH", name: "Philippines" },
  { code: "TR", name: "Turkey" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "NG", name: "Nigeria" },
  { code: "ZA", name: "South Africa" },
];

const COUNTRY_NAME_TO_CODE: Record<string, string> = (() => {
  const aliases: Record<string, string> = {
    "america": "US",
    "czech republic": "CZ",
    "palestinian territory": "PS",
    "republic of korea": "KR",
    "republic of south korea": "KR",
    "russia": "RU",
    "south korea": "KR",
    "taiwan": "TW",
    "the netherlands": "NL",
    "turkey": "TR",
    "uk": "GB",
    "united kingdom": "GB",
    "united states": "US",
    "united states of america": "US",
    "usa": "US",
    "vietnam": "VN",
  };
  try {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    for (let a = 65; a <= 90; a++) {
      for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a, b);
        const name = names.of(code);
        if (name && name !== code) {
          aliases[name.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, " ").trim()] = code;
        }
      }
    }
  } catch {
    // Keep aliases only.
  }
  return aliases;
})();

const GLOBAL_COUNTRY_TOKENS = new Set(["ALL", "GLOBAL", "WW", "WORLDWIDE", "ANY", "INTL", "INTERNATIONAL", "*"]);

function normalizeCountryToken(token: string): string | undefined {
  const compact = token.trim().replace(/["'\[\]]/g, "");
  if (!compact) return undefined;
  const upper = compact.toUpperCase();
  if (GLOBAL_COUNTRY_TOKENS.has(upper)) return "ALL";
  if (upper === "UK") return "GB";
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  return COUNTRY_NAME_TO_CODE[compact.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, " ").trim()];
}

function parseCountryTargets(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(parseCountryTargets);
  const raw = String(value).trim();
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parseCountryTargets(parsed);
    } catch {
      // Use loose parsing below.
    }
  }
  const cleaned = raw.replace(/["'\[\]]/g, " ").trim();
  const tokens = /[;,|]/.test(cleaned)
    ? cleaned.split(/[;,|]+/)
    : /^(?:[A-Za-z]{2,3}\s+)+[A-Za-z]{2,3}$/.test(cleaned)
      ? cleaned.split(/\s+/)
      : [cleaned];
  return [...new Set(tokens.map(normalizeCountryToken).filter((c): c is string => Boolean(c)))];
}

export const Route = createFileRoute("/wall/$app_id")({
  head: () => ({
    meta: [
      { title: "Rewards Wall — Offerdeck" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WallPage,
});

type OSTag = "android" | "ios" | "web";
type Tab = "offers" | "history";
type DeviceTarget = OSTag | "all";

const TABS: { id: Tab; label: string; Icon: typeof LayoutGrid }[] = [
  { id: "offers", label: "All Offers", Icon: LayoutGrid },
  { id: "history", label: "History", Icon: HistoryIcon },
];

function detectDeviceOS(): OSTag {
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return "android";
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  return "web";
}

function normalizeOs(device: string | null | undefined): OSTag {
  const d = (device ?? "").toLowerCase();
  if (d.includes("android")) return "android";
  if (d.includes("ios") || d.includes("iphone") || d.includes("ipad")) return "ios";
  return "web";
}

function parseDeviceTargets(device: string | null | undefined): DeviceTarget[] {
  const raw = (device ?? "").trim().toLowerCase();
  if (!raw) return ["all"];
  const parts = raw.split(/[;,|/\s]+/).filter(Boolean);
  if (parts.some((p) => ["all", "any", "all_devices", "alldevices", "all-devices"].includes(p))) {
    return ["all"];
  }
  const targets = new Set<DeviceTarget>();
  for (const part of parts) {
    if (part.includes("android")) targets.add("android");
    else if (["ios", "iphone", "ipad"].some((t) => part.includes(t))) targets.add("ios");
    else if (["web", "pc", "desktop", "windows", "mac", "macos"].some((t) => part.includes(t))) targets.add("web");
  }
  return targets.size ? [...targets] : ["all"];
}

function osBadge(os: OSTag) {
  const map = {
    android: { label: "Android", Icon: Smartphone, cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" },
    ios: { label: "iOS", Icon: Apple, cls: "bg-zinc-500/15 text-zinc-200 ring-zinc-400/30" },
    web: { label: "Web", Icon: Globe, cls: "bg-sky-500/15 text-sky-300 ring-sky-500/30" },
  } as const;
  return map[os];
}

const ACCENTS = [
  "from-rose-500 to-orange-500",
  "from-amber-400 to-red-500",
  "from-yellow-400 to-amber-600",
  "from-emerald-400 to-teal-600",
  "from-violet-500 to-fuchsia-500",
  "from-sky-500 to-indigo-500",
  "from-cyan-400 to-blue-600",
  "from-pink-500 to-rose-500",
  "from-lime-400 to-emerald-500",
  "from-fuchsia-500 to-indigo-600",
];

function pickAccent(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

function extractTasks(
  description: string | null | undefined,
  ppd: number,
  marginPct: number,
): { name: string; points: number; description?: string }[] {
  if (!description) return [];
  const raw = String(description).trim();
  // Try to find embedded JSON with a `tasks`/`goals`/`events` array.
  const candidates: unknown[] = [];
  try {
    candidates.push(JSON.parse(raw));
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        candidates.push(JSON.parse(m[0]));
      } catch {
        /* ignore */
      }
    }
  }
  const toPoints = (payoutUsd: number) =>
    Math.max(0, Math.round(payoutUsd * (1 - marginPct / 100) * ppd));
  for (const c of candidates) {
    const arr =
      (c as any)?.tasks ??
      (c as any)?.goals ??
      (c as any)?.events ??
      (c as any)?.steps ??
      null;
    if (Array.isArray(arr) && arr.length > 0) {
      const out: { name: string; points: number; description?: string }[] = [];
      for (const t of arr) {
          const name = String(t?.name ?? t?.title ?? t?.event ?? t?.goal ?? "").trim();
          if (!name) continue;
          const payout = Number(t?.payout ?? t?.reward ?? t?.amount ?? 0);
          const explicitPts = Number(t?.points ?? t?.pts ?? 0);
          const points = explicitPts > 0 ? Math.round(explicitPts) : toPoints(payout);
          const desc = typeof t?.description === "string" ? t.description : undefined;
          out.push({ name, points, description: desc });
      }
      return out;
    }
  }
  return [];
}

type OfferRow = {
  id: string;
  network_name: string;
  offer_id: string | null;
  title: string;
  description: string | null;
  payout: number | null;
  image_url: string | null;
  target_country: string | null;
  target_device: string | null;
  tracking_url: string;
};

type OfferTask = { name: string; points: number; description?: string };

type EnrichedOffer = OfferRow & {
  os: OSTag;
  deviceTargets: DeviceTarget[];
  points: number;
  accent: string;
  tasks: OfferTask[];
};

function WallPage() {
  const { app_id } = Route.useParams();
  const [tab, setTab] = useState<Tab>("offers");
  const [search, setSearch] = useState("");
  const [userOS] = useState<OSTag>(() => detectDeviceOS());
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [countryOverride, setCountryOverride] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(true);
  const [activeOffer, setActiveOffer] = useState<EnrichedOffer | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authLoadingState, setAuthLoadingState] = useState(true);
  const [urlUserId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = new URLSearchParams(window.location.search).get("userId");
      const trimmed = raw?.trim();
      return trimmed ? trimmed : null;
    } catch {
      return null;
    }
  });
  const effectiveUserId = urlUserId ?? authUserId;
  const authLoading = urlUserId ? false : authLoadingState;

  const detectCountryFn = useServerFn(detectCountry);
  const logClickFn = useServerFn(logOfferClick);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setAuthUserId(data.user?.id ?? null);
      setAuthLoadingState(false);
    }).catch(() => {
      if (cancelled) return;
      setAuthUserId(null);
      setAuthLoadingState(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUserId(session?.user?.id ?? null);
      setAuthLoadingState(false);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function resolve(): Promise<string | null> {
      // 1) Server-side edge headers (Cloudflare cf-ipcountry, etc.)
      try {
        const r = await detectCountryFn();
        if (r?.country) return r.country;
      } catch { /* ignore */ }
      // 2) Client-side IP APIs (try several — free tiers rate-limit or fail)
      const providers: Array<() => Promise<string | null>> = [
        async () => {
          const r = await fetch("https://ipapi.co/json/");
          if (!r.ok) return null;
          const j = await r.json();
          return typeof j?.country_code === "string" ? j.country_code : null;
        },
        async () => {
          const r = await fetch("https://ipwho.is/");
          if (!r.ok) return null;
          const j = await r.json();
          return typeof j?.country_code === "string" ? j.country_code : null;
        },
        async () => {
          const r = await fetch("https://get.geojs.io/v1/ip/country.json");
          if (!r.ok) return null;
          const j = await r.json();
          return typeof j?.country === "string" ? j.country : null;
        },
      ];
      for (const p of providers) {
        try {
          const cc = await p();
          if (cc && /^[A-Za-z]{2}$/.test(cc)) return cc.toUpperCase();
        } catch { /* try next */ }
      }
      return null;
    }
    resolve().then((cc) => {
      if (cancelled) return;
      setDetectedCountry(cc);
      setGeoLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [detectCountryFn]);

  const userCountry = countryOverride ?? detectedCountry;

  const { data: placement } = useQuery({
    queryKey: ["wall-placement", app_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("placements")
        .select("id, name, site_url, app_id")
        .eq("app_id", app_id)
        .maybeSingle();
      return data;
    },
  });

  const { data: networks } = useQuery({
    queryKey: ["wall-networks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_networks")
        .select("name, points_per_dollar, profit_margin_pct, is_active")
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: offers, isLoading } = useQuery({
    queryKey: ["wall-offers"],
    queryFn: async () => {
      // Refresh the Cointiply catalog from cache first. This is a no-op when
      // the cache is <1h old; otherwise it re-fetches the full catalog from
      // Cointiply and overwrites the `offers` table before we read from it.
      try {
        await ensureCointoOffersFresh();
      } catch (e) {
        console.warn("[wall] ensureCointoOffersFresh failed (serving stale cache):", e);
      }
      const pageSize = 1000;
      const allOffers: Array<{
        id: string;
        network_name: string;
        offer_id: string | null;
        title: string;
        description: string | null;
        payout: number | null;
        image_url: string | null;
        target_country: string | null;
        target_device: string | null;
        tracking_url: string;
      }> = [];

      for (let page = 0; page < 8; page++) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from("offers")
          .select("id, network_name, offer_id, title, description, payout, image_url, target_country, target_device, tracking_url")
          .eq("is_active", true)
          .order("payout", { ascending: false })
          .range(from, to);

        if (error) throw error;
        const rows = data ?? [];
        allOffers.push(...rows);
        if (rows.length < pageSize) break;
      }

      return allOffers;
    },
  });

  const historyFn = useServerFn(getWallHistory);
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["wall-history", app_id, effectiveUserId],
    queryFn: () => historyFn({ data: { app_id, user_id: effectiveUserId! } }),
    enabled: tab === "history" && Boolean(effectiveUserId),
    refetchOnWindowFocus: false,
  });

  const netMap = useMemo(() => {
    const m = new Map<string, { ppd: number; margin: number }>();
    for (const n of networks ?? []) {
      m.set(n.name, {
        ppd: Number(n.points_per_dollar ?? 1000),
        margin: Number(n.profit_margin_pct ?? 0),
      });
    }
    return m;
  }, [networks]);

  const enriched = useMemo(() => {
    return (offers ?? []).map((o) => {
      const net = netMap.get(o.network_name) ?? { ppd: 1000, margin: 0 };
      const payoutUsd = Number(o.payout ?? 0);
      const net_payout = payoutUsd * (1 - net.margin / 100);
      const points = Math.max(0, Math.round(net_payout * net.ppd));
      const os = normalizeOs(o.target_device);
      const deviceTargets = parseDeviceTargets(o.target_device);
      const tasks = extractTasks(o.description, net.ppd, net.margin);
      return { ...o, os, deviceTargets, points, accent: pickAccent(o.id), tasks } as EnrichedOffer;
    });
  }, [offers, netMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const userCC = (userCountry ?? "").trim().toUpperCase();

    return enriched.filter((o) => {
      // Device: support array-like network values such as Android,iOS and all_devices.
      if (!o.deviceTargets.includes("all") && !o.deviceTargets.includes(userOS)) return false;

      const targets = parseCountryTargets(o.target_country);
      const isGlobal =
        targets.length === 0 || targets.some((t) => GLOBAL_COUNTRY_TOKENS.has(t));

      if (!isGlobal) {
        if (!userCC) {
          console.log("[geo] hiding offer while country resolves", {
            network: o.network_name,
            title: o.title,
            targets,
          });
          return false;
        }
        if (!targets.includes(userCC)) {
          if (
            /cointo|cpalead|cpa[\s_-]*lead/i.test(o.network_name ?? "")
          ) {
            console.log("[geo] filtered out", {
              network: o.network_name,
              title: o.title,
              userCountry: userCC,
              targets,
              raw: o.target_country,
            });
          }
          return false;
        }
      }

      if (q && !o.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [enriched, search, userOS, userCountry]);

  const hasUser = Boolean(effectiveUserId);

  const buildTrackingUrl = (offer: EnrichedOffer, activeUserId: string, clickId?: string) => {
    const encodedUserId = encodeURIComponent(activeUserId);

    // OVNIX uses a modern tokenized redirect URL. Do not use the imported
    // tracking_url because older rows may contain deprecated path structures.
    if (/ovnix/i.test(offer.network_name)) {
      const tokenPayload = {
        pk: "E9E9D7C26094357D1184",
        oi: Number(offer.offer_id),
        on: offer.title,
        og: offer.image_url || "",
        or: (Number(offer.payout ?? 0) * 2000).toString(),
        cu: "points",
      };
      const base64Token = btoa(unescape(encodeURIComponent(JSON.stringify(tokenPayload))));
      return `https://offerwall.ovnix.io/redirect.html?sub1=${encodedUserId}&token=${encodeURIComponent(
        base64Token,
      )}`.trim();
    }

    let url = offer.tracking_url
      .replace(/\[?\{?USER_ID\}?\]?/gi, encodedUserId)
      .replace(/\[?\{?SUB_?ID\}?\]?/gi, encodedUserId)
      .replace(/\{sub1\}/gi, encodedUserId)
      .replace(/\[sub1\]/gi, encodedUserId)
      .replace(/\{subid1\}/gi, encodedUserId)
      .replace(/\{aff_sub\d*\}/gi, encodedUserId)
      .replace(/\[?\{?APP_ID\}?\]?/gi, encodeURIComponent(app_id));
    if (clickId) {
      url += (url.includes("?") ? "&" : "?") + "click_id=" + encodeURIComponent(clickId);
    }
    return url;
  };

  const handleStartOffer = async (offer: EnrichedOffer) => {
    if (!/^https?:\/\//i.test(offer.tracking_url)) {
      alert("Invalid tracking URL for this offer.");
      return;
    }

    // Open a blank tab immediately from the click gesture, but do not redirect
    // it until Supabase confirms the real authenticated user UUID.
    const tab = window.open("about:blank", "_blank", "noopener,noreferrer");

    let activeUserId: string | null = urlUserId;
    if (!activeUserId) {
      const { data, error } = await supabase.auth.getUser();
      activeUserId = data.user?.id ?? null;
      if (error || !activeUserId) {
        tab?.close();
        alert("Please login to complete offers");
        return;
      }
      setAuthUserId(activeUserId);
    }

    setStarting(true);
    let clickId: string | undefined;
    try {
      const res = await logClickFn({
        data: {
          app_id,
          user_id: activeUserId,
          offer_id: offer.offer_id ?? offer.id,
          offer_name: offer.title,
          network_name: offer.network_name,
          payout_usd: Number(offer.payout ?? 0),
          points_payout: offer.points,
          country: offer.target_country ?? undefined,
        },
      });
      clickId = res?.click_id;
    } catch (e) {
      console.error("[wall] failed to log click", e);
      // Surface the failure so the History tab situation isn't silent.
      try {
        alert(
          "Couldn't record this click yet. Your history may not update — please tell support if this persists.",
        );
      } catch {}
    } finally {
      setStarting(false);
    }
    const url = buildTrackingUrl(offer, activeUserId, clickId);
    if (tab && !tab.closed) {
      try {
        tab.opener = null;
      } catch {}
      tab.location.href = url;
    } else {
      // Popup blocked — force a new tab via a synthetic anchor click.
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    }
    setActiveOffer(null);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_20%_-10%,oklch(0.35_0.12_285/0.35),transparent),radial-gradient(900px_500px_at_100%_10%,oklch(0.4_0.15_200/0.25),transparent)] bg-background text-foreground">
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30">
              <Zap className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-tight">
                {placement?.name ?? "Rewards Wall"}
              </div>
              <div className="truncate text-[11px] uppercase tracking-widest text-muted-foreground">
                {authLoading ? "Checking session…" : hasUser ? `User · ${effectiveUserId}` : "Login required"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full bg-gradient-to-r from-amber-500/15 to-yellow-400/10 px-3 py-1.5 ring-1 ring-amber-400/30 sm:flex">
              <Coins className="h-4 w-4 text-amber-300" />
              <span className="text-sm font-semibold text-amber-100">0 Pts</span>
            </div>
            <Button size="sm" variant="ghost" className="rounded-full">
              <LifeBuoy className="mr-1.5 h-4 w-4" /> Support
            </Button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-6xl px-4 pb-3 sm:px-6">
          <div className="flex gap-2 overflow-x-auto">
            {TABS.map((t) => {
              const active = t.id === tab;
              const Icon = t.Icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`group inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all ${
                    active
                      ? "border-transparent bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/25"
                      : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {!authLoading && !hasUser && (
        <div className="mx-auto mt-4 w-full max-w-6xl px-4 sm:px-6">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="text-sm">
              <div className="font-semibold">Login required</div>
              <div className="mt-0.5 text-amber-100/80">
                Please login to complete offers and receive rewards.
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {tab === "history" ? (
          <HistoryView
            loading={historyLoading}
            hasUser={hasUser}
            data={history}
          />
        ) : isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading live offers…
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search offers by name…"
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>
                  Device: <span className="font-semibold uppercase text-foreground">{userOS}</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <span>Region:</span>
                  <Select
                    value={userCountry ?? "auto"}
                    onValueChange={(v) => setCountryOverride(v === "auto" ? null : v)}
                  >
                    <SelectTrigger className="h-7 w-[150px] text-xs">
                      <SelectValue placeholder={geoLoading ? "Detecting…" : "Select country"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">
                        Auto {detectedCountry ? `(${detectedCountry})` : geoLoading ? "(detecting…)" : "(unknown)"}
                      </SelectItem>
                      {COMMON_COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.code} — {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <span>
                  <span className="font-semibold text-foreground">{filtered.length}</span> offers
                </span>
              </div>
            </div>
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-border/60 bg-card/40 p-10 text-center text-muted-foreground">
                No offers match your device, region, or search.
              </div>
            ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((offer) => {
                const badge = osBadge(offer.os);
                const OsIcon = badge.Icon;
                return (
                  <div
                    key={offer.id}
                    className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10"
                  >
                    <div className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br ${offer.accent} opacity-20 blur-2xl`} />
                    <div className="flex items-start gap-3">
                      <div className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${offer.accent} text-2xl shadow-lg`}>
                        {offer.image_url ? (
                          <img src={offer.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <span>🎁</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-semibold">{offer.title}</h3>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {offer.description || "Complete the required action to earn your reward."}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${badge.cls}`}>
                            <OsIcon className="h-3 w-3" /> {badge.label}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border/60">
                            {offer.network_name}
                          </span>
                          {offer.target_country && (
                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary ring-1 ring-primary/30">
                              {offer.target_country}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveOffer(offer)}
                      className={`relative mt-4 flex w-full items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-r ${offer.accent} px-4 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99]`}
                    >
                      <Coins className="h-4 w-4" />
                      <span>+{offer.points.toLocaleString()} Pts</span>
                    </button>
                  </div>
                );
              })}
            </div>
            )}
          </>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Powered by Offerdeck · Rewards paid via server-to-server postbacks
        </p>
      </div>

      <OfferDetailModal
        offer={activeOffer}
        onClose={() => setActiveOffer(null)}
        onStart={handleStartOffer}
        osBadge={osBadge}
        hasUser={hasUser}
        authLoading={authLoading}
        starting={starting}
      />
    </div>
  );
}

function OfferDetailModal({
  offer,
  onClose,
  onStart,
  osBadge,
  hasUser,
  authLoading,
  starting,
}: {
  offer: EnrichedOffer | null;
  onClose: () => void;
  onStart: (offer: EnrichedOffer) => Promise<void>;
  osBadge: (os: OSTag) => { label: string; Icon: typeof LayoutGrid; cls: string };
  hasUser: boolean;
  authLoading: boolean;
  starting: boolean;
}) {
  const open = offer !== null;
  const badge = offer ? osBadge(offer.os) : null;
  const OsIcon = badge?.Icon;
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg overflow-hidden border-border/60 bg-card/95 p-0 backdrop-blur">
        {offer && (
          <>
            <div className={`relative h-28 bg-gradient-to-br ${offer.accent}`}>
              <div className="absolute inset-0 bg-[radial-gradient(600px_120px_at_10%_120%,rgba(0,0,0,0.4),transparent)]" />
              <div className="absolute -bottom-8 left-5 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-card bg-card shadow-2xl">
                {offer.image_url ? (
                  <img src={offer.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl">🎁</span>
                )}
              </div>
            </div>
            <div className="px-6 pb-6 pt-10">
              <DialogHeader className="text-left">
                <DialogTitle className="pr-6 text-xl font-bold leading-tight">
                  {offer.title}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Offer details and requirements for {offer.title}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {badge && OsIcon && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${badge.cls}`}>
                    <OsIcon className="h-3 w-3" /> {badge.label}
                  </span>
                )}
                <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border/60">
                  {offer.network_name}
                </span>
                {offer.target_country && (
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary ring-1 ring-primary/30">
                    {offer.target_country}
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-yellow-400/5 px-4 py-3">
                <div className="text-xs uppercase tracking-widest text-amber-200/80">
                  Total reward
                </div>
                <div className="flex items-center gap-1.5 text-amber-100">
                  <Coins className="h-5 w-5 text-amber-300" />
                  <span className="text-xl font-extrabold tabular-nums">
                    +{offer.points.toLocaleString()} Pts
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Requirements
                </h4>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                  {offer.description?.trim()
                    ? offer.description
                    : "Complete the required action for this offer to earn your reward. Follow the on-screen instructions after starting the offer."}
                </p>
              </div>

              {offer.tasks.length > 0 && (
                <div className="mt-4">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    <ListChecks className="h-3.5 w-3.5" /> Tasks · earn as you go
                  </h4>
                  <ul className="mt-2 space-y-2">
                    {offer.tasks.map((t, i) => (
                      <li
                        key={`${t.name}-${i}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary ring-1 ring-primary/30">
                            {i + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{t.name}</div>
                            {t.description && (
                              <div className="truncate text-xs text-muted-foreground">
                                {t.description}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30 tabular-nums">
                          +{t.points.toLocaleString()} Pts
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <DialogFooter className="mt-6 flex-col gap-2 sm:flex-col">
                <button
                  onClick={() => onStart(offer)}
                  disabled={authLoading || starting}
                  className={`relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r ${offer.accent} px-4 py-3.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {starting || authLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                  <span>
                    {authLoading
                      ? "Checking login…"
                      : !hasUser
                        ? "Login to start"
                        : starting
                        ? "Preparing your offer…"
                        : "Start Offer · Earn Points"}
                  </span>
                </button>
                <p className="text-center text-[11px] text-muted-foreground">
                  Opens in a new tab · Rewards are credited via secure server-to-server postback.
                </p>
              </DialogFooter>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HistoryView({
  loading,
  hasUser,
  data,
}: {
  loading: boolean;
  hasUser: boolean;
  data: Awaited<ReturnType<typeof getWallHistory>> | undefined;
}) {
  if (!hasUser) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/40 p-10 text-center text-muted-foreground">
        Please login to view history.
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading history…
      </div>
    );
  }
  const stats = data?.stats ?? { clicks: 0, completed: 0, pending: 0, earnings: 0 };
  const rows = data?.rows ?? [];
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Activity" value={stats.clicks} Icon={LayoutGrid} tint="from-sky-500 to-indigo-500" />
        <StatCard label="Completed" value={stats.completed} Icon={CheckCircle2} tint="from-emerald-400 to-teal-600" />
        <StatCard label="Pending" value={stats.pending} Icon={Clock} tint="from-amber-400 to-orange-500" />
        <StatCard label="Total Earnings" value={`${stats.earnings.toLocaleString()} Pts`} Icon={TrendingUp} tint="from-fuchsia-500 to-rose-500" />
      </div>
      <div className="mt-6 overflow-hidden rounded-2xl border border-border/60 bg-card/40 backdrop-blur">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Offer</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Earnings</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const credited = r.status === "success" || r.status === "credited" || r.status === "completed";
              const pending = r.status === "pending";
              return (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.offer_name}</div>
                    <div className="text-xs text-muted-foreground">{r.network_name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary ring-1 ring-primary/30">
                      Conversion
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                        credited
                          ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                          : pending
                            ? "bg-amber-500/15 text-amber-200 ring-amber-500/30"
                            : "bg-muted text-muted-foreground ring-border/60"
                      }`}
                    >
                      {credited ? "Credited" : pending ? "Pending" : r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    +{r.points.toLocaleString()} Pts
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No history yet. Complete an offer to see it here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  Icon,
  tint,
}: {
  label: string;
  value: string | number;
  Icon: typeof LayoutGrid;
  tint: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur">
      <div className={`pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-gradient-to-br ${tint} opacity-20 blur-2xl`} />
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
