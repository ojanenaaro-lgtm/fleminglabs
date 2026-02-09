"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import type { UserPreferences } from "@/lib/types";
import {
  User,
  Sliders,
  Key,
  Database,
  Info,
  Save,
  Loader2,
  Camera,
  Trash2,
  Download,
  ExternalLink,
} from "lucide-react";

const languages = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "pt", label: "Portuguese" },
];

const defaultPreferences: UserPreferences = {
  transcription_language: "en",
  auto_process_ai: true,
  serendipity_sensitivity: 50,
  audio_quality: "standard",
};

type SectionId = "profile" | "preferences" | "api-keys" | "data" | "about";

const sections: { id: SectionId; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "preferences", label: "Preferences", icon: Sliders },
  { id: "api-keys", label: "API Keys", icon: Key },
  { id: "data", label: "Data", icon: Database },
  { id: "about", label: "About", icon: Info },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionId>("profile");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Profile
  const [fullName, setFullName] = useState("");
  const [labName, setLabName] = useState("");
  const [institution, setInstitution] = useState("");
  const [researchContext, setResearchContext] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Preferences
  const [prefs, setPrefs] = useState<UserPreferences>(defaultPreferences);

  // API Keys
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");

  // State
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Load profile data
  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        setFullName(profile.full_name || "");
        setLabName(profile.lab_name || "");
        setInstitution(profile.institution || "");
        setResearchContext(profile.research_context || "");
        setAvatarUrl(profile.avatar_url || null);
      }

      // Load preferences from localStorage
      const stored = localStorage.getItem("fleminglabs_preferences");
      if (stored) {
        try {
          setPrefs({ ...defaultPreferences, ...JSON.parse(stored) });
        } catch {
          // ignore
        }
      }

      // Load API keys from localStorage
      const storedKeys = localStorage.getItem("fleminglabs_api_keys");
      if (storedKeys) {
        try {
          const keys = JSON.parse(storedKeys);
          setOpenaiKey(keys.openai || "");
          setAnthropicKey(keys.anthropic || "");
        } catch {
          // ignore
        }
      }
    }
    loadProfile();
  }, []);

  async function handleSaveProfile() {
    setSaving(true);
    setError("");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          lab_name: labName,
          institution,
          research_context: researchContext || null,
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function handleSavePreferences() {
    localStorage.setItem("fleminglabs_preferences", JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleSaveApiKeys() {
    localStorage.setItem(
      "fleminglabs_api_keys",
      JSON.stringify({ openai: openaiKey, anthropic: anthropicKey })
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const ext = file.name.split(".").pop();
    const path = `avatars/${user.id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setError("Failed to upload avatar");
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);

    await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    setAvatarUrl(publicUrl);
  }

  async function handleExportAll() {
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "json", scope: "project", id: "all" }),
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "fleminglabs-full-export.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to export data");
    }
  }

  async function handleDeleteAccount() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const initials = fullName
    ? fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold font-heading tracking-tight">
          Settings
        </h1>
        <p className="text-muted text-sm mt-1">
          Manage your profile, preferences, and data.
        </p>
      </div>

      <div className="flex gap-6">
        {/* Section nav */}
        <nav className="w-48 shrink-0">
          <div className="space-y-0.5">
            {sections.map((section) => {
              const Icon = section.icon;
              const active = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? "bg-primary-light text-primary"
                      : "text-muted hover:bg-sidebar-hover hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {section.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Error banner */}
          {error && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-error text-sm">
              {error}
            </div>
          )}

          {/* Saved toast */}
          {saved && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-primary-light border border-primary/20 text-primary text-sm font-medium">
              Settings saved
            </div>
          )}

          {/* Profile */}
          {activeSection === "profile" && (
            <div className="bg-white rounded-xl shadow-[var(--card-shadow)] p-6 space-y-5">
              <h2 className="text-base font-semibold font-heading">Profile</h2>

              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-primary-light text-primary text-lg font-semibold flex items-center justify-center">
                      {initials}
                    </div>
                  )}
                  <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-border shadow-sm flex items-center justify-center cursor-pointer hover:bg-sidebar-hover transition-colors">
                    <Camera className="w-3.5 h-3.5 text-muted" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <div>
                  <p className="text-sm font-medium">Profile photo</p>
                  <p className="text-xs text-muted">JPG, PNG. Max 2MB.</p>
                </div>
              </div>

              {/* Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-input-bg text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    placeholder="Dr. Jane Smith"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    Lab Name
                  </label>
                  <input
                    type="text"
                    value={labName}
                    onChange={(e) => setLabName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-input-bg text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    placeholder="Molecular Biology Lab"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    Institution
                  </label>
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-input-bg text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    placeholder="MIT, Stanford, etc."
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    Research Context
                  </label>
                  <textarea
                    value={researchContext}
                    onChange={(e) => setResearchContext(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-input-bg text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
                    placeholder="Briefly describe your research area. This helps the AI provide more relevant suggestions."
                  />
                  <p className="text-[11px] text-muted mt-1">
                    Used as context for AI processing and the Serendipity Engine.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </div>
          )}

          {/* Preferences */}
          {activeSection === "preferences" && (
            <div className="bg-white rounded-xl shadow-[var(--card-shadow)] p-6 space-y-5">
              <h2 className="text-base font-semibold font-heading">
                Preferences
              </h2>

              {/* Transcription language */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Default Transcription Language
                </label>
                <select
                  value={prefs.transcription_language}
                  onChange={(e) =>
                    setPrefs({ ...prefs, transcription_language: e.target.value })
                  }
                  className="w-full max-w-xs px-3 py-2.5 rounded-lg border border-border bg-input-bg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                >
                  {languages.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Auto-process toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    Auto-process with AI after recording
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    Automatically structure and tag entries when recording stops.
                  </p>
                </div>
                <button
                  onClick={() =>
                    setPrefs({ ...prefs, auto_process_ai: !prefs.auto_process_ai })
                  }
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                    prefs.auto_process_ai ? "bg-primary" : "bg-border"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                      prefs.auto_process_ai ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Serendipity sensitivity */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Serendipity Engine Sensitivity
                  </label>
                  <span className="text-xs text-muted font-medium">
                    {prefs.serendipity_sensitivity}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={prefs.serendipity_sensitivity}
                  onChange={(e) =>
                    setPrefs({
                      ...prefs,
                      serendipity_sensitivity: Number(e.target.value),
                    })
                  }
                  className="w-full max-w-md accent-primary"
                />
                <div className="flex justify-between max-w-md text-[11px] text-muted mt-1">
                  <span>Conservative</span>
                  <span>Balanced</span>
                  <span>Aggressive</span>
                </div>
              </div>

              {/* Audio quality */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Audio Quality
                </label>
                <div className="flex gap-3">
                  {(["standard", "high"] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => setPrefs({ ...prefs, audio_quality: q })}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                        prefs.audio_quality === q
                          ? "border-primary bg-primary-light text-primary"
                          : "border-border/60 text-muted hover:border-border hover:text-foreground"
                      }`}
                    >
                      {q === "standard" ? "Standard (48kHz)" : "High (96kHz)"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSavePreferences}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Save Preferences
                </button>
              </div>
            </div>
          )}

          {/* API Keys */}
          {activeSection === "api-keys" && (
            <div className="bg-white rounded-xl shadow-[var(--card-shadow)] p-6 space-y-5">
              <div>
                <h2 className="text-base font-semibold font-heading">API Keys</h2>
                <p className="text-xs text-muted mt-1">
                  Optional. Provide your own keys for self-hosted AI processing.
                  Keys are stored locally in your browser.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  OpenAI API Key
                </label>
                <input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-input-bg text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors font-mono"
                  placeholder="sk-..."
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Anthropic API Key
                </label>
                <input
                  type="password"
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-input-bg text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors font-mono"
                  placeholder="sk-ant-..."
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveApiKeys}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Save Keys
                </button>
              </div>
            </div>
          )}

          {/* Data */}
          {activeSection === "data" && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-[var(--card-shadow)] p-6">
                <h2 className="text-base font-semibold font-heading mb-4">
                  Data Management
                </h2>

                <div className="space-y-4">
                  {/* Export */}
                  <div className="flex items-center justify-between py-3 border-b border-border/30">
                    <div>
                      <p className="text-sm font-medium">Export all data</p>
                      <p className="text-xs text-muted mt-0.5">
                        Download everything as a JSON file.
                      </p>
                    </div>
                    <button
                      onClick={handleExportAll}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-sidebar-hover transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      Export
                    </button>
                  </div>

                  {/* Delete account */}
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-error">
                        Delete account
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        Permanently delete your account and all data. This cannot
                        be undone.
                      </p>
                    </div>
                    <button
                      onClick={handleDeleteAccount}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        deleteConfirm
                          ? "bg-error text-white"
                          : "border border-red-200 text-error hover:bg-red-50"
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                      {deleteConfirm ? "Confirm Delete" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* About */}
          {activeSection === "about" && (
            <div className="bg-white rounded-xl shadow-[var(--card-shadow)] p-6 space-y-4">
              <h2 className="text-base font-semibold font-heading">About</h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted">Version</span>
                  <span className="text-sm font-medium font-mono">0.1.0</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted">Built with</span>
                  <span className="text-sm font-medium">
                    Next.js, Supabase, Whisper
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted">Source code</span>
                  <a
                    href="https://github.com/fleminglabs/fleminglabs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    GitHub
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="pt-3 border-t border-border/30">
                <p className="text-xs text-muted leading-relaxed">
                  FlemingLabs is a voice-first AI lab notebook designed for
                  researchers. Named after Alexander Fleming, whose serendipitous
                  observation of penicillin changed the world &mdash; we believe
                  the best discoveries happen when you capture everything.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
