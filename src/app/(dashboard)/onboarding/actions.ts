"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function saveOnboardingProfile(formData: {
  full_name: string;
  lab: string;
  institution: string;
  research_focus: string;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  // Update the profiles table
  await supabase.from("profiles").upsert({
    id: user.id,
    full_name: formData.full_name,
    lab: formData.lab,
    institution: formData.institution,
    research_focus: formData.research_focus,
    updated_at: new Date().toISOString(),
  });

  // Also store research_focus in user metadata for quick access
  await supabase.auth.updateUser({
    data: {
      full_name: formData.full_name,
      research_focus: formData.research_focus,
    },
  });
}

export async function completeOnboarding() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  await supabase.auth.updateUser({
    data: {
      onboarding_completed: true,
    },
  });
}
