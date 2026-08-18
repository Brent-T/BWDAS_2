import { useState } from "react";
import { FileCode2, FlaskConical, ScrollText } from "lucide-react";
import { ACCENT } from "../data/pipeline";
import type { Agent } from "../data/pipeline";
import { CodeBlock } from "./CodeBlock";

type Tab = "charter" | "code" | "tests";

export function AgentPanel({ agent }: { agent: Agent }) {
  const [tab, setTab] = useState<Tab>("charter");
  const a = ACCENT[agent.accent];

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "charter", label: "Charter", icon: <ScrollText className="h-3.5 w-3.5" /> },
    { id: "code", label: "Implementation", icon: <FileCode2 className="h-3.5 w-3.5" /> },
    { id: "tests", label: "TDD suite", icon: <FlaskConical className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-bw-line px-4 py-3.5">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${a.border} ${a.bg} font-display text-[13px] font-bold ${a.text}`}>
          {agent.name.replace("Agent", "").slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-sand-500">{agent.stage}</p>
          <h3 className="font-display text-[18px] font-bold tracking-tight text-sand-50">{agent.name}</h3>
        </div>
        <div className="ml-auto flex items-center gap-2 font-mono text-[10.5px]">
          <span className="rounded border border-bw-line bg-bw-900 px-2 py-1 text-sand-400">
            in: <span className="text-sand-200">{agent.consumes}</span>
          </span>
          <span className="text-sand-600">→</span>
          <span className={`rounded border ${a.border} ${a.bg} px-2 py-1 ${a.text}`}>{agent.produces}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-bw-line bg-bw-900/60 px-3 pt-2">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex items-center gap-1.5 rounded-t-md px-3.5 py-2 font-mono text-[12px] transition-colors ${
                active ? a.text : "text-sand-500 hover:text-sand-300"
              }`}
            >
              {t.icon}
              {t.label}
              {active && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full" style={{ background: a.hex }} />}
            </button>
          );
        })}
        <span className="ml-auto hidden pr-1 font-mono text-[10px] text-sand-600 md:block">{agent.file}</span>
      </div>

      <div className="p-4">
        {tab === "charter" && (
          <div className="space-y-4">
            <p className="text-[13.5px] leading-relaxed text-sand-200">{agent.charter}</p>
            <div>
              <p className="panel-title mb-2">Operating principles</p>
              <ul className="space-y-2">
                {agent.principles.map((p, i) => (
                  <li key={i} className="flex gap-2.5 text-[12.5px] leading-snug text-sand-300">
                    <span className="mt-[7px] h-1 w-3.5 shrink-0 rounded-full" style={{ background: a.hex }} />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {tab === "code" && <CodeBlock code={agent.code} filename={agent.file} accentHex={a.hex} />}
        {tab === "tests" && (
          <div className="space-y-3">
            <p className="text-[12px] leading-relaxed text-sand-400">
              Written against the agent's contract, not its internals — the suite runs with <span className="font-mono text-sand-200">pytest</span> and no GEE credentials.
            </p>
            <CodeBlock code={agent.test} filename={agent.testFile} accentHex={a.hex} />
          </div>
        )}
      </div>
    </div>
  );
}
