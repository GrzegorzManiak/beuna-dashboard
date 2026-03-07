import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  X,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SIDEBAR_KEY = "gag.sidebar.collapsed";

const NAV_ITEMS = [
  { to: "/", label: "Inbox", icon: Mail, end: true },
  { to: "/sent", label: "Sent", icon: Send, end: false },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: false },
] as const;

function getPageTitle(pathname: string): string {
  if (pathname.startsWith("/sent")) return "Sent Mail";
  if (pathname.startsWith("/dashboard")) return "Traffic Dashboard";
  return "Inbox";
}

export function AppShell() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(SIDEBAR_KEY);
    if (!raw) return;
    setCollapsed(raw === "1");
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const pageTitle = useMemo(() => getPageTitle(location.pathname), [location.pathname]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.08),_transparent_45%),linear-gradient(180deg,#f8faf8_0%,#f3f7f4_100%)]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border bg-sidebar/95 backdrop-blur md:flex md:flex-col",
          "transition-[width] duration-300",
          collapsed ? "w-20" : "w-72"
        )}
      >
        <div className="flex h-16 items-center border-b border-sidebar-border px-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex size-9 items-center justify-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground">
              <Mail className="size-4" />
            </div>
            <div className={cn("transition-opacity", collapsed && "opacity-0")}>
              <p className="text-sm font-semibold text-sidebar-foreground">GiveAGo Inbox</p>
              <p className="text-xs text-muted-foreground">Property triage</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="block">
              {({ isActive }) => (
                <span
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                  title={item.label}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className={cn("truncate", collapsed && "hidden")}>{item.label}</span>
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCollapsed((value) => !value)}
            className={cn("w-full justify-start", collapsed && "justify-center")}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            <span className={cn(collapsed && "hidden")}>Collapse</span>
          </Button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/45 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 border-r border-sidebar-border bg-sidebar p-3 md:hidden",
          "transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">GiveAGo Inbox</p>
            <p className="text-xs text-muted-foreground">Property triage</p>
          </div>
          <Button size="icon-sm" variant="ghost" onClick={() => setMobileOpen(false)}>
            <X className="size-4" />
          </Button>
        </div>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="block">
              {({ isActive }) => (
                <span
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main
        className={cn(
          "min-h-screen transition-[margin] duration-300",
          collapsed ? "md:ml-20" : "md:ml-72"
        )}
      >
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
          <div className="flex h-16 items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-3">
              <Button
                size="icon-sm"
                variant="ghost"
                className="md:hidden"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="size-4" />
              </Button>
              <h1 className="text-sm font-semibold tracking-wide">{pageTitle}</h1>
            </div>
            <p className="hidden text-xs text-muted-foreground md:block">
              Traffic-light triage workspace
            </p>
          </div>
        </header>

        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
