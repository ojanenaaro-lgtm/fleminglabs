"use client";

import { useRef, useEffect } from "react";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Link2,
  Lightbulb,
  HelpCircle,
  Loader2,
  FileText,
} from "lucide-react";
import type { CompanionMessage, CompanionDetectedType, CompanionUrgency } from "@/lib/types";

const TYPE_CONFIG: Record<
  string,
  { icon: typeof Sparkles; label: string; color: string; bg: string }
> = {
  pattern: {
    icon: TrendingUp,
    label: "Pattern",
    color: "text-primary",
    bg: "bg-primary-light",
  },
  anomaly: {
    icon: AlertTriangle,
    label: "Anomaly",
    color: "text-red-700",
    bg: "bg-red-50",
  },
  connection: {
    icon: Link2,
    label: "Connection",
    color: "text-blue-700",
    bg: "bg-blue-50",
  },
  suggestion: {
    icon: Lightbulb,
    label: "Suggestion",
    color: "text-amber-700",
    bg: "bg-amber-50",
  },
  clarification: {
    icon: HelpCircle,
    label: "Clarification",
    color: "text-violet-700",
    bg: "bg-violet-50",
  },
};

const URGENCY_STYLES: Record<string, string> = {
  high: "border-amber-400 shadow-[0_0_0_1px_rgba(251,191,36,0.4)] animate-[urgencyPulse_2s_ease-in-out_infinite]",
  medium: "border-amber-200/80",
  low: "border-border/30",
};

interface AICompanionPanelProps {
  messages: CompanionMessage[];
  isThinking: boolean;
  isRecording: boolean;
  insightCount?: number;
}

export function AICompanionPanel({
  messages,
  isThinking,
  isRecording,
  insightCount = 0,
}: AICompanionPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-border/40 overflow-hidden shadow-[var(--card-shadow)]">
      {/* Urgency pulse keyframe — injected once */}
      <style>{`
        @keyframes urgencyPulse {
          0%, 100% { box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.3); }
          50% { box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.15), 0 0 12px rgba(251, 191, 36, 0.1); }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold font-heading text-foreground">
          Research Companion
        </h3>
        {insightCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary-light text-primary text-[10px] font-semibold tabular-nums">
            {insightCount}
          </span>
        )}
        {isRecording && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Listening
          </span>
        )}
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
        {messages.length === 0 && !isThinking && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm text-muted max-w-[200px]">
              {isRecording
                ? "I'm listening to your session. I'll chime in when I notice something interesting."
                : "Start recording and I'll help you spot patterns and connections in real time."}
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const config = msg.detected_type
            ? TYPE_CONFIG[msg.detected_type]
            : null;
          const Icon = config?.icon || Sparkles;
          const urgencyClass = URGENCY_STYLES[msg.urgency || "low"] || URGENCY_STYLES.low;

          return (
            <div
              key={msg.id}
              className="animate-[fadeIn_0.3s_ease-out]"
              style={{
                animationFillMode: "both",
              }}
            >
              <div className={`rounded-lg border bg-background p-3 ${urgencyClass}`}>
                {/* Type badge + urgency indicator */}
                <div className="flex items-center gap-1.5 mb-2">
                  {config && (
                    <div
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.bg} ${config.color}`}
                    >
                      <Icon className="w-3 h-3" />
                      {config.label}
                    </div>
                  )}
                  {msg.urgency === "high" && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                      Urgent
                    </span>
                  )}
                </div>

                {/* Message */}
                <p className="text-sm text-foreground leading-relaxed">
                  {msg.message}
                </p>

                {/* Referenced entries chips */}
                {msg.referenced_entries && msg.referenced_entries.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/20 flex flex-wrap gap-1.5">
                    {msg.referenced_entries.map((ref, i) => (
                      <div
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-[10px] text-muted"
                        title={ref.summary}
                      >
                        <FileText className="w-2.5 h-2.5" />
                        <span className="font-mono">{ref.date}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Timestamp */}
                <p className="text-[10px] text-muted/60 mt-2">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}

        {/* Thinking indicator */}
        {isThinking && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-light/30 border border-primary/10">
            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
            <span className="text-xs text-muted">Thinking...</span>
          </div>
        )}
      </div>
    </div>
  );
}
