// In-memory transcript segment store for a recording session

import type { TranscriptSegment, TranscriptTag } from "./types";

export class TranscriptStore {
  private segments: Map<string, TranscriptSegment> = new Map();

  addSegment(segment: TranscriptSegment): void {
    this.segments.set(segment.id, segment);
  }

  updateSegment(
    id: string,
    patch: Partial<Pick<TranscriptSegment, "text" | "tag" | "isFinal" | "confidence">>
  ): TranscriptSegment | null {
    const existing = this.segments.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    this.segments.set(id, updated);
    return updated;
  }

  getSegment(id: string): TranscriptSegment | null {
    return this.segments.get(id) ?? null;
  }

  getAll(): TranscriptSegment[] {
    return Array.from(this.segments.values()).sort(
      (a, b) => a.timestamp - b.timestamp
    );
  }

  getByTimeRange(startMs: number, endMs: number): TranscriptSegment[] {
    return this.getAll().filter(
      (s) => s.timestamp >= startMs && s.timestamp <= endMs
    );
  }

  getByTag(tag: TranscriptTag): TranscriptSegment[] {
    return this.getAll().filter((s) => s.tag === tag);
  }

  clear(): void {
    this.segments.clear();
  }

  get size(): number {
    return this.segments.size;
  }

  // ── Export helpers ───────────────────────────────────────────────────

  exportAsText(): string {
    return this.getAll()
      .map((s) => {
        const time = formatTimestamp(s.timestamp);
        const tag = s.tag ? ` [${s.tag}]` : "";
        return `[${time}]${tag} ${s.text}`;
      })
      .join("\n");
  }

  exportAsJSON(): string {
    return JSON.stringify(this.getAll(), null, 2);
  }
}

// Format ms → "MM:SS"
function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export { formatTimestamp };
