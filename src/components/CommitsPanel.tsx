import { useState } from "react";
import { Check, Copy, GitCommitHorizontal, RefreshCw, UserRound } from "lucide-react";
import { formatDistanceStrict, parseISO } from "date-fns";
import type { CommitInfo } from "../lib/github";
import { shortSha } from "../lib/github";

interface Props {
  commits: CommitInfo[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

function ago(date: string): string {
  if (!date) return "";
  try {
    return formatDistanceStrict(parseISO(date), new Date(), { addSuffix: true });
  } catch {
    return date;
  }
}

export function CommitsPanel({ commits, loading, error, onRetry }: Props) {
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  const copy = async (sha: string) => {
    try {
      await navigator.clipboard.writeText(sha);
      setCopiedSha(sha);
      window.setTimeout(() => setCopiedSha(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="skeleton h-8 w-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-2/3" />
              <div className="skeleton h-3 w-2/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 p-10 text-center">
        <p className="max-w-sm font-mono text-[12.5px] text-rust-300">{error}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-md border border-rust-500/50 bg-rust-500/10 px-3 py-1.5 font-mono text-[12px] text-rust-300 transition-colors hover:bg-rust-500/20"
        >
          <RefreshCw className="h-3.5 w-3.5" /> retry
        </button>
      </div>
    );
  }

  if (!commits || commits.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 p-10 text-center">
        <GitCommitHorizontal className="h-6 w-6 text-ink-500" />
        <p className="font-mono text-[12.5px] text-ink-400">No commits found on this branch.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <ol className="relative ml-3 space-y-1 border-l border-ink-700">
        {commits.map((c) => {
          const [title, ...rest] = c.message.split("\n");
          return (
            <li key={c.sha} className="group relative pl-6 pr-2">
              <span className="absolute -left-[5px] top-4 h-[9px] w-[9px] rounded-full border-2 border-ink-850 bg-ink-500 transition-colors group-hover:border-ember-500 group-hover:bg-ember-400" />
              <div className="rounded-md px-3 py-2.5 transition-colors group-hover:bg-ink-800/60">
                <div className="flex items-start gap-3">
                  {c.avatarUrl ? (
                    <img
                      src={c.avatarUrl}
                      alt={c.authorName}
                      className="mt-0.5 h-7 w-7 shrink-0 rounded-full ring-1 ring-ink-600"
                      loading="lazy"
                    />
                  ) : (
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-700 ring-1 ring-ink-600">
                      <UserRound className="h-3.5 w-3.5 text-ink-300" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-ink-100" title={c.message}>
                      {title}
                    </p>
                    {rest.filter(Boolean).length > 0 && (
                      <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-ink-400">
                        {rest.join(" ").slice(0, 160)}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-ink-400">
                      <span className="text-ink-300">{c.authorLogin ?? c.authorName}</span>
                      <span className="text-ink-600">·</span>
                      <span>{ago(c.date)}</span>
                      <button
                        onClick={() => copy(c.sha)}
                        className="ml-auto inline-flex items-center gap-1 rounded border border-ink-700 bg-ink-900 px-1.5 py-0.5 text-[10.5px] text-cobalt-300 transition-all hover:border-cobalt-500/60 hover:text-cobalt-200 active:scale-95"
                        title="Copy full SHA"
                      >
                        {copiedSha === c.sha ? (
                          <>
                            <Check className="h-2.5 w-2.5 text-mint-400" /> copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-2.5 w-2.5" /> {shortSha(c.sha)}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
