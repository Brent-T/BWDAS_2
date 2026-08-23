import { useState } from "react";
import {
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Trash2,
  X,
} from "lucide-react";

interface Props {
  token: string | null;
  onTokenChange: (token: string | null) => void;
  verifiedUser: string | null;
  checking: boolean;
  visibleCount: number | null;
  publicCount: number | null;
}

function Row({
  icon,
  tone,
  title,
  body,
}: {
  icon: React.ReactNode;
  tone: "ok" | "warn" | "no";
  title: string;
  body: string;
}) {
  const toneCls =
    tone === "ok"
      ? "border-mint-600/50 bg-mint-500/10 text-mint-300"
      : tone === "warn"
        ? "border-ember-500/50 bg-ember-500/10 text-ember-300"
        : "border-rust-500/50 bg-rust-500/10 text-rust-400";
  return (
    <li className="flex gap-2.5 py-2">
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${toneCls}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold text-ink-100">{title}</p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-ink-400">{body}</p>
      </div>
    </li>
  );
}

export function AccessPanel({ token, onTokenChange, verifiedUser, checking, visibleCount, publicCount }: Props) {
  const [draft, setDraft] = useState("");
  const [show, setShow] = useState(false);

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center gap-2 border-b border-ink-700/70 px-3.5 py-2.5">
        <KeyRound className="h-3.5 w-3.5 text-ember-400" />
        <h2 className="panel-title">Access & visibility</h2>
      </div>

      <div className="px-3.5">
        <p className="border-b border-ink-700/60 py-2.5 text-[11.5px] leading-relaxed text-ink-300">
          Why most of your repos don't show up: this sandbox never received your GitHub authorization — only{" "}
          <strong className="text-ink-100">public</strong> repos are readable by default. BWDAS is public, so it works
          today. A personal access token (kept <em>only</em> in this browser) unlocks the rest.
        </p>

        <ul className="divide-y divide-ink-700/50">
          <Row
            icon={<Check className="h-3 w-3" />}
            tone="ok"
            title="Brent26/BWDAS — verified"
            body="Confirmed public via the GitHub API: Python, branch main, 48 KB."
          />
          <Row
            icon={<Check className="h-3 w-3" />}
            tone="ok"
            title={`Public repos — ${publicCount ?? "…"} visible`}
            body="Readable right now with no token, at 60 API calls/hr."
          />
          <Row
            icon={<Lock className="h-3 w-3" />}
            tone="warn"
            title="Private repos — hidden"
            body="Add a classic PAT with the repo scope and they appear instantly (5,000 calls/hr)."
          />
          <Row
            icon={<X className="h-3 w-3" />}
            tone="no"
            title="Pushing commits — not from here"
            body="This bench is read-only. We edit files here; you sync them back with git on your machine."
          />
        </ul>
      </div>

      <div className="space-y-2 border-t border-ink-700/70 bg-ink-900/50 px-3.5 py-3">
        {token ? (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-mono text-[12px] text-mint-300">
                <span className="dot-live h-1.5 w-1.5 rounded-full bg-mint-400" />
                token active {verifiedUser ? `· ${verifiedUser}` : ""}
              </p>
              <p className="mt-0.5 font-mono text-[10.5px] text-ink-500">
                {visibleCount !== null ? `${visibleCount} repos visible` : "checking scope…"} · stored in this browser
                only
              </p>
            </div>
            <button
              onClick={() => {
                setDraft("");
                onTokenChange(null);
              }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-rust-500/50 bg-rust-500/10 px-2.5 py-1.5 font-mono text-[11px] text-rust-300 transition-all hover:bg-rust-500/20 active:scale-95"
            >
              <Trash2 className="h-3 w-3" /> remove
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-1.5">
              <div className="relative min-w-0 flex-1">
                <input
                  type={show ? "text" : "password"}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="ghp_… or github_pat_…"
                  spellCheck={false}
                  className="w-full rounded-md border border-ink-700 bg-ink-900 py-1.5 pl-2.5 pr-8 font-mono text-[12px] text-ink-100 placeholder:text-ink-600 outline-none transition-colors focus:border-ember-500/60 focus:ring-2 focus:ring-ember-500/15"
                />
                <button
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-500 transition-colors hover:text-ink-200"
                  aria-label={show ? "Hide token" : "Show token"}
                >
                  {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <button
                onClick={() => draft.trim() && onTokenChange(draft.trim())}
                disabled={!draft.trim() || checking}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-ember-500/60 bg-ember-500/15 px-3 py-1.5 font-mono text-[11px] font-medium text-ember-300 transition-all hover:bg-ember-500/25 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : <KeyRound className="h-3 w-3" />}
                connect
              </button>
            </div>
            <a
              href="https://github.com/settings/tokens/new?scopes=repo&description=BWDAS%20Workbench"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[10.5px] text-cobalt-300 underline decoration-cobalt-500/40 underline-offset-2 transition-colors hover:text-cobalt-200"
            >
              create a token with repo scope <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export function WorkflowCard() {
  const steps = [
    {
      t: "Browse the live repo",
      b: "Files, README and history on the right are the real contents of main.",
    },
    {
      t: "Tell me what to change",
      b: "Point at a file and describe the change — I rewrite it here in the sandbox.",
    },
    {
      t: "Sync back with git",
      b: "Copy the updated file into your clone, then commit & push from your machine.",
    },
  ];
  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-ink-700/70 px-3.5 py-2.5">
        <h2 className="panel-title">How we work on BWDAS</h2>
      </div>
      <ol className="px-3.5 py-3">
        {steps.map((s, i) => (
          <li key={i} className="group relative flex gap-3 pb-4 last:pb-0">
            {i < steps.length - 1 && (
              <span className="absolute left-[11px] top-7 h-[calc(100%-24px)] w-px bg-ink-700" aria-hidden />
            )}
            <span className="flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full border border-ember-500/50 bg-ember-500/10 font-mono text-[11px] font-bold text-ember-300 transition-colors group-hover:bg-ember-500/25">
              {i + 1}
            </span>
            <div>
              <p className="text-[12.5px] font-semibold text-ink-100">{s.t}</p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-ink-400">{s.b}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
