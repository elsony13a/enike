import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Shield, LayoutDashboard, Network, Receipt, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      throw redirect({ to: "/auth", search: { mode: "login" } });
    }
    const { data: isAdmin, error } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (error || isAdmin !== true) {
      throw redirect({ to: "/dashboard" });
    }
    return { user: userData.user };
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-primary to-accent">
              <Shield className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="font-semibold">Admin Console</span>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <AdminLink to="/admin" icon={<LayoutDashboard className="h-4 w-4" />}>Overview</AdminLink>
            <AdminLink to="/admin/networks" icon={<Network className="h-4 w-4" />}>Networks</AdminLink>
            <AdminLink to="/admin/offers" icon={<Package className="h-4 w-4" />}>Offers</AdminLink>
            <AdminLink to="/admin/transactions" icon={<Receipt className="h-4 w-4" />}>Transactions</AdminLink>
          </nav>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Outlet />
      </div>
    </div>
  );
}

function AdminLink({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: true }}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground [&.active]:bg-secondary [&.active]:text-foreground"
    >
      {icon}
      {children}
    </Link>
  );
}