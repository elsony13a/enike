import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, TrendingUp, Shield, Code2, Globe, BarChart3 } from "lucide-react";
import { GetAppIdButton } from "@/components/get-app-id-button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="relative overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-x-0 -top-40 h-[600px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-accent/10 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,oklch(0.28_0.02_260/0.3)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.28_0.02_260/0.3)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />

      {/* HERO */}
      <section className="relative mx-auto max-w-7xl px-6 pt-24 pb-32 md:pt-32">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/50 px-3 py-1 text-xs backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary"></span>
            </span>
            <span className="text-muted-foreground">Live postbacks · 12+ ad networks</span>
          </div>

          <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-7xl">
            Monetize any app with the
            <span className="mt-2 block bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              highest-converting offerwall
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Drop a single iframe into your site or app. Get instant access to premium offer inventory from CPALead, Cointo, Upwall and more — with real-time postbacks and zero setup friction.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link to="/auth" search={{ mode: "register" }}>
              <Button size="lg" className="bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-xl shadow-primary/30 hover:opacity-90">
                Create publisher account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href="#integrate">
              <Button size="lg" variant="outline">
                See the iframe
              </Button>
            </a>
          </div>

          <div className="mt-16 grid grid-cols-3 gap-4 md:gap-8">
            {[
              { k: "eCPM", v: "$42.80", d: "US Tier-1 avg." },
              { k: "Conversion", v: "9.4%", d: "Across all offers" },
              { k: "Payout", v: "24h", d: "Net-terms available" },
            ].map((s) => (
              <div key={s.k} className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur">
                <div className="text-3xl font-bold tracking-tight">{s.v}</div>
                <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{s.k}</div>
                <div className="mt-2 text-xs text-muted-foreground">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="relative mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Built for publishers who ship</h2>
          <p className="mt-4 text-muted-foreground">Everything you need to plug offer monetization into your product in an afternoon.</p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {[
            { icon: Code2, title: "One-line integration", desc: "Drop an iframe with your app_id. That's it. No SDK, no dependencies." },
            { icon: Zap, title: "Real-time postbacks", desc: "Server-to-server callbacks fire the moment an offer is completed." },
            { icon: Shield, title: "Anti-fraud built in", desc: "Deduplication, IP/geo checks, and secure signature validation on every event." },
            { icon: TrendingUp, title: "Tier-1 inventory", desc: "Premium partners: CPALead, Cointo, Upwall, Adgate, OfferToro and more." },
            { icon: BarChart3, title: "Live analytics", desc: "Track clicks, conversions and revenue in real time from your dashboard." },
            { icon: Globe, title: "Global reach", desc: "Localized offers across 190+ countries and mobile + desktop platforms." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="group relative rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur transition-colors hover:border-primary/40">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 ring-1 ring-primary/30">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* NETWORKS */}
      <section id="networks" className="relative mx-auto max-w-7xl px-6 py-24">
        <div className="rounded-3xl border border-border/60 bg-card/40 p-10 backdrop-blur">
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Ad network partners</div>
            <h2 className="mt-3 text-2xl font-semibold md:text-3xl">Aggregated inventory, one payout</h2>
          </div>
          <div className="mt-10 grid grid-cols-3 gap-6 md:grid-cols-6">
            {["CPALead", "Cointo", "Upwall", "AdGate", "OfferToro", "Ayet"].map((n) => (
              <div key={n} className="rounded-xl border border-border/50 bg-background/40 py-4 text-center text-sm font-medium text-muted-foreground">
                {n}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INTEGRATE */}
      <section id="integrate" className="relative mx-auto max-w-7xl px-6 py-24">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Integrate in under 60 seconds</h2>
            <p className="mt-4 text-muted-foreground">
              Sign up, grab your <code className="rounded bg-muted px-1.5 py-0.5 text-xs">app_id</code>, and paste the iframe. Users see your offerwall immediately — you get paid on every conversion.
            </p>
            <div className="mt-6 inline-block">
              <GetAppIdButton />
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-[oklch(0.11_0.02_260)] shadow-2xl shadow-primary/10">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-destructive/70" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
              <div className="h-3 w-3 rounded-full bg-green-500/70" />
              <span className="ml-2 text-xs text-muted-foreground">offerwall.html</span>
            </div>
            <pre className="overflow-x-auto p-6 text-sm leading-relaxed">
              <code className="text-muted-foreground">
{`<iframe
  src="https://offerdeck.io/wall?`}<span className="text-primary">app_id</span>{`=YOUR_APP_ID&`}<span className="text-primary">user_id</span>{`=USER_ID"
  width="100%"
  height="600"
  frameborder="0"
  allow="clipboard-write">
</iframe>`}
              </code>
            </pre>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative mx-auto max-w-4xl px-6 py-24 text-center">
        <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/40 to-accent/10 p-12 backdrop-blur">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Start earning tonight</h2>
          <p className="mt-4 text-muted-foreground">No verification, no waitlist. Register and integrate in minutes.</p>
          <Link to="/auth" search={{ mode: "register" }} className="mt-8 inline-block">
            <Button size="lg" className="bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-xl shadow-primary/30">
              Create free account
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Offerdeck. All rights reserved.
      </footer>
    </div>
  );
}
