import { useEffect, useRef, useState } from "react";
import { Play, RotateCcw, Check } from "lucide-react";
import { STAGES, ACCENT } from "../data/pipeline";
import type { Stage } from "../data/pipeline";

const STEP_MS = 720;

function Connector({ from, to, lit }: { from: string; to: string; lit: boolean }) {
  return (
    <svg viewBox="0 0 48 24" className="mx-1 hidden h-6 w-12 shrink-0 md:block" aria-hidden>
      <defs>
        <linearGradient id={`g-${from}-${to}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <line
        x1="2" y1="12" x2="40" y2="12"
        stroke={`url(#g-${from}-${to})`}
        strokeWidth="2"
        className={lit ? "flow-dash" : ""}
        strokeOpacity={lit ? 0.95 : 0.35}
      />
      <path d="M40 6 L47 12 L40 18 Z" fill={to} fillOpacity={lit ? 0.95 : 0.4} />
    </svg>
  );
}

function VerticalConnector({ lit }: { lit: boolean }) {
  return (
    <svg viewBox="0 0 24 32" className="mx-auto my-1 h-8 w-6 md:hidden" aria-hidden>
      <line x1="12" y1="2" x2="12" y2="24" stroke="#847455" strokeWidth="2" className={lit ? "flow-dash" : ""} strokeOpacity={lit ? 0.9 : 0.35} />
      <path d="M6 24 L12 31 L18 24 Z" fill="#847455" fillOpacity={lit ? 0.9 : 0.4} />
    </svg>
  );
}

function StageNode({ stage, active, done, dim, onSelect }: { stage: Stage; active: boolean; done: boolean; dim: boolean; onSelect: (id: string) => void }) {
  const a = ACCENT[stage.accent];
  return (
    <button
      onClick={() => onSelect(stage.id)}
      className={`group relative flex min-w-0 flex-1 flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-300 ${
        active ? `${a.border} ${a.bg} ring-2 ${a.ring} -translate-y-1 shadow-[0_10px_34px_rgba(0,0,0,0.45)]` : "border-bw-line bg-bw-850/90 hover:-translate-y-0.5 hover:border-sand-600"
      } ${dim && !active ? "opacity-45" : ""}`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border font-display text-[15px] font-bold transition-colors ${
            active ? `${a.border} ${a.text} node-pulse` : "border-bw-line text-sand-400 group-hover:text-sand-200"
          }`}
          style={active ? { background: `${a.hex}1f` } : undefined}
        >
          {done ? <Check className="h-4 w-4" /> : stage.etl}
        </span>
        <div className="min-w-0">
          <p className={`font-display text-[15px] font-bold leading-tight ${active ? a.text : "text-sand-100"}`}>{stage.name}</p>
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-sand-500">{stage.etl === "E" ? "extract" : stage.etl === "T" ? "transform" : stage.etl === "L" ? "load" : "feed"}</p>
        </div>
      </div>
      <p className="text-[12px] leading-snug text-sand-300">{stage.tagline}</p>
      <p className="mt-auto truncate font-mono text-[10px] text-sand-500">
        <span className="text-sand-400">{stage.consumes}</span> <span className="text-sand-600">→</span> <span className={a.text}>{stage.produces}</span>
      </p>
    </button>
  );
}

export function PipelineFlow({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(-1); // -1 idle, 0..3 active stage, 4 done
  const [runCount, setRunCount] = useState(0);
  const [lastResult, setLastResult] = useState<{ districts: number; alerts: number } | null>(null);
  const timer = useRef<number | null>(null);

  const start = () => {
    if (running) return;
    setRunning(true);
    setStep(0);
    setLastResult(null);
  };

  useEffect(() => {
    const t = window.setTimeout(start, 600); // auto-run once on mount
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!running) return;
    if (step > 3) {
      setRunning(false);
      setRunCount((c) => c + 1);
      setLastResult({ districts: 9, alerts: 3 });
      return;
    }
    timer.current = window.setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [running, step]);

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-bw-line px-4 py-3">
        <div>
          <h2 className="font-display text-[17px] font-bold tracking-tight text-sand-50">The pipeline, stage by stage</h2>
          <p className="font-mono text-[10.5px] text-sand-500">Extract → Standardize → Load → Feed · one artifact handed off per seam</p>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <div className="hidden items-center gap-2 rounded-md border border-bw-line bg-bw-900 px-2.5 py-1.5 font-mono text-[10.5px] text-sand-400 sm:flex">
            <span className={`h-1.5 w-1.5 rounded-full ${running ? "bg-warn node-pulse" : lastResult ? "bg-ok" : "bg-sand-600"}`} />
            {running ? `running · stage ${Math.min(step + 1, 4)}/4` : lastResult ? `run #${runCount} · exit 0` : "idle"}
          </div>
          <button
            onClick={start}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-md border border-ochre-500/60 bg-ochre-500/15 px-3 py-1.5 font-mono text-[11.5px] font-medium text-ochre-300 transition-all hover:bg-ochre-500/25 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {running ? <RotateCcw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {runCount === 0 ? "run pipeline" : "re-run"}
          </button>
        </div>
      </div>

      <div className="px-4 pb-4 pt-4">
        <div className="flex flex-col items-stretch md:flex-row md:items-stretch">
          {STAGES.map((s, i) => {
            const a = ACCENT[s.accent];
            const active = running && step === i;
            const done = running ? step > i : lastResult !== null;
            const dim = running && step >= 0 && step !== i && step < 4;
            return (
              <div key={s.id} className="flex flex-1 flex-col md:flex-row md:items-center">
                <StageNode stage={s} active={active} done={done} dim={dim} onSelect={onSelect} />
                {i < STAGES.length - 1 && (
                  <>
                    <Connector from={a.hex} to={ACCENT[STAGES[i + 1].accent].hex} lit={running && step >= i} />
                    <VerticalConnector lit={running && step >= i} />
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-bw-line pt-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-sand-500">CDI variables</span>
          {(Object.keys(ACCENT) as (keyof typeof ACCENT)[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-sand-300">
              <span className="h-2 w-2 rounded-full" style={{ background: ACCENT[k].hex }} />
              {ACCENT[k].name}
            </span>
          ))}
          <span className="ml-auto font-mono text-[10.5px] text-sand-500">
            {lastResult ? (
              <>
                <span className="text-ok">{lastResult.districts} districts scored</span> · <span className="text-heat-400">{lastResult.alerts} alerts fired</span> · master_district.csv
              </>
            ) : (
              "click a stage to inspect its agent"
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
