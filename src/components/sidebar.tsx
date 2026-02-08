"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import {
  LayoutDashboard,
  Mic,
  FileText,
  GitBranch,
  Folder,
  Settings,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Record", href: "/record", icon: Mic, highlight: true },
  { label: "Entries", href: "/entries", icon: FileText },
  { label: "Connections", href: "/connections", icon: GitBranch },
  { label: "Projects", href: "/projects", icon: Folder },
  { label: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  user: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

export function Sidebar({ collapsed, onToggle, user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initials = user.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email[0].toUpperCase();

  return (
    <aside
      className={`flex flex-col h-screen bg-sidebar-bg border-r border-border/60 transition-all duration-200 ease-in-out ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Logo + collapse toggle */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-border/40">
        {!collapsed && (
          <span className="text-lg font-semibold tracking-tight font-heading text-primary">
            fleminglabs
          </span>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-sidebar-hover transition-colors cursor-pointer"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronsRight className="w-4 h-4" />
          ) : (
            <ChevronsLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          const highlight = "highlight" in item && item.highlight;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-sidebar-active/20 text-primary"
                  : highlight
                    ? "text-primary/80 hover:bg-primary-light hover:text-primary"
                    : "text-muted hover:bg-sidebar-hover hover:text-foreground"
              } ${collapsed ? "justify-center px-0" : ""}`}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-border/40 p-3">
        <div
          className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}
        >
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-primary-light text-primary text-xs font-semibold flex items-center justify-center shrink-0">
            {initials}
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user.full_name || "Researcher"}
              </p>
              <p className="text-xs text-muted truncate">{user.email}</p>
            </div>
          )}

          {!collapsed && (
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-sidebar-hover transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
