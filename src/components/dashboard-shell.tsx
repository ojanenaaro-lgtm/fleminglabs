"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { GlobalSearch } from "@/components/global-search";

interface DashboardShellProps {
  children: React.ReactNode;
  user: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

export function DashboardShell({ children, user }: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        user={user}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>

      <GlobalSearch />
    </div>
  );
}
