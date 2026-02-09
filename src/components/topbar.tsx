"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Mic, ChevronRight, Command } from "lucide-react";
import { createClient } from "@/lib/supabase";

const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/record": "Record",
  "/sessions": "Lab Sessions",
  "/sessions/new": "New Session",
  "/entries": "Entries",
  "/connections": "Connections",
  "/collections": "Collections",
  "/projects": "Projects",
  "/settings": "Settings",
  "/search": "Search",
  "/onboarding": "Onboarding",
};

// UUID-like pattern to detect dynamic segments
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Which table to look up for a dynamic segment, based on the parent route
const dynamicLookups: Record<string, { table: string; field: string }> = {
  projects: { table: "projects", field: "name" },
  entries: { table: "entries", field: "content" },
  sessions: { table: "sessions", field: "title" },
};

export function TopBar() {
  const pathname = usePathname();
  const [isMac, setIsMac] = useState(false);
  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes("MAC"));
  }, []);

  // Resolve dynamic segment names from Supabase
  useEffect(() => {
    const segments = pathname.split("/").filter(Boolean);
    const toResolve: { id: string; parent: string }[] = [];

    for (let i = 0; i < segments.length; i++) {
      if (UUID_RE.test(segments[i]) && !resolvedNames[segments[i]]) {
        const parent = segments[i - 1];
        if (parent && dynamicLookups[parent]) {
          toResolve.push({ id: segments[i], parent });
        }
      }
    }

    if (toResolve.length === 0) return;

    const supabase = createClient();
    for (const { id, parent } of toResolve) {
      const { table, field } = dynamicLookups[parent];
      supabase
        .from(table)
        .select(field)
        .eq("id", id)
        .single()
        .then(({ data }) => {
          if (data) {
            const raw = String((data as unknown as Record<string, string>)[field] ?? "");
            // Truncate long content (entries) to first few words
            const label = raw.length > 40 ? raw.slice(0, 37) + "..." : raw;
            setResolvedNames((prev) => ({ ...prev, [id]: label || id.slice(0, 8) }));
          }
        });
    }
  }, [pathname, resolvedNames]);

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
            .map((seg, i, arr) => {
              const path = "/" + arr.slice(0, i + 1).join("/");
              let label = routeLabels[path];
              if (!label) {
                // Check if this is a resolved dynamic segment
                if (UUID_RE.test(seg)) {
                  label = resolvedNames[seg] ?? seg.slice(0, 8) + "...";
                } else {
                  label = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ");
                }
              }
              return { label, href: path };
            }),
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
