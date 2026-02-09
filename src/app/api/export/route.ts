import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { ENTRY_TYPE_LABELS } from "@/lib/types";
import type { ExportFormat, ExportScope, Entry } from "@/lib/types";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const format = body.format as ExportFormat;
  const scope = body.scope as ExportScope;
  const id = body.id as string;

  if (!format || !scope || !id) {
    return NextResponse.json(
      { error: "Missing format, scope, or id" },
      { status: 400 }
    );
  }

  let entries: Entry[] = [];
  let title = "FlemingLabs Export";

  if (scope === "entry") {
    const { data } = await supabase
      .from("entries")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id);
    entries = (data as Entry[]) || [];
    title = entries[0]?.title || "Entry Export";
  } else if (scope === "session") {
    const { data: session } = await supabase
      .from("sessions")
      .select("title")
      .eq("id", id)
      .single();

    const { data } = await supabase
      .from("entries")
      .select("*")
      .eq("session_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    entries = (data as Entry[]) || [];
    title = session?.title || "Session Export";
  } else if (scope === "collection") {
    const { data: collectionEntries } = await supabase
      .from("collection_entries")
      .select("entry_id")
      .eq("collection_id", id);

    const entryIds = (collectionEntries || []).map((ce) => ce.entry_id);

    if (entryIds.length > 0) {
      const { data } = await supabase
        .from("entries")
        .select("*")
        .in("id", entryIds)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      entries = (data as Entry[]) || [];
    }

    const { data: collection } = await supabase
      .from("collections")
      .select("name")
      .eq("id", id)
      .single();

    title = collection?.name || "Collection Export";
  } else if (scope === "project") {
    const { data } = await supabase
      .from("entries")
      .select("*")
      .eq("project_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    entries = (data as Entry[]) || [];

    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", id)
      .single();

    title = project?.name || "Project Export";
  }

  if (format === "markdown") {
    return buildMarkdown(entries, title);
  }
  if (format === "json") {
    return buildJson(entries, title);
  }
  if (format === "csv") {
    return buildCsv(entries, title);
  }
  if (format === "pdf") {
    return buildPdfHtml(entries, title);
  }

  return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
}

function buildMarkdown(entries: Entry[], title: string) {
  const lines: string[] = [
    `# ${title}`,
    `\nExported: ${new Date().toISOString()}\n`,
    `---\n`,
  ];

  for (const entry of entries) {
    const heading = entry.title || ENTRY_TYPE_LABELS[entry.entry_type] || entry.entry_type;
    lines.push(`## ${heading}`);
    lines.push(`**Type:** ${ENTRY_TYPE_LABELS[entry.entry_type] || entry.entry_type}`);
    lines.push(`**Date:** ${new Date(entry.created_at).toLocaleString()}`);
    if (entry.tags.length > 0) {
      lines.push(`**Tags:** ${entry.tags.join(", ")}`);
    }
    lines.push("");
    lines.push(entry.content || "");
    lines.push("");
    if (entry.raw_transcript) {
      lines.push(`> **Raw transcript:** ${entry.raw_transcript}`);
      lines.push("");
    }
    lines.push("---\n");
  }

  lines.push(`\n_Exported from FlemingLabs_`);

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugify(title)}.md"`,
    },
  });
}

function buildJson(entries: Entry[], title: string) {
  const output = {
    title,
    exported_at: new Date().toISOString(),
    entry_count: entries.length,
    entries: entries.map((e) => ({
      id: e.id,
      type: e.entry_type,
      title: e.title,
      content: e.content,
      raw_transcript: e.raw_transcript,
      tags: e.tags,
      metadata: e.metadata,
      created_at: e.created_at,
      updated_at: e.updated_at,
    })),
  };

  return new Response(JSON.stringify(output, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugify(title)}.json"`,
    },
  });
}

function buildCsv(entries: Entry[], title: string) {
  const headers = [
    "id",
    "type",
    "title",
    "content",
    "raw_transcript",
    "tags",
    "created_at",
    "updated_at",
  ];
  const rows = entries.map((e) =>
    [
      e.id,
      e.entry_type,
      csvEscape(e.title || ""),
      csvEscape(e.content || ""),
      csvEscape(e.raw_transcript || ""),
      e.tags.join("; "),
      e.created_at,
      e.updated_at,
    ].join(",")
  );

  return new Response([headers.join(","), ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugify(title)}.csv"`,
    },
  });
}

function buildPdfHtml(entries: Entry[], title: string) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${esc(title)}</title>
  <style>
    body { font-family: 'Georgia', serif; max-width: 700px; margin: 40px auto; color: #1a2e1a; line-height: 1.6; }
    h1 { color: #2D5A3D; border-bottom: 2px solid #2D5A3D; padding-bottom: 8px; }
    .entry { margin: 24px 0; padding: 16px; border: 1px solid #d4dcd4; border-radius: 8px; }
    .entry-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
    .entry-type { font-size: 12px; font-weight: 600; color: #2D5A3D; text-transform: uppercase; letter-spacing: 0.5px; }
    .entry-date { font-size: 12px; color: #6b7c6b; }
    .entry-content { margin-top: 8px; }
    .tags { margin-top: 8px; font-size: 12px; color: #6b7c6b; }
    .transcript { margin-top: 8px; padding: 8px; background: #f0f2ee; border-radius: 4px; font-size: 13px; font-style: italic; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #d4dcd4; font-size: 12px; color: #6b7c6b; text-align: center; }
    .signature { margin-top: 40px; border-top: 1px solid #1a2e1a; width: 200px; padding-top: 4px; font-size: 12px; }
  </style>
</head>
<body>
  <h1>${esc(title)}</h1>
  <p style="color: #6b7c6b; font-size: 14px;">Lab Notebook Export &mdash; ${new Date().toLocaleDateString()}</p>

  ${entries
    .map(
      (e) => `
  <div class="entry">
    ${e.title ? `<div class="entry-title">${esc(e.title)}</div>` : ""}
    <div class="entry-type">${esc(ENTRY_TYPE_LABELS[e.entry_type] || e.entry_type)}</div>
    <div class="entry-date">${new Date(e.created_at).toLocaleString()}</div>
    <div class="entry-content">${esc(e.content || "")}</div>
    ${e.tags.length > 0 ? `<div class="tags">Tags: ${e.tags.map((t) => esc(t)).join(", ")}</div>` : ""}
    ${e.raw_transcript ? `<div class="transcript">${esc(e.raw_transcript)}</div>` : ""}
  </div>`
    )
    .join("\n")}

  <div class="signature">
    <p>Researcher Signature: ________________________</p>
    <p>Date: ${new Date().toLocaleDateString()}</p>
  </div>

  <div class="footer">
    Exported from FlemingLabs &mdash; Voice-First AI Lab Notebook
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugify(title)}.html"`,
    },
  });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
