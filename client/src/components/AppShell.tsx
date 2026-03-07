import { useEffect, useMemo, useState } from "react";
import {
  Activity,
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

function getPageMeta(pathname: string) {
  if (pathname.startsWith("/sent")) {
    return {
      eyebrow: "Outbound Log",
      title: "Sent Activity",
      subtitle: "Review approved messages, delivery intent, and thread follow-through.",
    };
  }

  if (pathname.startsWith("/dashboard")) {
    return {
      eyebrow: "Operational Pulse",
      title: "Workflow Dashboard",
      subtitle: "Monitor workload health, review pressure, and recent automation output.",
    };
  }

  return {
    eyebrow: "Clinical Inbox",
    title: "Inbox Triage",
    subtitle: "Review incoming email threads, inspect extraction quality, and approve responses.",
  };
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

  const meta = useMemo(() => getPageMeta(location.pathname), [location.pathname]);

  return (
    <div className="min-h-screen">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden p-3 md:flex",
          collapsed ? "w-28" : "w-80"
        )}
      >
        <div
          className={cn(
            "flex w-full flex-col overflow-hidden rounded-xl border border-sidebar-border bg-sidebar shadow-md transition-[width]",
            collapsed ? "items-center" : ""
          )}
        >
          <div className="border-b border-sidebar-border px-4 py-4">
            <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
              <div className="flex size-10 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
                <Mail className="size-4" />
              </div>
              <div className={cn("min-w-0", collapsed && "hidden")}>
                <p className="truncate text-sm font-semibold text-sidebar-foreground">
                  GiveAGo Operations
                </p>
                <p className="mt-0.5 text-xs text-sidebar-foreground/60">
                  Property triage workspace
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 px-3 py-3">
            {!collapsed && (
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/40">
                Navigation
              </p>
            )}

            <nav className="space-y-1.5">
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className="block">
                  {({ isActive }) => (
                    <span
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                          : "text-sidebar-foreground/80 hover:bg-white/5 hover:text-sidebar-foreground"
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
          </div>

          <div className="border-t border-sidebar-border p-3">
            {!collapsed && (
              <div className="mb-3 rounded-lg border border-sidebar-border bg-white/5 px-3 py-2.5">
                <div className="flex items-center gap-2 text-sidebar-foreground">
                  <Activity className="size-4 text-sidebar-primary" />
                  <span className="text-sm font-semibold">Operator surface</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-sidebar-foreground/60">
                  Ready for review and operational processing.
                </p>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCollapsed((value) => !value)}
              className={cn(
                "w-full border-sidebar-border bg-white/5 text-sidebar-foreground hover:bg-white/10 hover:text-sidebar-foreground",
                collapsed && "justify-center px-0"
              )}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
              <span className={cn(collapsed && "hidden")}>Collapse</span>
            </Button>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[18rem] p-2.5 md:hidden",
          "transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col rounded-xl border border-sidebar-border bg-sidebar shadow-md">
          <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3.5">
            <div>
              <p className="text-sm font-semibold text-sidebar-foreground">GiveAGo Operations</p>
              <p className="mt-0.5 text-xs text-sidebar-foreground/60">
                Property triage workspace
              </p>
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setMobileOpen(false)}
              className="text-sidebar-foreground hover:bg-white/10 hover:text-sidebar-foreground"
            >
              <X className="size-4" />
            </Button>
          </div>

          <nav className="flex-1 space-y-1.5 px-3 py-3">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className="block">
                {({ isActive }) => (
                  <span
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                        : "text-sidebar-foreground/80 hover:bg-white/5 hover:text-sidebar-foreground"
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      <main
        className={cn(
          "relative min-h-screen transition-[margin] duration-300",
          collapsed ? "md:ml-28" : "md:ml-80"
        )}
      >
        <div className="px-3 pt-3 md:px-5 md:pt-4 lg:px-6">
          <header className="app-surface sticky top-3 z-30 px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="mt-0.5 md:hidden"
                  onClick={() => setMobileOpen(true)}
                >
                  <Menu className="size-4" />
                </Button>

                <div className="min-w-0">
                  <span className="app-kicker">{meta.eyebrow}</span>
                  <h1 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground md:text-[1.75rem]">
                    {meta.title}
                  </h1>
                  <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {meta.subtitle}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              </div>
            </div>
          </header>
        </div>

        <div className="px-3 pb-4 pt-3 md:px-5 md:pb-6 lg:px-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
