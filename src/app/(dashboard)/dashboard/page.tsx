import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  FileText,
  Mic,
  GitBranch,
  Clock,
  ArrowRight,
  Plus,
} from "lucide-react";

const stats = [
  {
    label: "Total Entries",
    value: "0",
    icon: FileText,
    color: "text-primary",
    bg: "bg-primary-light",
  },
  {
    label: "Active Sessions",
    value: "0",
    icon: Mic,
    color: "text-amber-700",
    bg: "bg-amber-50",
  },
  {
    label: "Connections Found",
    value: "0",
    icon: GitBranch,
    color: "text-violet-700",
    bg: "bg-violet-50",
  },
  {
    label: "Hours Recorded",
    value: "0",
    icon: Clock,
    color: "text-sky-700",
    bg: "bg-sky-50",
  },
];

const recentEntries = [
  {
    id: "1",
    title: "Initial setup observations",
    type: "observation" as const,
    time: "Just now",
    preview:
      "Set up the lab environment and calibrated instruments for the first round of experiments.",
  },
  {
    id: "2",
    title: "Protocol adjustments for sample B",
    type: "protocol_step" as const,
    time: "2 hours ago",
    preview:
      "Modified the centrifuge speed from 3000 to 4500 RPM based on preliminary results.",
  },
  {
    id: "3",
    title: "Unexpected crystallization pattern",
    type: "voice_note" as const,
    time: "Yesterday",
    preview:
      "Noticed unusual crystal formation in the control group. Need to cross-reference with last month's data.",
  },
];

const entryTypeLabels: Record<string, string> = {
  observation: "Observation",
  protocol_step: "Protocol",
  voice_note: "Voice Note",
  measurement: "Measurement",
  annotation: "Annotation",
};

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && !user.user_metadata?.onboarding_completed) {
    redirect("/onboarding");
  }

  const firstName =
    user?.user_metadata?.full_name?.split(" ")[0] || "Researcher";

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-semibold font-heading tracking-tight">
          Welcome back, {firstName}
        </h1>
        <p className="text-muted text-sm mt-1">
          Here&apos;s what&apos;s happening in your lab notebook.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white rounded-xl p-5 shadow-[var(--card-shadow)]"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted">{stat.label}</span>
                <div
                  className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}
                >
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </div>
              <p className="text-2xl font-semibold font-heading">
                {stat.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent entries */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-[var(--card-shadow)]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
            <h2 className="text-sm font-semibold font-heading">
              Recent Entries
            </h2>
            <a
              href="/entries"
              className="text-xs text-muted hover:text-primary transition-colors flex items-center gap-1"
            >
              View all
              <ArrowRight className="w-3 h-3" />
            </a>
          </div>

          <div className="divide-y divide-border/30">
            {recentEntries.map((entry) => (
              <div
                key={entry.id}
                className="px-5 py-4 hover:bg-sidebar-hover/50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-medium">{entry.title}</h3>
                  <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-primary-light text-primary font-medium">
                    {entryTypeLabels[entry.type]}
                  </span>
                </div>
                <p className="text-xs text-muted line-clamp-1">
                  {entry.preview}
                </p>
                <span className="text-[11px] text-muted/70 mt-1 block">
                  {entry.time}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Start Recording CTA */}
        <div className="bg-white rounded-xl shadow-[var(--card-shadow)] p-6 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Mic className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-base font-semibold font-heading mb-1">
            Start Recording
          </h3>
          <p className="text-xs text-muted mb-5 max-w-[200px]">
            Begin a new lab session and capture your observations in real time.
          </p>
          <a
            href="/record"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Session
          </a>
        </div>
      </div>
    </div>
  );
}
