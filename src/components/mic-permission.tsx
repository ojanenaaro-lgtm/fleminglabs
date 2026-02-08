"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Mic, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

type PermissionState = "checking" | "prompt" | "granted" | "denied" | "unsupported";

interface MicPermissionProps {
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
  children?: ReactNode;
  compact?: boolean;
}

function detectBrowser(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (ua.includes("Edg/")) return "edge";
  if (ua.includes("Chrome/")) return "chrome";
  if (ua.includes("Firefox/")) return "firefox";
  if (ua.includes("Safari/") && !ua.includes("Chrome")) return "safari";
  return "unknown";
}

const deniedInstructions: Record<string, string> = {
  chrome:
    "Click the lock icon in the address bar, find \"Microphone\", and change it to \"Allow\". Then reload the page.",
  firefox:
    "Click the lock icon in the address bar, click \"Clear permissions\", then reload the page and allow microphone access.",
  safari:
    "Go to Safari > Settings > Websites > Microphone, find this site and change the permission to \"Allow\".",
  edge:
    "Click the lock icon in the address bar, find \"Microphone permissions\", and change it to \"Allow\". Then reload the page.",
  unknown:
    "Open your browser settings, find site permissions for this page, and allow microphone access. Then reload the page.",
};

export function MicPermission({
  onPermissionGranted,
  onPermissionDenied,
  children,
  compact = false,
}: MicPermissionProps) {
  const [status, setStatus] = useState<PermissionState>("checking");

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }

    async function checkPermission() {
      try {
        // Not all browsers support permissions.query for microphone
        if (navigator.permissions?.query) {
          const result = await navigator.permissions.query({
            name: "microphone" as PermissionName,
          });
          if (result.state === "granted") {
            setStatus("granted");
            onPermissionGranted?.();
          } else if (result.state === "denied") {
            setStatus("denied");
            onPermissionDenied?.();
          } else {
            setStatus("prompt");
          }

          result.addEventListener("change", () => {
            if (result.state === "granted") {
              setStatus("granted");
              onPermissionGranted?.();
            } else if (result.state === "denied") {
              setStatus("denied");
              onPermissionDenied?.();
            }
          });
        } else {
          // Can't query — assume prompt
          setStatus("prompt");
        }
      } catch {
        // permissions.query threw — fall back to prompt
        setStatus("prompt");
      }
    }

    checkPermission();
  }, [onPermissionGranted, onPermissionDenied]);

  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Got access — stop the stream immediately
      stream.getTracks().forEach((t) => t.stop());
      setStatus("granted");
      onPermissionGranted?.();
    } catch {
      setStatus("denied");
      onPermissionDenied?.();
    }
  }, [onPermissionGranted, onPermissionDenied]);

  // Granted — render children (permission gate)
  if (status === "granted") {
    if (compact) {
      return (
        <div className="flex items-center gap-2 text-sm text-primary">
          <CheckCircle className="w-4 h-4" />
          <span>Microphone enabled</span>
        </div>
      );
    }
    return <>{children}</>;
  }

  // Checking
  if (status === "checking") {
    return (
      <div className={`flex items-center justify-center ${compact ? "py-2" : "py-8"}`}>
        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        {!compact && <span className="ml-3 text-sm text-muted">Checking microphone access...</span>}
      </div>
    );
  }

  // Prompt
  if (status === "prompt") {
    if (compact) {
      return (
        <button
          onClick={requestPermission}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          <Mic className="w-4 h-4" />
          Enable Microphone
        </button>
      );
    }
    return (
      <div className="flex flex-col items-center text-center py-8 px-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Mic className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold font-heading mb-2">Microphone Access</h3>
        <p className="text-sm text-muted max-w-sm mb-6">
          FlemingLabs needs microphone access to record your lab sessions. Your audio is processed
          locally and only stored when you choose to save.
        </p>
        <button
          onClick={requestPermission}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-white font-medium hover:bg-primary-hover transition-colors"
        >
          <Mic className="w-5 h-5" />
          Enable Microphone
        </button>
      </div>
    );
  }

  // Denied
  if (status === "denied") {
    const browser = detectBrowser();
    if (compact) {
      return (
        <div className="flex items-center gap-2 text-sm text-error">
          <XCircle className="w-4 h-4" />
          <span>Microphone blocked</span>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center text-center py-8 px-4">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <XCircle className="w-8 h-8 text-error" />
        </div>
        <h3 className="text-lg font-semibold font-heading mb-2">Microphone Blocked</h3>
        <p className="text-sm text-muted max-w-sm mb-4">
          Microphone access was denied. To use recording features, you&apos;ll need to enable it in
          your browser settings.
        </p>
        <div className="text-sm text-muted bg-surface rounded-lg p-4 max-w-sm">
          <p className="font-medium text-foreground mb-1">How to fix:</p>
          <p>{deniedInstructions[browser]}</p>
        </div>
      </div>
    );
  }

  // Unsupported
  return (
    <div className={`flex flex-col items-center text-center ${compact ? "py-2" : "py-8 px-4"}`}>
      <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-amber-600" />
      </div>
      <h3 className="text-lg font-semibold font-heading mb-2">Browser Not Supported</h3>
      <p className="text-sm text-muted max-w-sm">
        Your browser doesn&apos;t support microphone access. Please use a modern browser like
        Chrome, Firefox, Safari, or Edge.
      </p>
    </div>
  );
}
