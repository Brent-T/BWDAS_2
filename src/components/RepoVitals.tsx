import { formatDistanceStrict, parseISO } from "date-fns";
import type { RepoMeta } from "../lib/github";

const LANG_COLORS: Record<string, string> = {
  Python: "#4a7fd4",
  JavaScript: "#f7b955",
  TypeScript: "#6b9ce8",
  HTML: "#f26a50",
  CSS: "#55dda4",
  Shell: "#86ecc0",
  Jupyter: "#eda22f",
  Markdown: "#8399bb",
};

function ago(date: string): string {
  try {
    return formatDistanceStrict(parseISO(date), new Date(), { addSuffix: true });
  } catch {
    return date;
  }
}

function dateOnly(iso: string): string {
  try {
    return parseISO(iso).toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

interface Props {
  meta: RepoMeta | null;
  languages: Record<string, number> | null;
  commitCount: number | null;
}

export function RepoVitals({ meta, languages, commitCount }: Props) {
  const total = languages ? Object.values(languages).reduce((a, b) => a + b, 0) : 0;
  const langs = languages
    ? Object.entries(languages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    : [];

  const cells: { label: string; value: React.ReactNode }[] = meta
    ? [
        { label: "Language", value: meta.language ?? "—" },
        { label: "Branch", value: meta.default_branch },
        { label: "Size", value: `${meta.size} KB` },
        { label: "Created", value: dateOnly(meta.created_at) },
        { label: "Last push", value: ago(meta.pushed_at) },
        { label: "Commits", value: commitCount ?? "—" },
        { label: "Stars", value: meta.stargazers_count },
        { label: "Forks", value: meta.forks_count },
        { label: "Open issues", value: meta.open_issues_count },
      ]
    : [];

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-700/70 px-3.5 py-2.5">
        <h2 className="panel-title">Repo vitals</h2>
        {meta?.private ? (
          <span className="rounded border border-ember-500/50 bg-ember-500/10 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-widest text-ember-300">
            private
          </span>
        ) : (
          <span className="rounded border border-mint-600/50 bg-mint-500/10 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-widest text-mint-300">
            public
          </span>
        )}
      </div>

      {!meta ? (
        <div className="grid grid-cols-3 gap-px bg-ink-700/60">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="bg-ink-850 p-2.5">
              <div className="skeleton mb-1.5 h-2.5 w-12" />
              <div className="skeleton h-3.5 w-16" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-px bg-ink-700/60">
            {cells.map((c) => (
              <div key={c.label} className="group bg-ink-850 p-2.5 transition-colors hover:bg-ink-800">
                <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-500">{c.label}</div>
                <div className="mt-0.5 truncate font-mono text-[12.5px] text-ink-100 group-hover:text-ember-300 transition-colors">
                  {c.value}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-ink-700/70 px-3.5 py-3">
            {langs.length > 0 ? (
              <>
                <div className="flex h-2 overflow-hidden rounded-full bg-ink-700">
                  {langs.map(([name, bytes]) => (
                    <div
                      key={name}
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${Math.max(2, (bytes / total) * 100)}%`,
                        background: LANG_COLORS[name] ?? "#8399bb",
                      }}
                      title={`${name} — ${((bytes / total) * 100).toFixed(1)}%`}
                    />
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {langs.map(([name, bytes]) => (
                    <span key={name} className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-ink-300">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: LANG_COLORS[name] ?? "#8399bb" }}
                      />
                      {name} {((bytes / total) * 100).toFixed(0)}%
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="skeleton h-3 w-3/4" />
            )}
          </div>

          {meta.node_id && (
            <div className="border-t border-ink-700/70 bg-ink-900/50 px-3.5 py-2 font-mono text-[10px] text-ink-500">
              api id {meta.id} · node {meta.node_id}
            </div>
          )}
        </>
      )}
    </div>
  );
}
