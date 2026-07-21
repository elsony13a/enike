import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";

async function resolveDestination(): Promise<"/admin" | "/dashboard"> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return "/dashboard";
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: data.user.id,
    _role: "admin",
  });
  return isAdmin === true ? "/admin" : "/dashboard";
}

const searchSchema = z.object({
  mode: z.enum(["login", "register"]).catch("login"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Offerdeck" },
      { name: "description", content: "Publisher login and registration for the Offerdeck offerwall platform." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const isRegister = mode === "register";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const dest = await resolveDestination();
        navigate({ to: dest, replace: true });
      }
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Account created. Welcome aboard!");
        navigate({ to: await resolveDestination(), replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        navigate({ to: await resolveDestination(), replace: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent" />
      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-border/60 bg-card/60 p-8 shadow-2xl shadow-primary/10 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
              <Zap className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-semibold">Offerdeck</span>
          </div>

          <h1 className="mt-8 text-2xl font-bold tracking-tight">
            {isRegister ? "Create your publisher account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isRegister
              ? "No email verification. Get your app_id instantly."
              : "Sign in to manage your offerwall."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {isRegister && (
              <div>
                <Label htmlFor="name">Publisher name</Label>
                <Input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Media"
                  className="mt-2"
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="mt-2"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-90"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isRegister ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isRegister ? (
              <>
                Already have an account?{" "}
                <Link to="/auth" search={{ mode: "login" }} className="text-primary hover:underline">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New here?{" "}
                <Link to="/auth" search={{ mode: "register" }} className="text-primary hover:underline">
                  Create an account
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}