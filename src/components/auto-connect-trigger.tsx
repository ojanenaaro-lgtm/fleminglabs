"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, Loader2 } from "lucide-react";

export function AutoConnectTrigger({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "analyzing" | "done" | "error">("idle");

  useEffect(() => {
    if (status !== "idle") return;
    setStatus("analyzing");

    fetch("/api/ai/auto-connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entry_id: entryId }),
    })
      .then((res) => {
        if (res.ok) {
          setStatus("done");
          router.refresh();
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        setStatus("error");
      });
  }, [entryId, status, router]);

  if (status === "done" || status === "error") return null;

  return (
    <div className="bg-white rounded-xl border border-border/40 shadow-[var(--card-shadow)] p-5">
      <div className="flex items-center gap-3">
        {status === "analyzing" ? (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        ) : (
          <GitBranch className="w-4 h-4 text-muted" />
        )}
        <p className="text-sm text-muted">
          {status === "analyzing"
            ? "Analyzing connections..."
            : "No connections yet"}
        </p>
      </div>
    </div>
  );
}
