import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";

export function CodeBlock({ code, filename, accentHex = "#e0a83f" }: { code: string; filename: string; accentHex?: string }) {
  const [copied, setCopied] = useState(false);
  const lines = useMemo(() => code.replace(/\n$/, "").split("\n"), [code]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-bw-line bg-bw-900">
      <div className="flex items-center gap-2 border-b border-bw-line bg-bw-800/80 px-3.5 py-2">
        <span className="h-2 w-2 rounded-full" style={{ background: accentHex }} />
        <span className="truncate font-mono text-[11.5px] text-sand-300">{filename}</span>
        <span className="ml-auto font-mono text-[10px] text-sand-600">{lines.length} lines</span>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded border border-bw-line bg-bw-750 px-2 py-0.5 font-mono text-[10.5px] text-sand-300 transition-all hover:border-ochre-500/60 hover:text-ochre-300 active:scale-95"
        >
          {copied ? <Check className="h-3 w-3 text-ok" /> : <Copy className="h-3 w-3" />}
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <div className="max-h-[440px] overflow-auto">
        <pre className="min-w-max py-2.5 font-mono text-[12px] leading-[1.55]">
          {lines.map((line, i) => (
            <div key={i} className="flex hover:bg-bw-800/60">
              <span className="w-11 shrink-0 select-none pr-3 text-right text-sand-600">{i + 1}</span>
              <span className="whitespace-pre pr-6 text-sand-200">{line.length === 0 ? " " : line}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
