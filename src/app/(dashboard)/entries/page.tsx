import { fetchEntries, fetchSessions, fetchAllTags, fetchCollections } from "./actions";
import { EntriesTable } from "./entries-table";

export default async function EntriesPage() {
  const [result, sessions, allTags, collections] = await Promise.all([
    fetchEntries({ page: 1, perPage: 20 }),
    fetchSessions(),
    fetchAllTags(),
    fetchCollections(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold font-heading tracking-tight">
            Entries
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {result.total} total entr{result.total === 1 ? "y" : "ies"} across
            all sessions
          </p>
        </div>
        <a
          href="/entries/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          New Entry
        </a>
      </div>

      <EntriesTable
        initialData={result}
        sessions={sessions}
        allTags={allTags}
        collections={collections}
      />
    </div>
  );
}
