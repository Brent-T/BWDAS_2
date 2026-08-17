import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink, FileWarning, MousePointerClick } from "lucide-react";
import type { FileContent } from "../lib/github";
import { decodeBase64, formatBytes } from "../lib/github";

/* ---- tiny regex highlighter ------------------------------------------------ */

interface LangSpec {
  re: RegExp;
  classes: string[]; // one class per capture group, in order
}

const COMMENT = "text-ink-500 italic";
const STRING = "text-mint-300";
const KEYWORD = "text-ember-400";
const NUMBER = "text-cobalt-300";

function spec(ext: string): LangSpec | null {
  if (["py", "pyw"].includes(ext)) {
    return {
      re: new RegExp(
        [
          "(#.*)",
          String.raw`("""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')`,
          "\\b(def|class|import|from|return|if|elif|else|for|while|in|not|and|or|None|True|False|try|except|finally|with|as|pass|break|continue|lambda|yield|raise|global|nonlocal|assert|del|is|async|await|self|print)\\b",
          "\\b(\\d+(?:\\.\\d+)?)\\b",
        ].join("|"),
        "g"
      ),
      classes: [COMMENT, STRING, KEYWORD, NUMBER],
    };
  }
  if (["js", "jsx", "ts", "tsx", "mjs", "cjs"].includes(ext)) {
    return {
      re: new RegExp(
        [
          "(//.*|/\\*[\\s\\S]*?(?:\\*/|$))",
          "(\\x60(?:\\\\.|[^\\x60\\\\\\n])*\\x60|\"(?:\\\\.|[^\"\\\\\\n])*\"|'(?:\\\\.|[^'\\\\\\n])*')",
          "\\b(const|let|var|function|return|if|else|for|while|import|export|from|class|new|this|typeof|instanceof|null|undefined|true|false|async|await|try|catch|finally|throw|switch|case|break|continue|default|of|in|do|yield|static|extends|super|interface|type)\\b",
          "\\b(\\d+(?:\\.\\d+)?)\\b",
        ].join("|"),
        "g"
      ),
      classes: [COMMENT, STRING, KEYWORD, NUMBER],
    };
  }
  if (ext === "json") {
    return {
      re: new RegExp(
        [
          String.raw`("(?:\\.|[^"\\])*")(\s*:)`,
          String.raw`("(?:\\.|[^"\\])*")`,
          "\\b(true|false|null)\\b",
          "(-?\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b)",
        ].join("|"),
        "g"
      ),
      classes: ["text-cobalt-300", STRING, KEYWORD, NUMBER],
    };
  }
  if (["sh", "bash", "zsh"].includes(ext)) {
    return {
      re: new RegExp(
        [
          "(#.*)",
          String.raw`("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')`,
          "\\b(if|then|else|elif|fi|for|do|done|while|case|esac|function|echo|export|local|return|exit|source|cd|sudo|git|python3?|pip3?)\\b",
          "\\b(\\d+(?:\\.\\d+)?)\\b",
        ].join("|"),
        "g"
      ),
      classes: [COMMENT, STRING, KEYWORD, NUMBER],
    };
  }
  return null;
}

function highlightLine(line: string, langSpec: LangSpec | null): React.ReactNode {
  if (!langSpec) return line;
  const re = new RegExp(langSpec.re.source, "g");
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    // find which group matched (skip group-1 quirks for json keys)
    let cls = "";
    for (let g = 1; g < m.length; g++) {
      if (m[g] !== undefined) {
        cls = langSpec.classes[g - 1] ?? "";
        break;
      }
    }
    out.push(
      <span key={k++} className={cls}>
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

/* ---- component -------------------------------------------------------------- */

interface Props {
  path: string | null;
  file: FileContent | null;
  loading: boolean;
  githubUrl?: string;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

export function CodeViewer({ path, file, loading, githubUrl }: Props) {
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => {
    if (!file || file.content === null) return null;
    try {
      return decodeBase64(file.content);
    } catch {
      return null;
    }
  }, [file]);

  const ext = useMemo(() => (path ? (path.split(".").pop() ?? "").toLowerCase() : ""), [path]);
  const langSpec = useMemo(() => spec(ext), [ext]);

  const lines = useMemo(() => (text === null ? [] : text.replace(/\n$/, "").split("\n")), [text]);
  const specRef = useMemo(() => langSpec, [langSpec]);

  const handleCopy = async () => {
    if (text === null) return;
    const ok = await copyText(text);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  };

  if (!path) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
        <MousePointerClick className="h-7 w-7 text-ink-500" />
        <p className="font-display text-[15px] font-semibold text-ink-200">Pick a file from the tree</p>
        <p className="max-w-xs text-[13px] leading-relaxed text-ink-400">
          Every file is fetched live from the <span className="font-mono text-[12px] text-mint-400">main</span> branch
          of Brent26/BWDAS via the GitHub contents API.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-700/70 bg-ink-900/60 px-3.5 py-2">
        <span className="min-w-0 truncate font-mono text-[12.5px]">
          <span className="text-ink-400">BWDAS/</span>
          <span className="text-ember-300">{path}</span>
        </span>
        <span className="rounded border border-ink-700 bg-ink-800 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-400">
          {ext || "txt"}
        </span>
        {file && <span className="font-mono text-[10.5px] text-ink-500">{formatBytes(file.size)}</span>}
        <span className="ml-auto flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            disabled={text === null}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-800 px-2.5 py-1 font-mono text-[11px] text-ink-200 transition-all hover:border-ember-500/50 hover:text-ember-300 active:scale-[0.97] disabled:opacity-40"
          >
            {copied ? <Check className="h-3 w-3 text-mint-400" /> : <Copy className="h-3 w-3" />}
            {copied ? "copied" : "copy"}
          </button>
          {githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-800 px-2.5 py-1 font-mono text-[11px] text-ink-200 transition-all hover:border-cobalt-500/50 hover:text-cobalt-300 active:scale-[0.97]"
            >
              <ExternalLink className="h-3 w-3" />
              github
            </a>
          )}
        </span>
      </div>

      {/* body */}
      <div className="min-h-0 flex-1 overflow-auto">
        {loading && (
          <div className="space-y-2.5 p-4">
            {[88, 64, 92, 45, 78, 70, 52, 83, 60].map((w, i) => (
              <div key={i} className="skeleton h-3.5" style={{ width: `${w}%` }} />
            ))}
          </div>
        )}

        {!loading && text === null && (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <FileWarning className="h-6 w-6 text-rust-400" />
            <p className="font-mono text-[12.5px] text-ink-300">
              Binary or oversized file — GitHub withholds inline content above 1 MB.
            </p>
            {githubUrl && (
              <a
                href={githubUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[12px] text-cobalt-300 underline underline-offset-2 hover:text-cobalt-200"
              >
                Open it on GitHub ↗
              </a>
            )}
          </div>
        )}

        {!loading && text !== null && (
          <pre className="min-w-max py-3 font-mono text-[12.5px] leading-[1.6]">
            {lines.map((line, i) => (
              <div key={i} className="flex hover:bg-ink-800/50">
                <span className="w-12 shrink-0 select-none pr-4 text-right text-ink-600">{i + 1}</span>
                <span className="whitespace-pre pr-6 text-ink-100">
                  {line.length === 0 ? " " : highlightLine(line, specRef)}
                </span>
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
}
