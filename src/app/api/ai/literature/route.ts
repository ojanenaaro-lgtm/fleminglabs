import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";
import {
  LITERATURE_RELEVANCE_SYSTEM,
  buildLiteratureUserPrompt,
} from "@/lib/prompts";
import { generateText } from "@/lib/ai";
import type { LiteratureRequest, LiteratureResult } from "@/lib/types";

// ── PubMed E-Utilities helpers ──────────────────────────────────────────

const PUBMED_SEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const PUBMED_FETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";

async function searchPubMed(query: string): Promise<string[]> {
  const params = new URLSearchParams({
    db: "pubmed",
    term: query,
    retmax: "5",
    retmode: "json",
    sort: "relevance",
  });

  const res = await fetch(`${PUBMED_SEARCH_URL}?${params}`);
  if (!res.ok) throw new Error(`PubMed search failed: ${res.status}`);

  const data = await res.json();
  return data.esearchresult?.idlist ?? [];
}

type PubMedArticle = {
  pmid: string;
  title: string;
  authors: string[];
  abstract: string;
};

async function fetchPubMedDetails(pmids: string[]): Promise<PubMedArticle[]> {
  if (pmids.length === 0) return [];

  const params = new URLSearchParams({
    db: "pubmed",
    id: pmids.join(","),
    retmode: "xml",
    rettype: "abstract",
  });

  const res = await fetch(`${PUBMED_FETCH_URL}?${params}`);
  if (!res.ok) throw new Error(`PubMed fetch failed: ${res.status}`);

  const xml = await res.text();
  return parsePubMedXml(xml);
}

function parsePubMedXml(xml: string): PubMedArticle[] {
  const articles: PubMedArticle[] = [];

  // Split by article boundaries
  const articleMatches = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g);
  if (!articleMatches) return [];

  for (const articleXml of articleMatches) {
    const pmid =
      articleXml.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1] ?? "";

    const title =
      articleXml
        .match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)?.[1]
        ?.replace(/<[^>]+>/g, "")
        .trim() ?? "";

    // Extract authors
    const authorMatches = articleXml.match(
      /<Author[\s\S]*?<\/Author>/g
    );
    const authors: string[] = [];
    if (authorMatches) {
      for (const author of authorMatches) {
        const lastName = author.match(/<LastName>(.*?)<\/LastName>/)?.[1] ?? "";
        const initials =
          author.match(/<Initials>(.*?)<\/Initials>/)?.[1] ?? "";
        if (lastName) authors.push(`${lastName} ${initials}`.trim());
      }
    }

    // Extract abstract text
    const abstractParts = articleXml.match(
      /<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g
    );
    let abstractText = "";
    if (abstractParts) {
      abstractText = abstractParts
        .map((part) => {
          const label = part.match(/Label="([^"]*)"/)?.[1];
          const text = part
            .replace(/<AbstractText[^>]*>/, "")
            .replace(/<\/AbstractText>/, "")
            .replace(/<[^>]+>/g, "")
            .trim();
          return label ? `${label}: ${text}` : text;
        })
        .join(" ");
    }

    articles.push({ pmid, title, authors, abstract: abstractText });
  }

  return articles;
}

// ── Route Handler ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 5 requests per minute (PubMed has its own limits)
  const { success } = rateLimit(`literature:${user.id}`, {
    maxRequests: 5,
    windowMs: 60_000,
  });
  if (!success) {
    return Response.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429 }
    );
  }

  // Validate body
  let body: LiteratureRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.query || !body.context) {
    return Response.json(
      { error: "Missing required fields: query, context" },
      { status: 400 }
    );
  }

  try {
    // Step 1: Search PubMed
    const pmids = await searchPubMed(body.query);
    if (pmids.length === 0) {
      return Response.json({ papers: [] });
    }

    // Step 2: Fetch article details
    const articles = await fetchPubMedDetails(pmids);
    if (articles.length === 0) {
      return Response.json({ papers: [] });
    }

    // Step 3: Assess relevance via AI
    const userPrompt = buildLiteratureUserPrompt(
      body.context,
      articles.map((a) => ({
        pmid: a.pmid,
        title: a.title,
        abstract: a.abstract,
      }))
    );

    const responseText = await generateText(
      LITERATURE_RELEVANCE_SYSTEM,
      userPrompt,
      2048
    );

    let relevanceData: { papers: { pmid: string; relevance_reasoning: string }[] };
    try {
      relevanceData = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        relevanceData = JSON.parse(match[1]);
      } else {
        throw new Error("Failed to parse relevance assessment");
      }
    }

    // Merge article details with relevance reasoning
    const papers: LiteratureResult[] = articles.map((article) => {
      const relevance = relevanceData.papers.find(
        (p) => p.pmid === article.pmid
      );
      return {
        pmid: article.pmid,
        title: article.title,
        authors: article.authors,
        abstract: article.abstract,
        relevance_reasoning:
          relevance?.relevance_reasoning ?? "No relevance assessment available.",
      };
    });

    return Response.json({ papers });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Literature search failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
