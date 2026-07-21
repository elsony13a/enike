import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, LayoutGrid, Code2, BarChart3, CreditCard, Settings } from "lucide-react";
import type { ComponentType } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Offerdeck" }] }),
  component: DashboardLayout,
});

type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string }> };

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/dashboard/placements", label: "Placements", icon: LayoutGrid },
  { to: "/dashboard/setup", label: "Setup & Integration", icon: Code2 },
  { to: "/dashboard/reports", label: "Leads & Reports", icon: BarChart3 },
  { to: "/dashboard/payments", label: "Payments", icon: CreditCard },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

function DashboardLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="mx-auto flex w-full max-w-7xl gap-8 px-6 py-10">
      <aside className="hidden w-56 shrink-0 md:block">
        <nav className="sticky top-24 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = to === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 min-w-0">
        <div className="mb-6 flex gap-1 overflow-x-auto md:hidden">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = to === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs ${
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}
        </div>
        <Outlet />
      </div>
    </div>
  );
}