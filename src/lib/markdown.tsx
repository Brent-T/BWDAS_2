import type { ReactNode } from "react";

/* Minimal, dependency-free Markdown renderer tuned for GitHub READMEs:
   headings, fenced code, lists, quotes, hr, bold, inline code, links. */

const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g;

function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      out.push(
        <code
          key={`${keyBase}-c${i}`}
          className="rounded bg-ink-750 border border-ink-600/60 px-1.5 py-0.5 font-mono text-[0.85em] text-ember-300"
        >
          {m[1].slice(1, -1)}
        </code>
      );
    } else if (m[2]) {
      out.push(
        <strong key={`${keyBase}-b${i}`} className="font-semibold text-ink-50">
          {m[2].slice(2, -2)}
        </strong>
      );
    } else if (m[3]) {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(m[3]);
      if (mm) {
        out.push(
          <a
            key={`${keyBase}-a${i}`}
            href={mm[2]}
            target="_blank"
            rel="noreferrer"
            className="text-cobalt-300 underline decoration-cobalt-500/50 underline-offset-2 hover:text-cobalt-200 hover:decoration-cobalt-300 transition-colors"
          >
            {mm[1]}
          </a>
        );
      }
    }
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className = "" }: { source: string; className?: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push(
        <div key={key++} className="my-4 overflow-hidden rounded-md border border-ink-700 bg-ink-900">
          {lang && (
            <div className="border-b border-ink-700 bg-ink-800/70 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-400">
              {lang}
            </div>
          )}
          <pre className="overflow-x-auto p-3.5 font-mono text-[12.5px] leading-relaxed text-ink-100">
            {buf.join("\n")}
          </pre>
        </div>
      );
      continue;
    }

    // headings
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const content = renderInline(h[2], `h${key}`);
      if (level === 1)
        blocks.push(
          <h1 key={key++} className="mt-6 mb-3 font-display text-2xl font-bold tracking-tight text-ink-50 first:mt-0">
            {content}
          </h1>
        );
      else if (level === 2)
        blocks.push(
          <h2 key={key++} className="mt-6 mb-2 border-b border-ink-700/70 pb-1.5 font-display text-lg font-semibold text-ink-50">
            {content}
          </h2>
        );
      else
        blocks.push(
          <h3 key={key++} className="mt-5 mb-1.5 font-display text-[15px] font-semibold text-ember-300">
            {content}
          </h3>
        );
      i++;
      continue;
    }

    // horizontal rule
    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      blocks.push(<hr key={key++} className="my-5 border-ink-700" />);
      i++;
      continue;
    }

    // blockquote
    if (line.startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote key={key++} className="my-4 border-l-2 border-ember-500 bg-ember-500/[0.06] py-2 pl-4 pr-3 text-ink-200 italic">
          {buf.map((b, bi) => (
            <p key={bi}>{renderInline(b, `q${key}-${bi}`)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    // unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-3 space-y-1.5 pl-1">
          {items.map((it, ii) => (
            <li key={ii} className="flex gap-2.5 leading-relaxed text-ink-200">
              <span className="mt-[9px] h-1 w-3 shrink-0 rounded-full bg-ember-500/80" />
              <span>{renderInline(it, `ul${key}-${ii}`)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // ordered list
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={key++} className="my-3 space-y-1.5 pl-1">
          {items.map((it, ii) => (
            <li key={ii} className="flex gap-2.5 leading-relaxed text-ink-200">
              <span className="font-mono text-[12px] font-medium text-mint-400">{String(ii + 1).padStart(2, "0")}</span>
              <span>{renderInline(it, `ol${key}-${ii}`)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // blank
    if (line.trim() === "") {
      i++;
      continue;
    }

    // paragraph (join consecutive)
    const buf: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,4}\s|```|>|\s*[-*]\s|\s*\d+[.)]\s)/.test(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="my-3 leading-relaxed text-ink-200">
        {renderInline(buf.join(" "), `p${key}`)}
      </p>
    );
  }

  return <div className={className}>{blocks}</div>;
}
