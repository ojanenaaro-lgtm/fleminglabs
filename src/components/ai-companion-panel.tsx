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
} from "lucide-react";
import type { CompanionMessage, CompanionDetectedType } from "@/lib/types";

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

interface AICompanionPanelProps {
  messages: CompanionMessage[];
  isThinking: boolean;
  isRecording: boolean;
}

export function AICompanionPanel({
  messages,
  isThinking,
  isRecording,
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
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold font-heading text-foreground">
          Research Companion
        </h3>
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

          return (
            <div
              key={msg.id}
              className="animate-[fadeIn_0.3s_ease-out]"
              style={{
                animationFillMode: "both",
              }}
            >
              <div className="rounded-lg border border-border/30 bg-background p-3">
                {/* Type badge */}
                {config && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <div
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.bg} ${config.color}`}
                    >
                      <Icon className="w-3 h-3" />
                      {config.label}
                    </div>
                  </div>
                )}

                {/* Message */}
                <p className="text-sm text-foreground leading-relaxed">
                  {msg.message}
                </p>

                {/* Suggested connections */}
                {msg.suggested_connections &&
                  msg.suggested_connections.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/20">
                      {msg.suggested_connections.map((conn, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-1.5 text-xs text-muted"
                        >
                          <Link2 className="w-3 h-3 mt-0.5 shrink-0" />
                          <span>{conn.reasoning}</span>
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
