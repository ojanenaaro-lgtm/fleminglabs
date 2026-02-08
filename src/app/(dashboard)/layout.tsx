import { createServerSupabaseClient } from "@/lib/supabase-server";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const shellUser = {
    full_name: (user?.user_metadata?.full_name as string) || null,
    email: user?.email || "",
    avatar_url: (user?.user_metadata?.avatar_url as string) || null,
  };

  return <DashboardShell user={shellUser}>{children}</DashboardShell>;
}
