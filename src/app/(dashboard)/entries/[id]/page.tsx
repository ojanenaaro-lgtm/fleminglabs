import { notFound } from "next/navigation";
import { fetchEntry } from "../actions";
import { EntryDetail } from "./entry-detail";

export default async function EntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entry = await fetchEntry(id);

  if (!entry) notFound();

  return <EntryDetail entry={entry} />;
}
