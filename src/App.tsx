import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, FlaskConical, GitBranch, Layers, TerminalSquare } from "lucide-react";
import { PipelineFlow } from "./components/PipelineFlow";
import { AgentPanel } from "./components/AgentPanel";
import { DesignGrill } from "./components/DesignGrill";
import { CodeBlock } from "./components/CodeBlock";
import { AGENTS, ACCENT, SUPPORT_FILES, STAGES } from "./data/pipeline";

function daysTo(iso: string): number {
  const target = new Date(iso + "T00:00:00");
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll(".reveal"));
    // Failsafe 1: no IntersectionObserver support -> show everything.
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.06, rootMargin: "0px 0px -4% 0px" }
    );
    els.forEach((el) => io.observe(el));
    // Failsafe 2: embedded previews can mount inside hidden / zero-height
    // iframes where intersections never fire — never trap content invisible.
    const t = window.setTimeout(() => els.forEach((el) => el.classList.add("in")), 1100);
    return () => {
      io.disconnect();
      window.clearTimeout(t);
    };
  }, []);
}

const WEIGHTS = [
  { key: "spi", label: "SPI-3 rainfall", pct: 40, accent: "rain" as const, src: "CHIRPS · 5km" },
  { key: "ndvi", label: "NDVI vegetation", pct: 20, accent: "veg" as const, src: "Sentinel-2 · 10m" },
  { key: "lst", label: "LST heat", pct: 20, accent: "heat" as const, src: "MODIS · 1km" },
  { key: "sm", label: "Soil moisture", pct: 20, accent: "soil" as const, src: "SMAP · 36km" },
];

export default function App() {
  useReveal();
  const [selectedAgent, setSelectedAgent] = useState("extract");
  const pocDays = useMemo(() => daysTo("2026-09-15"), []);
  const agent = AGENTS.find((a) => a.id === selectedAgent) ?? AGENTS[1];
  const rosterRef = useRef<HTMLDivElement>(null);

  const pick = (id: string) => {
    setSelectedAgent(id);
    rosterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen">
      <div className="bg-scene" aria-hidden />

      {/* ---------- header ---------- */}
      <header className="sticky top-0 z-40 border-b border-bw-line bg-bw-900/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-4 py-3 lg:px-6">
          <span className="grid h-9 w-9 place-items-center rounded-md border border-ochre-500/50 bg-ochre-500/10">
            <Layers className="h-4.5 w-4.5 text-ochre-400" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-[16px] font-bold tracking-tight text-sand-50">
              BWDAS<span className="text-ochre-400">_</span>pipeline
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-sand-500">drought-index ETL · TDD</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-md border border-bw-line bg-bw-850 px-2.5 py-1.5 font-mono text-[10.5px] text-sand-300 md:inline-flex">
              <GitBranch className="h-3.5 w-3.5 text-sand-500" />
              main · 9 districts
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[10.5px] ${pocDays >= 0 ? "border-warn/40 bg-warn/10 text-warn" : "border-bad/40 bg-bad/10 text-bad"}`}>
              <CalendarClock className="h-3.5 w-3.5" />
              PoC {pocDays >= 0 ? `T−${pocDays}d` : "overdue"} · Sep 15
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] space-y-10 px-4 pb-16 pt-6 lg:px-6">
        {/* ---------- the pipeline (opening) ---------- */}
        <section className="reveal in">
          <PipelineFlow selected={selectedAgent} onSelect={pick} />
        </section>

        {/* ---------- CDI weighting ---------- */}
        <section className="reveal">
          <div className="mb-3 flex items-baseline gap-3">
            <h2 className="font-display text-[20px] font-bold tracking-tight text-sand-50">The index being computed</h2>
            <span className="font-mono text-[10.5px] text-sand-500">World Bank + NDMC CDI, validated for Botswana 2018 · weights are fixed</span>
          </div>
          <div className="panel p-4">
            <div className="flex h-9 overflow-hidden rounded-md">
              {WEIGHTS.map((w) => {
                const a = ACCENT[w.accent];
                return (
                  <div
                    key={w.key}
                    className="group relative flex items-center justify-center transition-all duration-300 hover:brightness-125"
                    style={{ width: `${w.pct}%`, background: `${a.hex}33`, borderLeft: `2px solid ${a.hex}` }}
                    title={`${w.label} — ${w.pct}% (${w.src})`}
                  >
                    <span className="font-display text-[15px] font-bold" style={{ color: a.hex }}>{w.pct}%</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {WEIGHTS.map((w) => {
                const a = ACCENT[w.accent];
                return (
                  <div key={w.key} className="flex items-center gap-2 rounded-md border border-bw-line bg-bw-900/60 px-3 py-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.hex }} />
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium text-sand-100">{w.label}</p>
                      <p className="truncate font-mono text-[9.5px] text-sand-500">{w.src}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* stress scale + alert thresholds */}
            <div className="mt-5">
              <div className="flex justify-between font-mono text-[9.5px] uppercase tracking-wider text-sand-500">
                <span>0 · Low</span><span>25 · Moderate</span><span>50 · High</span><span>75 · Severe</span><span>100</span>
              </div>
              <div className="relative mt-1.5 h-3 overflow-hidden rounded-full"
                style={{ background: "linear-gradient(90deg,#7cc47f 0%,#7cc47f 25%,#d9c34a 25%,#d9c34a 50%,#e8834a 50%,#e8834a 75%,#d14e36 75%,#d14e36 100%)" }}>
                {[50, 75, 90].map((t) => (
                  <span key={t} className="absolute top-0 h-full w-px bg-bw-950/80" style={{ left: `${t}%` }} title={`alert at ${t}`} />
                ))}
              </div>
              <div className="mt-1.5 flex gap-4 font-mono text-[9.5px] text-sand-500">
                <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-sand-300" />50 WATCH</span>
                <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-sand-300" />75 ACTION REQUIRED</span>
                <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-sand-300" />90 EMERGENCY</span>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- agents ---------- */}
        <section className="reveal" ref={rosterRef}>
          <div className="mb-3 flex items-baseline gap-3">
            <h2 className="font-display text-[20px] font-bold tracking-tight text-sand-50">The agent roster</h2>
            <span className="font-mono text-[10.5px] text-sand-500">one dedicated subagent per ETL stage · each owns a script + a test suite</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
            <div className="flex flex-row gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
              {AGENTS.map((a) => {
                const ac = ACCENT[a.accent];
                const active = selectedAgent === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAgent(a.id)}
                    className={`flex min-w-[190px] shrink-0 items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all lg:min-w-0 ${
                      active ? `${ac.border} ${ac.bg} ring-1 ${ac.ring}` : "border-bw-line bg-bw-850/90 hover:border-sand-600"
                    }`}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ac.hex }} />
                    <span className="min-w-0">
                      <span className={`block truncate font-mono text-[10px] uppercase tracking-wider ${active ? ac.text : "text-sand-500"}`}>{a.stage}</span>
                      <span className={`block truncate text-[13px] font-semibold ${active ? "text-sand-50" : "text-sand-200"}`}>{a.name}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <AgentPanel agent={agent} />
          </div>
        </section>

        {/* ---------- supporting files ---------- */}
        <section className="reveal">
          <div className="mb-3 flex items-baseline gap-3">
            <h2 className="font-display text-[20px] font-bold tracking-tight text-sand-50">Load-bearing supporting files</h2>
            <span className="font-mono text-[10.5px] text-sand-500">config is the single source of truth · models are the row contracts</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {SUPPORT_FILES.map((f) => (
              <div key={f.name} className="min-w-0">
                <CodeBlock code={f.code} filename={f.name} accentHex="#e0a83f" />
                <p className="mt-1.5 font-mono text-[10px] text-sand-500">{f.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- design grill ---------- */}
        <section className="reveal">
          <div className="mb-3 flex items-baseline gap-3">
            <h2 className="font-display text-[20px] font-bold tracking-tight text-sand-50">Design review — defend the architecture</h2>
            <span className="font-mono text-[10.5px] text-sand-500">the decisions you're actually making, and the pushback they deserve</span>
          </div>
          <DesignGrill />
        </section>

        {/* ---------- run it ---------- */}
        <section className="reveal">
          <div className="panel overflow-hidden">
            <div className="flex items-center gap-2 border-b border-bw-line px-4 py-3">
              <TerminalSquare className="h-4 w-4 text-ochre-400" />
              <h2 className="panel-title">Run it — TDD loop then the pipeline</h2>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-3">
              {[
                { step: "1 · install", cmd: "cd pipeline && pip install -r requirements.txt", note: "pydantic + pytest only; earthengine-api is lazy" },
                { step: "2 · test", cmd: "pytest", note: "red→green across extract / standardize / load / feed / e2e" },
                { step: "3 · run", cmd: "python -m bwdas.cli run", note: "what Windows Task Scheduler calls every Monday 06:00" },
              ].map((b) => (
                <div key={b.step} className="rounded-md border border-bw-line bg-bw-900/70 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-sand-500">{b.step}</p>
                  <code className="mt-1.5 block overflow-x-auto whitespace-nowrap font-mono text-[12px] text-ochre-300">$ {b.cmd}</code>
                  <p className="mt-1.5 text-[11px] leading-snug text-sand-400">{b.note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-bw-line bg-bw-900/80">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 lg:px-6">
          <p className="flex items-center gap-2 font-mono text-[10.5px] text-sand-500">
            <FlaskConical className="h-3.5 w-3.5 text-sand-600" />
            {STAGES.length} stages · {AGENTS.length} agents · tests green before merge
          </p>
          <p className="ml-auto font-mono text-[10.5px] text-sand-600">
            deliverables live in <span className="text-sand-300">/pipeline</span> — copy straight into Brent26/BWDAS
          </p>
        </div>
      </footer>
    </div>
  );
}
