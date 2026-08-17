import { useEffect, useMemo, useState } from "react";
import { TerminalSquare } from "lucide-react";

interface Line {
  prompt: string;
  cmd: string;
  out: string;
  tone: "dim" | "ok" | "mint";
}

const LINES: Line[] = [
  {
    prompt: "$",
    cmd: "gh auth status",
    out: "sandbox session · the assistant holds no GitHub credentials of its own",
    tone: "dim",
  },
  {
    prompt: "$",
    cmd: "gh api repos/Brent26/BWDAS",
    out: "200 OK · public · Python · branch main · 48 KB",
    tone: "mint",
  },
  {
    prompt: "✓",
    cmd: "access check",
    out: "BWDAS is reachable — private repos will appear once you add a token below",
    tone: "ok",
  },
];

/** Typewriter boot console — renders instantly for prefers-reduced-motion. */
export function ConsoleStrip() {
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const total = useMemo(
    () => LINES.reduce((acc, l) => acc + l.cmd.length + l.out.length, 0),
    []
  );
  const [n, setN] = useState(reduced ? total : 0);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      setN((v) => {
        if (v >= total) {
          window.clearInterval(id);
          return v;
        }
        return v + 3;
      });
    }, 22);
    return () => window.clearInterval(id);
  }, [reduced, total]);

  let budget = n;
  const done = n >= total;

  return (
    <div className="border-b border-ink-700/70 bg-ink-900/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2.5 lg:px-6">
        <TerminalSquare className="h-3.5 w-3.5 shrink-0 text-ember-400" aria-hidden />
        <div className="min-w-0 flex-1 space-y-0.5 font-mono text-[11.5px] leading-[1.55] sm:text-[12px]">
          {LINES.map((l, li) => {
            if (budget <= 0) return null;
            const cmdChars = Math.min(budget, l.cmd.length);
            budget -= l.cmd.length;
            const outChars = Math.max(0, Math.min(budget, l.out.length));
            budget -= l.out.length;
            const typingHere = !done && (cmdChars < l.cmd.length || outChars < l.out.length);
            return (
              <div key={li} className="flex flex-wrap items-baseline gap-x-2 whitespace-pre-wrap">
                <span className={l.prompt === "✓" ? "text-mint-400" : "text-ink-500"}>{l.prompt}</span>
                <span className="text-ink-100">
                  {l.cmd.slice(0, cmdChars)}
                  {typingHere && cmdChars < l.cmd.length && (
                    <span className="caret text-ember-400">▍</span>
                  )}
                </span>
                {cmdChars >= l.cmd.length && (
                  <span
                    className={
                      l.tone === "mint"
                        ? "text-mint-400"
                        : l.tone === "ok"
                          ? "text-ember-300"
                          : "text-ink-400"
                    }
                  >
                    <span className="mr-2 text-ink-600">→</span>
                    {l.out.slice(0, outChars)}
                    {typingHere && cmdChars >= l.cmd.length && outChars < l.out.length && (
                      <span className="caret text-ember-400">▍</span>
                    )}
                  </span>
                )}
              </div>
            );
          })}
          {done && (
            <div className="flex items-baseline gap-2">
              <span className="text-ink-500">$</span>
              <span className="caret text-ember-400">▍</span>
            </div>
          )}
        </div>
        <span className="hidden shrink-0 items-center gap-1.5 rounded border border-mint-600/40 bg-mint-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-mint-300 md:inline-flex">
          <span className="dot-live h-1.5 w-1.5 rounded-full bg-mint-400" />
          repo reachable
        </span>
      </div>
    </div>
  );
}
