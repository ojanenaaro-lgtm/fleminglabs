import Link from "next/link";
import { Mic, Sparkles, GitBranch, Brain, Clock, Unlink } from "lucide-react";
import { HeroWaveform } from "@/components/landing/hero-waveform";
import { SerendipityGraph } from "@/components/landing/serendipity-graph";

const painPoints = [
  {
    icon: Brain,
    title: "Lost insights",
    description:
      "Brilliant observations vanish between thinking them and writing them down.",
  },
  {
    icon: Clock,
    title: "Manual note-taking",
    description:
      "Writing disrupts your flow. You stop working to capture what you're doing.",
  },
  {
    icon: Unlink,
    title: "Missed connections",
    description:
      "Related findings across experiments never surface — they stay buried in separate notebooks.",
  },
];

const steps = [
  {
    icon: Mic,
    title: "Talk while you work",
    description:
      "Narrate observations, protocols, and ideas hands-free. FlemingLabs captures everything.",
  },
  {
    icon: Sparkles,
    title: "AI structures your notes",
    description:
      "Voice recordings are transcribed, tagged, and organized into structured lab entries automatically.",
  },
  {
    icon: GitBranch,
    title: "Discover connections",
    description:
      "The Serendipity Engine finds links between your observations — surfacing insights you'd miss.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6 max-w-6xl mx-auto">
        <span className="text-xl font-semibold tracking-tight font-heading text-primary">
          fleminglabs
        </span>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            GitHub
          </a>
          <Link
            href="/login"
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors"
          >
            Sign up
          </Link>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <HeroWaveform />
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-24 pb-32 animate-[fade-in-up_0.8s_ease-out]">
          <h1 className="text-5xl sm:text-6xl font-heading font-semibold tracking-tight text-foreground max-w-2xl leading-[1.1]">
            Your lab notebook,
            <br />
            <span className="text-primary">listening.</span>
          </h1>

          <p className="mt-6 text-lg text-muted max-w-lg leading-relaxed">
            Talk while you work. AI structures your notes.
            <br />
            Discover connections you&apos;d never find alone.
          </p>

          <div className="mt-10 flex items-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-primary text-white text-base font-medium hover:bg-primary-hover transition-colors shadow-sm"
            >
              <Mic className="w-5 h-5" />
              Start Recording
            </Link>
          </div>

          <p className="mt-8 text-xs text-muted/60">
            Open source &middot; MIT license &middot; Your data stays yours
          </p>
        </div>
      </section>

      {/* ── Problem ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-surface/50">
        <div className="max-w-4xl mx-auto animate-[fade-in-up_0.8s_ease-out]">
          <h2 className="text-3xl font-heading font-semibold text-center mb-4">
            Every day, researchers lose insights.
          </h2>
          <p className="text-center text-muted max-w-xl mx-auto mb-12">
            The gap between thinking and documenting costs labs time, reproducibility, and
            discoveries.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {painPoints.map((point) => {
              const Icon = point.icon;
              return (
                <div
                  key={point.title}
                  className="bg-white rounded-xl p-6 shadow-[var(--card-shadow)]"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-heading font-semibold mb-2">{point.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{point.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto animate-[fade-in-up_0.8s_ease-out]">
          <h2 className="text-3xl font-heading font-semibold text-center mb-12">
            How it works
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="text-center">
                  <div className="relative mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-7 h-7 text-primary" />
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-white text-xs font-semibold flex items-center justify-center">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="font-heading font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Serendipity Engine ───────────────────────────────────────── */}
      <section className="py-24 px-6 bg-surface/50">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-12 animate-[fade-in-up_0.8s_ease-out]">
          <div className="flex-1">
            <h2 className="text-3xl font-heading font-semibold mb-4">
              The Serendipity Engine
            </h2>
            <blockquote className="border-l-4 border-primary/30 pl-4 italic text-muted mb-4">
              &ldquo;One sometimes finds what one is not looking for.&rdquo;
              <span className="block text-xs mt-1 not-italic">— Alexander Fleming</span>
            </blockquote>
            <p className="text-sm text-muted leading-relaxed">
              FlemingLabs automatically maps relationships between your observations, protocols,
              and measurements — surfacing unexpected connections that lead to real discoveries.
            </p>
          </div>
          <div className="flex-1 flex justify-center">
            <SerendipityGraph />
          </div>
        </div>
      </section>

      {/* ── Open Source ──────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center animate-[fade-in-up_0.8s_ease-out]">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-light text-primary text-sm font-medium mb-4">
            MIT License
          </div>
          <h2 className="text-3xl font-heading font-semibold mb-4">
            Open source, always
          </h2>
          <p className="text-muted mb-8">
            FlemingLabs is open source. Your research data stays under your control.
            Contribute, self-host, or extend to fit your lab&apos;s needs.
          </p>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-border text-foreground font-medium hover:bg-surface transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            View on GitHub
          </a>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-border/60 py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-sm font-heading font-semibold text-primary">
            fleminglabs
          </span>
          <div className="flex items-center gap-6 text-xs text-muted">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <Link href="/login" className="hover:text-foreground transition-colors">
              Log in
            </Link>
            <Link href="/signup" className="hover:text-foreground transition-colors">
              Sign up
            </Link>
          </div>
          <span className="text-xs text-muted/60">
            &copy; {new Date().getFullYear()} FlemingLabs
          </span>
        </div>
      </footer>
    </div>
  );
}
