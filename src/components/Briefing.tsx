import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  Calculator,
  Check,
  CheckCheck,
  Cpu,
  ExternalLink,
  FileSpreadsheet,
  HeartHandshake,
  Landmark,
  LineChart,
  Quote,
  Satellite,
  X,
} from "lucide-react";
import {
  BELAP_NOTE,
  DEADLINE_POC,
  DISTRICTS,
  LAYERS,
  LEVELS,
  LONG_GAME,
  OUTLINE,
  PHASES,
  PITCH_PAIRS,
  SEASON_START,
  STAKEHOLDERS,
  STATS,
  WEIGHTS,
  baselineText,
  cdiOf,
  levelOf,
  rawReadings,
} from "../lib/bwdas";
import type { District, Scenario } from "../lib/bwdas";

/* ---------------- primitives ---------------- */

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (ents) => {
        for (const e of ents) {
          if (e.isIntersecting) {
            setInView(true);
            obs.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -36px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${inView ? "is-in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

function Anim({ value, className = "" }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    if (reduceMotion()) {
      setDisplay(value);
      prevRef.current = value;
      return;
    }
    const from = prevRef.current;
    if (from === value) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 650);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (value - from) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={className}>{display}</span>;
}

function SectionHead({ index, kicker, title, lede }: { index: string; kicker: string; title: string; lede?: string }) {
  return (
    <Reveal className="mb-7 md:mb-9">
      <div className="flex items-baseline gap-4 md:gap-5">
        <span className="select-none font-display text-[42px] font-bold leading-none text-ink-750 md:text-[58px]">{index}</span>
        <div className="min-w-0">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-ember-400">{kicker}</p>
          <h2 className="mt-1 font-display text-[21px] font-bold leading-tight tracking-tight text-ink-50 md:text-[27px]">
            {title}
          </h2>
        </div>
      </div>
      {lede && <p className="mt-4 max-w-3xl text-[13.5px] leading-relaxed text-ink-300 md:pl-[80px] md:text-[14px]">{lede}</p>}
    </Reveal>
  );
}

function Countdown({ target, title, sub, tone }: { target: Date; title: string; sub: string; tone: "ember" | "mint" }) {
  const now = useNow(1000);
  const diff = target.getTime() - now;
  const past = diff <= 0;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const toneTxt = tone === "ember" ? "text-ember-300" : "text-mint-300";
  const toneDot = tone === "ember" ? "bg-ember-400" : "bg-mint-400";
  const cells: [number, string][] = past ? [] : [[d, "days"], [h, "hrs"], [m, "min"], [s, "sec"]];
  return (
    <div className="panel group p-4 transition-colors hover:border-ink-600">
      <div className="flex items-center gap-2">
        <span className={`dot-live h-1.5 w-1.5 rounded-full ${toneDot}`} />
        <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">{title}</h3>
        {past && (
          <span className="ml-auto rounded border border-ink-600 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-ink-400">
            elapsed
          </span>
        )}
      </div>
      <p className="mt-1 text-[12.5px] font-semibold text-ink-100">{sub}</p>
      {!past && (
        <div className="mt-2.5 flex items-end gap-2.5">
          {cells.map(([v, u], i) => (
            <div key={u} className={i > 0 ? "flex items-end gap-2.5" : ""}>
              {i > 0 && <span className="pb-1 font-display text-lg text-ink-600">:</span>}
              <div>
                <div className={`font-display text-[30px] font-bold leading-none tabular-nums tracking-tight ${toneTxt}`}>
                  {String(Math.max(0, v)).padStart(2, "0")}
                </div>
                <div className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.18em] text-ink-500">{u}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- map ---------------- */

function BotswanaMap({
  scenario,
  selected,
  onSelect,
}: {
  scenario: Scenario;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <svg viewBox="36 4 326 386" className="mx-auto w-full max-w-[520px]" role="img" aria-label="Botswana district stress map (stylised)">
      <polygon points={OUTLINE} fill="none" stroke="#eda22f" strokeOpacity="0.18" strokeWidth="7" strokeLinejoin="round" />
      {DISTRICTS.map((d) => {
        const cdi = cdiOf(d.scores[scenario]);
        const level = levelOf(cdi);
        const sel = selected === d.id;
        const hov = hover === d.id;
        return (
          <g
            key={d.id}
            className="cursor-pointer"
            onClick={() => onSelect(d.id)}
            onMouseEnter={() => setHover(d.id)}
            onMouseLeave={() => setHover(null)}
          >
            <polygon
              points={d.points}
              fill={level.color}
              fillOpacity={sel ? 0.96 : hov ? 0.9 : 0.72}
              stroke="#0b111d"
              strokeWidth={sel ? 2.4 : 1.2}
              strokeLinejoin="round"
              style={{ transition: "fill 600ms ease, fill-opacity 220ms ease" }}
            />
            <text
              x={d.label.x}
              y={d.label.y}
              textAnchor="middle"
              fontSize={d.short.length > 5 ? 8 : 9.5}
              fontWeight={600}
              letterSpacing="0.06em"
              fill={level.ink}
              opacity={0.85}
              className="pointer-events-none select-none"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {d.short}
            </text>
            <text
              x={d.label.x}
              y={d.label.y + 13}
              textAnchor="middle"
              fontSize="11.5"
              fontWeight={700}
              fill={level.ink}
              className="pointer-events-none select-none"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {cdi}
            </text>
          </g>
        );
      })}
      <circle cx={264} cy={330} r={3.2} fill="#eef3fc" stroke="#0b111d" strokeWidth={1.4} />
      <text x={252} y={334} textAnchor="end" fontSize="8.5" fill="#8399bb" className="pointer-events-none select-none" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        GABORONE
      </text>
    </svg>
  );
}

function DistrictPanel({ d, scenario }: { d: District; scenario: Scenario }) {
  const scores = d.scores[scenario];
  const cdi = cdiOf(scores);
  const level = levelOf(cdi);
  const base = cdiOf(d.scores.baseline);
  const peak = cdiOf(d.scores.peak);
  const rows = rawReadings(scores);
  const txt = scenario === "peak" ? { situation: d.situation, action: d.action } : baselineText(level);
  return (
    <div className="panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-ink-700/70 px-4 py-3">
        <div>
          <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-500">District dossier</p>
          <h3 className="font-display text-[19px] font-bold tracking-tight text-ink-50">{d.name}</h3>
        </div>
        <span
          className="rounded-md px-2.5 py-1 font-display text-[12px] font-bold uppercase tracking-wider transition-colors duration-500"
          style={{ background: level.color, color: level.ink }}
        >
          {level.name}
        </span>
      </div>

      <div className="border-b border-ink-700/70 px-4 py-4">
        <div className="flex items-end gap-3">
          <Anim value={cdi} className="font-display text-[54px] font-bold leading-none tracking-tight text-ink-50" />
          <div className="pb-1.5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">CDI / 100</p>
            <p className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-ink-400">
              {base}
              <ArrowUpRight className={`h-3.5 w-3.5 ${peak - base >= 25 ? "text-rust-400" : "text-ember-400"}`} />
              <span className="text-ink-200">{peak}</span>
              <span className="text-ink-600">· baseline → peak</span>
            </p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-800">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${cdi}%`, background: level.color }}
          />
        </div>
      </div>

      <div className="flex-1 space-y-3 px-4 py-4">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-400">{r.label}</span>
              <span className="font-mono text-[12px] font-bold text-ink-100 tabular-nums">{r.value}</span>
            </div>
            <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-ink-800">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${r.value}%`,
                  background: levelOf(r.value).color,
                }}
              />
            </div>
            <p className="mt-1 font-mono text-[10.5px] text-ink-500">{r.detail}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-ink-700/70 bg-ink-900/50 px-4 py-3.5">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ember-400">Situation</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-200">{txt.situation}</p>
        <p className="mt-2.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-mint-400">Recommended action</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-200">{txt.action}</p>
        <p className="mt-3 border-t border-ink-800 pt-2 font-mono text-[9.5px] leading-snug text-ink-600">
          illustrative scenario — live ingestion is Phase 1 work
        </p>
      </div>
    </div>
  );
}

/* ---------------- CDI donut ---------------- */

function WeightDonut() {
  const [hover, setHover] = useState<string | null>(null);
  const R = 54;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex flex-col items-center gap-7 sm:flex-row">
      <div className="relative shrink-0">
        <svg viewBox="0 0 140 140" className="h-44 w-44 -rotate-90">
          <circle cx="70" cy="70" r={R} fill="none" stroke="#1c2b49" strokeWidth={11} />
          {WEIGHTS.map((w) => {
            const seg = (w.weight / 100) * C;
            const el = (
              <circle
                key={w.key}
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={w.color}
                strokeWidth={hover === w.key ? 17 : 11}
                strokeDasharray={`${Math.max(seg - 4, 1)} ${C - seg + 4}`}
                strokeDashoffset={-(acc + 2)}
                style={{ transition: "stroke-width 180ms ease" }}
                onMouseEnter={() => setHover(w.key)}
                onMouseLeave={() => setHover(null)}
              />
            );
            acc += seg;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="font-display text-[22px] font-bold tracking-tight text-ink-50">CDI</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">0 – 100</div>
          </div>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1">
        {WEIGHTS.map((w) => (
          <li
            key={w.key}
            onMouseEnter={() => setHover(w.key)}
            onMouseLeave={() => setHover(null)}
            className={`flex cursor-default items-center gap-3 rounded-md border px-3 py-2 transition-all ${
              hover === w.key ? "border-ink-600 bg-ink-800" : "border-transparent"
            }`}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: w.color }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-semibold text-ink-100">
                {w.key} · {w.label}
              </span>
              <span className="block truncate font-mono text-[10px] text-ink-500">
                {w.dataset} · {w.res}
              </span>
            </span>
            <span className="shrink-0 font-display text-[17px] font-bold tabular-nums text-ink-100">{w.weight}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- pipeline ---------------- */

function Conn() {
  return (
    <div className="flex items-center justify-center py-0.5 lg:px-0.5 lg:py-0">
      <ArrowRight className="pulse-soft hidden h-4 w-4 text-ember-500/80 lg:block" />
      <ArrowDown className="pulse-soft h-4 w-4 text-ember-500/80 lg:hidden" />
    </div>
  );
}

function NodeShell({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="panel group flex min-w-0 flex-1 flex-col gap-2 p-3.5 transition-all hover:border-ember-500/40 hover:shadow-[0_0_24px_rgba(237,162,47,0.07)]">
      <div className="flex items-center gap-2">
        <span className="text-ember-400 transition-transform duration-300 group-hover:scale-110">{icon}</span>
        <h4 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-100">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function PhoneMock() {
  return (
    <div className="flex flex-col items-center">
      <div className="w-[248px] shrink-0 rounded-[26px] border border-ink-600 bg-[#0b141a] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
        <div className="overflow-hidden rounded-[19px] border border-[#1f2c34] bg-[#0b141a]">
          <div className="flex items-center gap-2.5 bg-[#1f2c34] px-3 py-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ember-500/20">
              <Satellite className="h-4 w-4 text-ember-300" />
            </span>
            <span className="leading-tight">
              <span className="block text-[12.5px] font-semibold text-[#e9edef]">BWDAS Alerts</span>
              <span className="block font-mono text-[9px] text-[#8696a0]">field officer · Kweneng</span>
            </span>
          </div>
          <div className="space-y-2 p-2.5">
            <div className="flex justify-center">
              <span className="rounded-md bg-[#1f2c34] px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-widest text-[#8696a0]">
                Monday · 06:00
              </span>
            </div>
            <div className="bubble-in rounded-lg rounded-tl-[3px] bg-[#1f2c33] p-2.5">
              <p className="font-mono text-[10px] leading-[1.7] text-[#e9edef]">
                <span className="font-bold text-ember-300">BWDAS Alert — Kweneng</span>
                <br />
                Level: <span className="font-bold text-[#ffb4a3]">WATCH</span> (CDI 74/100)
                <br />
                Rainfall: −1.1 SPI · 34% below normal
                <br />
                Vegetation: 13% below seasonal avg
                <br />
                Soil moisture: 18% below baseline
                <br />
                <span className="text-[#9fb3bd]">Compound drought stress. Grazing deteriorating.</span>
                <br />
                <span className="text-[#9fb3bd]">Action: fodder advisories, delay planting.</span>
              </p>
              <p className="mt-1.5 flex items-center justify-end gap-1 font-mono text-[8.5px] text-[#8696a0]">
                06:00 <CheckCheck className="h-3 w-3 text-[#53bdeb]" />
              </p>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-2.5 max-w-[248px] text-center font-mono text-[9.5px] leading-snug text-ink-500">
        CallMeBot for the PoC — WhatsApp Business API + BMOBILE SMS in production
      </p>
    </div>
  );
}

/* ---------------- phases ---------------- */

function PhasePlan() {
  const now = useNow(60000);
  const activeIdx = (() => {
    const i = PHASES.findIndex((p) => new Date(`${p.deadline}T23:59:59`).getTime() >= now);
    return i === -1 ? PHASES.length - 1 : i;
  })();
  return (
    <ol className="grid gap-3 md:grid-cols-5">
      {PHASES.map((p, i) => {
        const dl = new Date(`${p.deadline}T23:59:59`).getTime();
        const days = Math.ceil((dl - now) / 86400000);
        const state = i < activeIdx ? "done" : i === activeIdx ? "active" : "next";
        const edge = state === "done" ? "border-l-mint-500" : state === "active" ? "border-l-ember-500" : "border-l-ink-600";
        return (
          <li
            key={p.id}
            className={`panel group border-l-[3px] p-3.5 transition-all hover:-translate-y-0.5 hover:border-ink-600 hover:shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${edge}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={`font-display text-[20px] font-bold tracking-tight ${
                  state === "active" ? "text-ember-400" : state === "done" ? "text-mint-400" : "text-ink-400"
                }`}
              >
                P{p.id}
              </span>
              <span className="font-mono text-[9.5px] uppercase tracking-wider text-ink-500">{p.window}</span>
            </div>
            <h4 className="mt-1 font-display text-[14.5px] font-semibold text-ink-100">{p.name}</h4>
            <p className="mt-1.5 min-h-[52px] text-[11.5px] leading-snug text-ink-300">{p.milestone}</p>
            <p className="mt-1.5 text-[10.5px] leading-snug text-ink-500">{p.detail}</p>
            <div className="mt-2.5 border-t border-ink-800 pt-2">
              {state === "active" ? (
                <span className="inline-flex items-center gap-1.5 rounded border border-ember-500/50 bg-ember-500/10 px-1.5 py-0.5 font-mono text-[9.5px] font-medium uppercase tracking-wider text-ember-300">
                  <span className="dot-live h-1 w-1 rounded-full bg-ember-400" />
                  {days >= 0 ? `${days}d left` : "due now"}
                </span>
              ) : state === "done" ? (
                <span className="inline-flex items-center gap-1 rounded border border-mint-600/40 bg-mint-500/10 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-mint-300">
                  <Check className="h-2.5 w-2.5" /> window closed
                </span>
              ) : (
                <span className="font-mono text-[9.5px] uppercase tracking-wider text-ink-500">
                  deadline {p.deadline.slice(5).replace("-", " ")}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------- layers & contacts ---------------- */

const LAYER_ICONS: Record<string, ReactNode> = {
  L1: <Landmark className="h-4 w-4" />,
  L2: <LineChart className="h-4 w-4" />,
  L3: <HeartHandshake className="h-4 w-4" />,
};

function ServesLayers() {
  return (
    <div className="space-y-3">
      {LAYERS.map((l) => (
        <div key={l.tag} className="panel group flex flex-col gap-3 p-4 transition-all hover:border-ember-500/40 md:flex-row md:items-center">
          <span className="flex w-14 shrink-0 flex-col items-center gap-1.5 md:items-start">
            <span className="font-display text-[26px] font-bold leading-none text-ember-400">{l.tag}</span>
            <span className="text-ink-500 transition-colors group-hover:text-ember-300">{LAYER_ICONS[l.tag]}</span>
          </span>
          <div className="min-w-0 flex-1">
            <h4 className="font-display text-[15.5px] font-semibold tracking-tight text-ink-50">{l.name}</h4>
            <div className="mt-2 grid gap-2 text-[11.5px] leading-snug sm:grid-cols-3">
              <p className="text-ink-400">
                <span className="mr-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">who</span>
                {l.who}
              </p>
              <p className="text-ink-300">
                <span className="mr-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">what</span>
                {l.what}
              </p>
              <p className="text-ink-200">
                <span className="mr-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">why it sells</span>
                {l.value}
              </p>
            </div>
          </div>
          <span className="shrink-0 self-start rounded-md border border-mint-600/40 bg-mint-500/10 px-2.5 py-1 font-mono text-[10px] text-mint-300 md:self-center">
            {l.money}
          </span>
        </div>
      ))}
      <div className="stripes panel flex flex-col gap-2 p-4 md:flex-row md:items-center">
        <span className="shrink-0 font-display text-[15px] font-bold uppercase tracking-[0.14em] text-ember-300">
          Foundation · BELAP
        </span>
        <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-ink-300">{BELAP_NOTE}</p>
        <span className="shrink-0 self-start rounded-md border border-ember-500/50 bg-ember-500/10 px-2.5 py-1 font-mono text-[10px] text-ember-300 md:self-center">
          the long-term data moat
        </span>
      </div>
    </div>
  );
}

/* ---------------- main briefing ---------------- */

const NAV: [string, string][] = [
  ["brief", "the brief"],
  ["map", "stress map"],
  ["cdi", "the index"],
  ["pipeline", "pipeline"],
  ["plan", "the plan"],
  ["layers", "who it serves"],
  ["contacts", "contacts"],
];

export function Briefing() {
  const [scenario, setScenario] = useState<Scenario>("baseline");
  const [selected, setSelected] = useState("kweneng");
  const district = DISTRICTS.find((d) => d.id === selected) ?? DISTRICTS[5];

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
  };

  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 lg:px-6">
      {/* anchor nav */}
      <nav className="sticky top-[60px] z-30 -mx-4 border-b border-ink-800/80 bg-ink-950/85 px-4 backdrop-blur-md lg:-mx-6 lg:px-6">
        <div className="flex items-center gap-1 overflow-x-auto py-2">
          {NAV.map(([id, label]) => (
            <button
              key={id}
              onClick={() => jump(id)}
              className="whitespace-nowrap rounded-md px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-400 transition-all hover:bg-ink-800 hover:text-ember-300"
            >
              {label}
            </button>
          ))}
          <span className="ml-auto hidden whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-600 md:block">
            compiled from BWDAS.MD
          </span>
        </div>
      </nav>

      {/* 00 — the brief */}
      <section id="brief" className="scroll-mt-28 pt-9 md:pt-14">
        <Reveal>
          <p className="flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.24em] text-ink-400">
            <span className="h-2 w-2 bg-ember-500" />
            Botswana Weather &amp; Agricultural Data Intelligence System · Project Brief · August 2026
          </p>
        </Reveal>

        <div className="mt-6 grid gap-9 lg:grid-cols-[1.15fr_0.85fr]">
          <Reveal delay={90}>
            <blockquote className="relative border-l-[3px] border-ember-500 pl-6 md:pl-8">
              <Quote className="absolute -top-2 left-[-13px] h-6 w-6 rounded bg-ink-950 p-0.5 text-ember-500" />
              <p className="font-display text-[21px] font-semibold leading-[1.38] tracking-tight text-ink-50 md:text-[27px]">
                Without an effective drought monitoring and early warning system to deliver timely information for
                early action, the country will continue to respond to drought in a reactive, crisis management mode.
              </p>
              <cite className="mt-3.5 block font-mono text-[10.5px] uppercase not-italic tracking-[0.18em] text-ink-400">
                — World Bank · Botswana Drought Resilience Profile · 2021
              </cite>
            </blockquote>
            <p className="mt-7 font-display text-[17px] font-semibold tracking-tight text-ink-100 md:text-[19px]">
              That sentence is the brief. <span className="text-ember-400">BWDAS is the implementation.</span>
            </p>
            <p className="mt-4 max-w-2xl text-[13.5px] leading-relaxed text-ink-300 md:text-[14px]">
              Botswana's Department of Meteorological Services puts the probability of El Niño dominating the
              October&nbsp;2026 – March&nbsp;2027 planting season at over 90%. The data needed to warn people —
              satellite rainfall, soil moisture, vegetation stress, livestock auction prices — is real, current and
              free. It is simply fragmented across six government departments, three international bodies and a
              handful of NGOs who do not share in real time. BWDAS is the missing integration layer: a live,
              weekly, district-level stress index that reaches extension officers in the field — not as a PDF
              report, as a WhatsApp alert.
            </p>
            <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-ink-300 md:text-[14px]">
              It runs the Combined Drought Indicator — the methodology the World Bank and NDMC validated{" "}
              <em className="text-ink-100">for Botswana</em> in 2018 and never operationalised — on satellite
              infrastructure that did not exist when AMEWI, the last attempt, was discontinued in 2018.
            </p>
          </Reveal>

          <div className="space-y-3">
            <Reveal delay={170}>
              <Countdown target={DEADLINE_POC} title="PoC hard deadline" sub="15 September 2026 — showable to a real stakeholder" tone="ember" />
            </Reveal>
            <Reveal delay={250}>
              <Countdown target={SEASON_START} title="El Niño planting season" sub="1 October 2026 — the window the PoC must beat" tone="mint" />
            </Reveal>
            <Reveal delay={330}>
              <div className="panel border-ember-500/40 bg-ember-500/[0.05] p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ember-400">Next action · phase 0</p>
                <p className="mt-1.5 font-display text-[15.5px] font-semibold text-ink-50">Submit the GEE account request</p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-300">
                  Research/Education at Botswana Accountancy College. Approval can take 24 hours — the single hard
                  blocker for everything downstream.
                </p>
                <a
                  href="https://earthengine.google.com/signup/"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2.5 inline-flex items-center gap-1.5 font-mono text-[11px] text-cobalt-300 underline decoration-cobalt-500/40 underline-offset-2 transition-colors hover:text-cobalt-200"
                >
                  earthengine.google.com/signup <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </Reveal>
          </div>
        </div>

        <Reveal delay={150} className="mt-10">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-ink-700/70 bg-ink-700/60 sm:grid-cols-5">
            {STATS.map((s) => (
              <div key={s.label} className="group bg-ink-900 p-4 transition-colors hover:bg-ink-850">
                <div className="font-display text-[22px] font-bold tracking-tight text-ink-50 transition-colors group-hover:text-ember-300">
                  {s.big}
                </div>
                <div className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-400">{s.label}</div>
                <div className="mt-1 text-[10.5px] leading-snug text-ink-500">{s.sub}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* 01 — stress map */}
      <section id="map" className="scroll-mt-28 pt-16 md:pt-24">
        <SectionHead
          index="01"
          kicker="What the system produces"
          title="Nine districts, one weekly stress score"
          lede="Every Monday at 06:00 each district is scored 0–100 on the Combined Drought Indicator and classed Low → Severe. Toggle between the current late-dry-season baseline and the projected El Niño peak — this is exactly what a district drought committee would open."
        />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Reveal className="panel flex flex-col p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-md border border-ink-700 bg-ink-900 p-0.5">
                {(
                  [
                    ["baseline", "Aug 2026 · now"],
                    ["peak", "Jan–Mar 2027 · El Niño peak"],
                  ] as [Scenario, string][]
                ).map(([s, label]) => (
                  <button
                    key={s}
                    onClick={() => setScenario(s)}
                    className={`rounded px-3 py-1.5 font-mono text-[11px] transition-all ${
                      scenario === s
                        ? "bg-ember-500/20 text-ember-300 shadow-[inset_0_0_0_1px_rgba(237,162,47,0.45)]"
                        : "text-ink-400 hover:text-ink-100"
                    }`}
                  >
                    {label}
                    {s === "peak" && (
                      <span className={`ml-1.5 text-[8.5px] uppercase tracking-widest ${scenario === s ? "text-ember-500" : "text-ink-600"}`}>
                        projected
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-500">
                GADM Level 1 · stylised geometry
              </span>
            </div>

            <div className="my-4 flex flex-wrap gap-2">
              {LEVELS.map((l) => (
                <span key={l.name} className="inline-flex items-center gap-1.5 rounded border border-ink-700 bg-ink-900 px-2 py-1 font-mono text-[10px] text-ink-300">
                  <span className="h-2 w-2 rounded-sm" style={{ background: l.color }} />
                  {l.name} {l.min}–{l.min + 24}
                  <span className="text-ink-500">
                    · {DISTRICTS.filter((d) => levelOf(cdiOf(d.scores[scenario])).name === l.name).length}
                  </span>
                </span>
              ))}
            </div>

            <BotswanaMap scenario={scenario} selected={selected} onSelect={setSelected} />
            <p className="mt-2 text-center font-mono text-[10px] leading-relaxed text-ink-500">
              click a district for its dossier · scores are illustrative until the Phase 1 pipeline ingests CHIRPS,
              Sentinel-2, MODIS and SMAP
            </p>
          </Reveal>
          <Reveal delay={140}>
            <DistrictPanel d={district} scenario={scenario} />
          </Reveal>
        </div>
      </section>

      {/* 02 — the index */}
      <section id="cdi" className="scroll-mt-28 pt-16 md:pt-24">
        <SectionHead
          index="02"
          kicker="The methodology — fixed by design"
          title="Combined Drought Indicator · 40 / 20 / 20 / 20"
          lede="Not a novel index. It is Botswana's own endorsed approach — validated by the World Bank and NDMC in 2018, then left as a single static map. Each variable is normalised to 0–100 (100 = maximum stress) and weighted. The weights never change, because 'the government's own methodology, run live' is the credibility argument."
        />
        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <Reveal className="panel p-5">
            <WeightDonut />
          </Reveal>
          <Reveal delay={130} className="flex flex-col gap-4">
            <div className="panel p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">Stress classification</p>
              <div className="mt-3 flex h-10 overflow-hidden rounded-md">
                {LEVELS.map((l) => (
                  <div
                    key={l.name}
                    className="group flex flex-1 flex-col items-center justify-center transition-transform hover:scale-y-110"
                    style={{ background: l.color }}
                  >
                    <span className="font-display text-[12px] font-bold" style={{ color: l.ink }}>
                      {l.name}
                    </span>
                    <span className="font-mono text-[8.5px]" style={{ color: l.ink, opacity: 0.75 }}>
                      {l.min}–{l.min + 24}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ["WATCH", "≥ 50", "#EF9F27"],
                  ["ACTION REQUIRED", "≥ 75", "#D85A30"],
                  ["EMERGENCY", "≥ 90", "#A32D2D"],
                ].map(([n, t, c]) => (
                  <span key={n} className="inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px]" style={{ borderColor: `${c}66`, background: `${c}1a`, color: c }}>
                    <BellRing className="h-3 w-3" />
                    {n} {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="panel space-y-2.5 p-5">
              <p className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-ink-300">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-400" />
                All four feeds are free and need no approvals — SASSCAL's 15 ground stations are a validation layer,
                never a dependency.
              </p>
              <p className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-ink-300">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-400" />
                Zero AI in the PoC: a weighted index is deterministic, explainable and directly comparable to the
                World Bank's 2018 map.
              </p>
              <p className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-ink-300">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-400" />
                No local GPU: all heavy processing runs server-side in Google Earth Engine.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 03 — pipeline */}
      <section id="pipeline" className="scroll-mt-28 pt-16 md:pt-24">
        <SectionHead
          index="03"
          kicker="How the data moves"
          title="Four satellites → one CSV → one number → one message"
          lede="Pipeline-first, not portal-first — the deliberate opposite of AMEWI. Everything runs on a laptop with Windows Task Scheduler on Monday mornings; GitHub Actions takes over after the PoC."
        />
        <Reveal className="flex flex-col items-stretch lg:flex-row lg:items-center">
          <NodeShell icon={<Satellite className="h-4 w-4" />} title="4 satellite feeds">
            <ul className="space-y-1.5">
              {WEIGHTS.map((w) => (
                <li key={w.key} className="flex items-center gap-2 font-mono text-[10.5px] text-ink-300">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: w.color }} />
                  <span className="text-ink-100">{w.key}</span>
                  <span className="min-w-0 truncate text-ink-500">{w.dataset}</span>
                </li>
              ))}
            </ul>
          </NodeShell>
          <Conn />
          <NodeShell icon={<Cpu className="h-4 w-4" />} title="Google Earth Engine">
            <p className="font-mono text-[10.5px] leading-relaxed text-ink-400">
              zonal stats per district
              <br />
              free · zero local GPU
            </p>
          </NodeShell>
          <Conn />
          <NodeShell icon={<FileSpreadsheet className="h-4 w-4" />} title="master_district.csv">
            <p className="font-mono text-[10.5px] leading-relaxed text-ink-400">
              9 rows × ~12 columns
              <br />
              one district per row
            </p>
          </NodeShell>
          <Conn />
          <NodeShell icon={<Calculator className="h-4 w-4" />} title="cdi.py">
            <p className="font-mono text-[10.5px] leading-relaxed text-ink-400">
              0.4·SPI + 0.2·NDVI
              <br />
              + 0.2·LST + 0.2·SM
            </p>
          </NodeShell>
          <Conn />
          <PhoneMock />
        </Reveal>
      </section>

      {/* 04 — plan */}
      <section id="plan" className="scroll-mt-28 pt-16 md:pt-24">
        <SectionHead
          index="04"
          kicker="31 days, five phases, zero slippage"
          title="The plan to September 15"
          lede="Deadline discipline is explicit: if a task overruns, scope narrows — the timeline never extends, because the PoC must be showable before the season starts in October."
        />
        <Reveal>
          <PhasePlan />
        </Reveal>
      </section>

      {/* 05 — layers */}
      <section id="layers" className="scroll-mt-28 pt-16 md:pt-24">
        <SectionHead
          index="05"
          kicker="One dataset, three revenue layers"
          title="Who this serves — and who pays"
          lede="Deliverable-based contracts first, not a SaaS product — AMEWI died grant-dependent; BWDAS is self-sustaining from contract revenue in year one."
        />
        <Reveal>
          <ServesLayers />
        </Reveal>
      </section>

      {/* 06 — contacts */}
      <section id="contacts" className="scroll-mt-28 pt-16 md:pt-24">
        <SectionHead
          index="06"
          kicker="Outreach — one page, one ask"
          title="First contacts and exactly how to frame them"
          lede="A one-page leave-behind, never the full brief. The ask is always the same: 30 minutes, and DMS ground-station data to calibrate the satellite signal."
        />
        <Reveal className="panel divide-y divide-ink-700/60 overflow-hidden">
          {STAKEHOLDERS.map((s) => (
            <div key={s.name} className="group grid gap-2 p-4 transition-colors hover:bg-ink-800/50 md:grid-cols-[1.1fr_1.4fr_auto] md:items-center md:gap-4">
              <div>
                <p className="font-display text-[14.5px] font-semibold text-ink-50">{s.name}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">{s.org}</p>
              </div>
              <div className="text-[12px] leading-relaxed text-ink-300">
                <p>
                  <span className="mr-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ember-400">why</span>
                  {s.why}
                </p>
                <p className="mt-1">
                  <span className="mr-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-mint-400">frame</span>
                  {s.approach}
                </p>
              </div>
              <span className="self-start rounded-md border border-cobalt-500/40 bg-cobalt-500/10 px-2.5 py-1 font-mono text-[10.5px] text-cobalt-300 md:self-center">
                {s.contact}
              </span>
            </div>
          ))}
        </Reveal>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {PITCH_PAIRS.map((p, i) => (
            <Reveal key={i} delay={i * 120} className="panel space-y-3 p-4">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-rust-500/50 bg-rust-500/10">
                  <X className="h-3 w-3 text-rust-400" />
                </span>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-rust-400">Do not say</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-300">{p.dont}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 border-t border-ink-800 pt-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-mint-600/50 bg-mint-500/10">
                  <Check className="h-3 w-3 text-mint-400" />
                </span>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-mint-400">Say instead</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-100">{p.do}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* long game */}
      <section className="pt-16 md:pt-24">
        <Reveal>
          <div className="panel overflow-hidden">
            <div className="border-b border-ink-700/70 px-5 py-3.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ember-400">
                What one validated season buys
              </p>
            </div>
            <ol className="grid gap-px bg-ink-700/50 md:grid-cols-2">
              {LONG_GAME.map((g, i) => (
                <li key={i} className="group bg-ink-850 p-5 transition-colors hover:bg-ink-800">
                  <span className="font-mono text-[11px] font-bold text-ember-400">{String(i + 1).padStart(2, "0")}</span>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-200">{g}</p>
                </li>
              ))}
            </ol>
            <div className="border-t border-ink-700/70 bg-ink-900/60 px-5 py-5">
              <p className="font-display text-[16px] font-semibold leading-relaxed tracking-tight text-ink-100 md:text-[18px]">
                “The technical gap is not data — everyone sees the same satellites. The gap is the integration layer
                and the last mile.”
              </p>
              <p className="mt-3 font-mono text-[10.5px] text-ink-500">
                compiled from <span className="text-ink-300">BWDAS.MD</span> · generated 15 Aug 2026 · owner Brent
                Molefe · Gaborone ·{" "}
                <a
                  href="https://github.com/Brent26/BWDAS"
                  target="_blank"
                  rel="noreferrer"
                  className="text-cobalt-300 underline decoration-cobalt-500/40 underline-offset-2 hover:text-cobalt-200"
                >
                  source repo ↗
                </a>
              </p>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
