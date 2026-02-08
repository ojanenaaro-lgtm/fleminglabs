// Upload audio blobs to Supabase Storage and link to entries

import { createClient } from "./supabase";

const BUCKET = "recordings";

export async function uploadAudio(
  audioBlob: Blob,
  sessionId: string,
  entryId: string
): Promise<{ path: string; signedUrl: string }> {
  const supabase = createClient();
  const ext = audioBlob.type.includes("webm") ? "webm" : "ogg";
  const path = `${sessionId}/${entryId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, audioBlob, {
      contentType: audioBlob.type,
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Audio upload failed: ${uploadError.message}`);
  }

  const { data: urlData, error: urlError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days

  if (urlError || !urlData?.signedUrl) {
    throw new Error(`Failed to create signed URL: ${urlError?.message}`);
  }

  return { path, signedUrl: urlData.signedUrl };
}

export async function linkAudioToEntry(
  entryId: string,
  audioUrl: string
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("entries")
    .update({ audio_url: audioUrl })
    .eq("id", entryId);

  if (error) {
    throw new Error(`Failed to link audio to entry: ${error.message}`);
  }
}

/**
 * Upload audio and link it to an entry in one call.
 * If transcription has failed, still saves the audio.
 */
export async function saveAudioForEntry(
  audioBlob: Blob,
  sessionId: string,
  entryId: string
): Promise<string> {
  const { signedUrl } = await uploadAudio(audioBlob, sessionId, entryId);
  await linkAudioToEntry(entryId, signedUrl);
  return signedUrl;
}

export async function getSignedPlaybackUrl(path: string): Promise<string> {
  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60); // 1 hour

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to get playback URL: ${error?.message}`);
  }

  return data.signedUrl;
}
