export type Profile = {
  id: string;
  full_name: string | null;
  lab_name: string | null;
  institution: string | null;
  role: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type Project = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  ai_context: string | null;
  created_at: string;
  updated_at: string;
};

export type Session = {
  id: string;
  project_id: string;
  user_id: string;
  title: string | null;
  duration_seconds: number;
  started_at: string;
  ended_at: string | null;
  status: "active" | "paused" | "completed" | "processing";
};

export type EntryType =
  | "voice_note"
  | "observation"
  | "measurement"
  | "protocol_step"
  | "annotation"
  | "hypothesis"
  | "anomaly"
  | "idea";

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  voice_note: "Voice Note",
  observation: "Observation",
  measurement: "Measurement",
  protocol_step: "Protocol Step",
  annotation: "Annotation",
  hypothesis: "Hypothesis",
  anomaly: "Anomaly",
  idea: "Idea",
};

export type Entry = {
  id: string;
  session_id: string;
  project_id: string;
  user_id: string;
  entry_type: EntryType;
  title: string | null;
  content: string | null;
  raw_transcript: string | null;
  audio_url: string | null;
  metadata: Record<string, unknown>;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type Connection = {
  id: string;
  source_entry_id: string;
  target_entry_id: string;
  connection_type: ConnectionType;
  reasoning: string | null;
  confidence: number | null;
  status: ConnectionStatus;
  created_at: string;
};

export type Collection = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export type CollectionEntry = {
  collection_id: string;
  entry_id: string;
};

// ── AI Processing Pipeline ──────────────────────────────────────────────

export type Tag = {
  label: string;
  category?: "method" | "organism" | "compound" | "equipment" | "custom";
};

export type StructuredEntry = {
  entry_type: EntryType;
  content: string;
  tags: string[];
  metadata: Record<string, unknown>;
};

export type ProcessRequest = {
  transcript: string;
  tags: Tag[];
  projectContext?: string;
};

export type ProcessResponse = {
  summary: string;
  structured_entries: StructuredEntry[];
  suggested_tags: Tag[];
  potential_connections: {
    reasoning: string;
    related_concept: string;
  }[];
};

export type ConnectionType =
  | "pattern"
  | "contradiction"
  | "supports"
  | "reminds_of"
  | "same_phenomenon"
  | "literature_link";

export type ConnectionSuggestion = {
  source_entry_id: string;
  target_entry_id: string;
  type: ConnectionType;
  reasoning: string;
  confidence: number;
};

export type ConnectionsRequest = {
  entry_id: string;
  content: string;
};

export type ConnectionsResponse = {
  connections: ConnectionSuggestion[];
};

export type LiteratureRequest = {
  query: string;
  context: string;
};

export type LiteratureResult = {
  title: string;
  authors: string[];
  abstract: string;
  pmid: string;
  relevance_reasoning: string;
};

// ── Speech-to-Text Pipeline ─────────────────────────────────────────────

export type TranscriptTag =
  | "observation"
  | "measurement"
  | "protocol_step"
  | "hypothesis"
  | "anomaly"
  | "idea";

export type TranscriptSegment = {
  id: string;
  text: string;
  timestamp: number; // ms since recording started
  isFinal: boolean;
  confidence: number; // 0–1
  tag?: TranscriptTag;
};

// ── Search ──────────────────────────────────────────────────────────────

export type SearchResultType = "entry" | "session" | "project" | "connection";

export type SearchResult = {
  id: string;
  result_type: SearchResultType;
  title: string;
  snippet: string;
  relevance: number;
  created_at: string;
  parent_id: string | null;
};

// ── Export ───────────────────────────────────────────────────────────────

export type ExportFormat = "markdown" | "json" | "csv" | "pdf";
export type ExportScope = "entry" | "session" | "collection" | "project";

// ── User Preferences ────────────────────────────────────────────────────

export type UserPreferences = {
  transcription_language: string;
  auto_process_ai: boolean;
  serendipity_sensitivity: number; // 0–100
  audio_quality: "standard" | "high";
};

// ── Serendipity Engine (Connection UI) ──────────────────────────────────

export type ConnectionStatus = "pending" | "confirmed" | "dismissed";

export type ConnectionWithEntries = {
  id: string;
  source_entry_id: string;
  target_entry_id: string;
  connection_type: ConnectionType;
  reasoning: string | null;
  confidence: number;
  created_at: string;
  status: ConnectionStatus;
  source_entry: Entry;
  target_entry: Entry;
};

// ── AI Research Companion (Real-time) ─────────────────────────────────

export type CompanionDetectedType =
  | "pattern"
  | "anomaly"
  | "connection"
  | "suggestion"
  | "clarification"
  | null;

export type CompanionResponse = {
  skip: boolean;
  message: string;
  detected_type: CompanionDetectedType;
  suggested_connections?: {
    entry_id: string;
    reasoning: string;
  }[];
};

export type CompanionMessage = {
  id: string;
  message: string;
  detected_type: CompanionDetectedType;
  timestamp: number;
  suggested_connections?: {
    entry_id: string;
    reasoning: string;
  }[];
};

