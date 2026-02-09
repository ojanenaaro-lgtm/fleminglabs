"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { MicPermission } from "@/components/mic-permission";
import { saveOnboardingProfile, completeOnboarding } from "./actions";
import { Mic, Check, ArrowRight, ArrowLeft } from "lucide-react";

const TOTAL_STEPS = 4;
const DEMO_MAX_SECONDS = 30;

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Form state
  const [fullName, setFullName] = useState("");
  const [lab, setLab] = useState("");
  const [institution, setInstitution] = useState("");
  const [researchFocus, setResearchFocus] = useState("");

  // Recording demo state
  const recorder = useVoiceRecorder();
  const demoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [demoSeconds, setDemoSeconds] = useState(0);

  // Pre-fill name from user metadata
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.full_name) {
        setFullName(user.user_metadata.full_name);
      }
    });
  }, []);

  // Demo timer — auto-stop at 30s
  const recorderStop = recorder.stop;
  useEffect(() => {
    if (recorder.state === "recording") {
      setDemoSeconds(0);
      demoTimerRef.current = setInterval(() => {
        setDemoSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (demoTimerRef.current) {
        clearInterval(demoTimerRef.current);
        demoTimerRef.current = null;
      }
    }
    return () => {
      if (demoTimerRef.current) {
        clearInterval(demoTimerRef.current);
        demoTimerRef.current = null;
      }
    };
  }, [recorder.state]);

  // Auto-stop when demo hits max
  useEffect(() => {
    if (demoSeconds >= DEMO_MAX_SECONDS && recorder.state === "recording") {
      recorderStop();
    }
  }, [demoSeconds, recorder.state, recorderStop]);

  const handleNext = useCallback(async () => {
    // Save profile when leaving step 2
    if (step === 2) {
      setSaving(true);
      try {
        await saveOnboardingProfile({
          full_name: fullName,
          lab,
          institution,
          research_focus: researchFocus,
        });
      } catch {
        // Continue anyway — profile save is best-effort
      }
      setSaving(false);
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }, [step, fullName, lab, institution, researchFocus]);

  const handleBack = useCallback(() => {
    setStep((s) => Math.max(s - 1, 1));
  }, []);

  const handleFinish = useCallback(async () => {
    setSaving(true);
    try {
      await completeOnboarding();
    } catch {
      // Continue — worst case they see onboarding again
    }
    router.push("/dashboard");
  }, [router]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i + 1 === step
                ? "w-8 bg-primary"
                : i + 1 < step
                  ? "w-2 bg-primary/60"
                  : "w-2 bg-border"
            }`}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="w-full max-w-lg px-6 animate-[slide-in-right_0.3s_ease-out]" key={step}>
        {/* ── Step 1: Welcome ──────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-heading font-semibold mb-2">
                Welcome to FlemingLabs
              </h1>
              <p className="text-muted">
                Let&apos;s set up your profile so your notebook feels like yours.
              </p>
            </div>

            <div>
              <label htmlFor="fullName" className="block text-sm font-medium mb-1">
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Dr. Jane Doe"
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-input-bg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label htmlFor="lab" className="block text-sm font-medium mb-1">
                Lab / Group
              </label>
              <input
                id="lab"
                type="text"
                value={lab}
                onChange={(e) => setLab(e.target.value)}
                placeholder="Molecular Biology Lab"
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-input-bg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label htmlFor="institution" className="block text-sm font-medium mb-1">
                Institution
              </label>
              <input
                id="institution"
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="MIT, Stanford, etc."
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-input-bg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        )}

        {/* ── Step 2: Research focus ───────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-heading font-semibold mb-2">
                What do you research?
              </h1>
              <p className="text-muted">
                This helps the AI understand your context and make better connections.
              </p>
            </div>

            <div>
              <label htmlFor="researchFocus" className="block text-sm font-medium mb-1">
                Research focus
              </label>
              <textarea
                id="researchFocus"
                value={researchFocus}
                onChange={(e) => setResearchFocus(e.target.value)}
                placeholder="e.g., CRISPR gene editing in zebrafish models, focusing on cardiac regeneration pathways..."
                rows={5}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-input-bg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
              <p className="text-xs text-muted mt-1">
                Be as specific as you like — this can be changed later in settings.
              </p>
            </div>
          </div>
        )}

        {/* ── Step 3: Try recording ───────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-heading font-semibold mb-2">
                Try recording
              </h1>
              <p className="text-muted">
                Let&apos;s make sure your microphone works. Record a quick test (up to 30 seconds).
              </p>
            </div>

            <MicPermission>
              <div className="flex flex-col items-center py-4">
                {/* Mic visualizer */}
                <div className="relative mb-6">
                  {recorder.state === "recording" && (
                    <>
                      <div
                        className="absolute inset-0 rounded-full bg-primary"
                        style={{ animation: "pulse-ring 2s ease-out infinite" }}
                      />
                      <div
                        className="absolute inset-0 rounded-full bg-primary"
                        style={{ animation: "pulse-ring 2s ease-out infinite 0.6s" }}
                      />
                    </>
                  )}
                  <div
                    className={`relative z-10 flex items-center justify-center w-20 h-20 rounded-full transition-all ${
                      recorder.state === "recording"
                        ? "bg-primary"
                        : recorder.audioBlob
                          ? "bg-sage"
                          : "bg-border"
                    }`}
                  >
                    {recorder.audioBlob ? (
                      <Check className="w-8 h-8 text-white" />
                    ) : (
                      <Mic className="w-8 h-8 text-white" />
                    )}
                  </div>
                </div>

                {/* Timer */}
                <p className="font-heading text-3xl font-light tabular-nums mb-4">
                  {formatDuration(recorder.state === "recording" ? demoSeconds : recorder.duration)}
                </p>

                {/* Controls */}
                {recorder.state === "idle" && !recorder.audioBlob && (
                  <button
                    onClick={() => recorder.start()}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-white font-medium hover:bg-primary-hover transition-colors"
                  >
                    <Mic className="w-5 h-5" />
                    Start Test Recording
                  </button>
                )}

                {recorder.state === "recording" && (
                  <button
                    onClick={() => recorder.stop()}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
                  >
                    Stop
                  </button>
                )}

                {recorder.audioBlob && (
                  <div className="text-center">
                    <p className="text-sm text-primary font-medium mb-2">
                      Recording captured successfully!
                    </p>
                    <audio
                      controls
                      src={URL.createObjectURL(recorder.audioBlob)}
                      className="mx-auto"
                    />
                  </div>
                )}

                {recorder.error && (
                  <p className="text-sm text-error bg-red-50 px-4 py-2 rounded-lg mt-4">
                    {recorder.error}
                  </p>
                )}
              </div>
            </MicPermission>
          </div>
        )}

        {/* ── Step 4: All set ─────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-3xl font-heading font-semibold">
              You&apos;re all set!
            </h1>
            <p className="text-muted max-w-sm mx-auto">
              Your lab notebook is ready. Start recording your first session whenever you&apos;re
              ready.
            </p>

            {/* Summary */}
            <div className="bg-surface rounded-xl p-4 text-left text-sm space-y-2 max-w-sm mx-auto">
              {fullName && (
                <div className="flex justify-between">
                  <span className="text-muted">Name</span>
                  <span className="font-medium">{fullName}</span>
                </div>
              )}
              {lab && (
                <div className="flex justify-between">
                  <span className="text-muted">Lab</span>
                  <span className="font-medium">{lab}</span>
                </div>
              )}
              {institution && (
                <div className="flex justify-between">
                  <span className="text-muted">Institution</span>
                  <span className="font-medium">{institution}</span>
                </div>
              )}
              {researchFocus && (
                <div>
                  <span className="text-muted block mb-1">Research focus</span>
                  <span className="font-medium">{researchFocus}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center gap-4 mt-10">
        {step > 1 && step < 4 && (
          <button
            onClick={handleBack}
            className="flex items-center gap-1 px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}

        {step < 4 && (
          <>
            <button
              onClick={handleNext}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Continue"}
              <ArrowRight className="w-4 h-4" />
            </button>
            {step > 1 && (
              <button
                onClick={() => setStep(4)}
                className="text-sm text-muted hover:text-foreground transition-colors"
              >
                Skip
              </button>
            )}
          </>
        )}

        {step === 4 && (
          <button
            onClick={handleFinish}
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 rounded-full bg-primary text-white font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {saving ? "Setting up..." : "Go to Dashboard"}
            <ArrowRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
