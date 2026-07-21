import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Zap, Shield } from "lucide-react";

export function SiteHeader() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      setIsAuthed(!!data.user);
      if (data.user) {
        const { data: admin } = await supabase.rpc("has_role", {
          _user_id: data.user.id,
          _role: "admin",
        });
        setIsAdmin(admin === true);
      } else {
        setIsAdmin(false);
      }
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
        <Link to="/" className="group flex items-center gap-2">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30">
            <Zap className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            Offer<span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">deck</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a href="/#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Features
          </a>
          <a href="/#networks" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Networks
          </a>
          <a href="/#integrate" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Integrate
          </a>
        </nav>

        <div className="flex items-center gap-3">
          {isAuthed ? (
            <>
              {isAdmin && (
                <Link to="/admin">
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <Shield className="h-4 w-4" /> Admin
                  </Button>
                </Link>
              )}
              <Link to={isAdmin ? "/admin" : "/dashboard"}>
                <Button variant="ghost" size="sm">Dashboard</Button>
              </Link>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link to="/auth" search={{ mode: "login" }}>
                <Button variant="ghost" size="sm">Log in</Button>
              </Link>
              <Link to="/auth" search={{ mode: "register" }}>
                <Button size="sm" className="bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-90">
                  Get started
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}