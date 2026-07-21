import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

// Detect visitor country from edge/proxy headers. Works on Cloudflare
// (cf-ipcountry) and most CDNs (x-vercel-ip-country, x-country-code, etc.).
export const detectCountry = createServerFn({ method: "GET" }).handler(async () => {
  let get: (name: string) => string | undefined = () => undefined;
  try {
    const h = getRequestHeaders() as unknown as Record<string, string | undefined>;
    get = (name: string) => h[name] ?? h[name.toLowerCase()];
  } catch {
    // no request context (dev/prerender)
  }
  const candidates = [
    "cf-ipcountry",
    "x-vercel-ip-country",
    "x-country-code",
    "x-geo-country",
    "x-appengine-country",
  ];
  for (const key of candidates) {
    const v = get(key);
    if (typeof v === "string" && /^[A-Za-z]{2}$/.test(v) && v.toUpperCase() !== "XX") {
      return { country: v.toUpperCase() };
    }
  }
  return { country: null as string | null };
});