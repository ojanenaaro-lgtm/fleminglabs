"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Mic, ChevronRight, Command } from "lucide-react";

const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/record": "Record",
  "/sessions": "Lab Sessions",
  "/entries": "Entries",
  "/connections": "Connections",
  "/projects": "Projects",
  "/settings": "Settings",
  "/search": "Search",
};

export function TopBar() {
  const pathname = usePathname();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes("MAC"));
  }, []);

  function openSearch() {
    window.dispatchEvent(new CustomEvent("fleminglabs:open-search"));
  }

  const segments = pathname.split("/").filter(Boolean);

  // Build breadcrumbs: first crumb is always Dashboard
  const breadcrumbs =
    pathname === "/dashboard"
      ? [{ label: "Dashboard", href: "/dashboard" }]
      : [
          { label: "Dashboard", href: "/dashboard" },
          ...segments
            .filter((seg) => seg !== "dashboard")
            .map((seg, i, arr) => ({
              label:
                routeLabels["/" + arr.slice(0, i + 1).join("/")] ||
                seg.charAt(0).toUpperCase() + seg.slice(1),
              href: "/" + arr.slice(0, i + 1).join("/"),
            })),
        ];

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-border/40 bg-sidebar-bg">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted/60" />}
            {i === breadcrumbs.length - 1 ? (
              <span className="font-medium text-foreground">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-muted hover:text-foreground transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Right side: search + action */}
      <div className="flex items-center gap-3">
        {/* Search trigger */}
        <button
          onClick={openSearch}
          className="flex items-center gap-2 w-64 pl-3 pr-2 py-1.5 rounded-lg border border-border/60 bg-background text-sm text-muted/70 hover:border-border hover:text-muted transition-colors cursor-pointer"
        >
          <Search className="w-4 h-4" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface text-[10px] font-medium border border-border/40">
            {isMac ? <Command className="w-2.5 h-2.5" /> : "Ctrl+"}K
          </kbd>
        </button>

        {/* New Session button */}
        <Link
          href="/record"
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          <Mic className="w-4 h-4" />
          <span>New Session</span>
        </Link>
      </div>
    </header>
  );
}
