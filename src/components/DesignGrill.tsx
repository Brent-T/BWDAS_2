import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Flame, Lock, Scale } from "lucide-react";
import { QUESTIONS } from "../data/pipeline";
import type { GrillOption } from "../data/pipeline";

const VERDICT = {
  aligned: { label: "aligned", cls: "border-ok/50 bg-ok/10 text-ok", dot: "bg-ok" },
  risky: { label: "risky", cls: "border-warn/50 bg-warn/10 text-warn", dot: "bg-warn" },
  avoid: { label: "push back", cls: "border-bad/50 bg-bad/10 text-bad", dot: "bg-bad" },
} as const;

export function DesignGrill() {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const locked = Object.keys(answers).length;

  const choose = (qid: string, idx: number) => setAnswers((prev) => ({ ...prev, [qid]: idx }));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-3.5">
        {QUESTIONS.map((q, qi) => {
          const chosen = answers[q.id];
          const answered = chosen !== undefined;
          const opt: GrillOption | undefined = answered ? q.options[chosen] : undefined;
          return (
            <div key={q.id} className={`panel p-4 transition-colors ${answered ? "border-sand-600" : ""}`}>
              <div className="flex items-start gap-3">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border font-mono text-[11px] font-bold ${answered ? "border-ochre-500/50 bg-ochre-500/10 text-ochre-300" : "border-bw-line text-sand-500"}`}>
                  {String(qi + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-sand-500">{q.topic}</p>
                  <p className="font-display text-[15px] font-semibold leading-snug text-sand-50">{q.prompt}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5 pl-10">
                {q.options.map((o, oi) => {
                  const isChosen = chosen === oi;
                  return (
                    <button
                      key={oi}
                      onClick={() => choose(q.id, oi)}
                      className={`rounded-md border px-2.5 py-1.5 text-left font-mono text-[11px] transition-all active:scale-[0.98] ${
                        isChosen
                          ? `${VERDICT[o.verdict].cls} font-medium`
                          : "border-bw-line bg-bw-900 text-sand-300 hover:border-sand-600 hover:text-sand-100"
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>

              <AnimatePresence>
                {answered && opt && (
                  <motion.div
                    key={chosen}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-10 mt-3 rounded-md border border-bw-line bg-bw-900/70 p-3">
                      <span className={`inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider ${VERDICT[opt.verdict].cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${VERDICT[opt.verdict].dot}`} />
                        {VERDICT[opt.verdict].label}
                      </span>
                      <p className="mt-2 text-[12.5px] leading-relaxed text-sand-200">{opt.feedback}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!answered && <p className="ml-10 mt-2.5 font-mono text-[10.5px] text-sand-600">{q.why}</p>}
            </div>
          );
        })}
      </div>

      {/* decision log */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="panel overflow-hidden">
          <div className="flex items-center gap-2 border-b border-bw-line px-3.5 py-3">
            <Scale className="h-4 w-4 text-ochre-400" />
            <h3 className="panel-title">Decision log</h3>
            <span className="ml-auto font-mono text-[10.5px] text-sand-500">
              {locked}/{QUESTIONS.length}
            </span>
          </div>
          <div className="px-3.5 py-3">
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-bw-700">
              <div className="h-full rounded-full bg-ochre-400 transition-all duration-500" style={{ width: `${(locked / QUESTIONS.length) * 100}%` }} />
            </div>
            {locked === 0 ? (
              <p className="text-[11.5px] leading-relaxed text-sand-500">
                Your answers accumulate here into a record you can drop straight into <span className="font-mono text-sand-300">BWDAS.MD</span> as an architecture-decisions appendix.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {QUESTIONS.filter((q) => answers[q.id] !== undefined).map((q) => {
                  const o = q.options[answers[q.id]];
                  const v = VERDICT[o.verdict];
                  return (
                    <li key={q.id} className="flex items-start gap-2">
                      <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${v.dot}`} />
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-sand-500">{q.topic}</p>
                        <p className="truncate text-[11.5px] text-sand-200" title={o.label}>{o.label}</p>
                      </div>
                      <Lock className="ml-auto mt-0.5 h-3 w-3 shrink-0 text-sand-600" />
                    </li>
                  );
                })}
              </ul>
            )}
            {locked === QUESTIONS.length && (
              <div className="mt-3 flex items-center gap-2 rounded-md border border-ok/40 bg-ok/10 px-2.5 py-2">
                <Flame className="h-3.5 w-3.5 text-ok" />
                <p className="font-mono text-[10.5px] text-ok">review complete — export this to the brief</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
