/* eslint-disable @typescript-eslint/no-explicit-any */
// The real deliverables, imported as raw text so the UI always shows the code
// that actually ships in /pipeline — never a hand-copied approximation.
import configPy from "../../pipeline/src/bwdas/config.py?raw";
import modelsPy from "../../pipeline/src/bwdas/models.py?raw";
import basePy from "../../pipeline/src/bwdas/agents/base.py?raw";
import extractPy from "../../pipeline/src/bwdas/agents/extract_agent.py?raw";
import standardizePy from "../../pipeline/src/bwdas/agents/standardize_agent.py?raw";
import loadPy from "../../pipeline/src/bwdas/agents/load_agent.py?raw";
import feedPy from "../../pipeline/src/bwdas/agents/feed_agent.py?raw";
import cliPy from "../../pipeline/src/bwdas/cli.py?raw";

import testExtract from "../../pipeline/tests/test_extract_agent.py?raw";
import testStandardize from "../../pipeline/tests/test_standardize_agent.py?raw";
import testLoad from "../../pipeline/tests/test_load_agent.py?raw";
import testFeed from "../../pipeline/tests/test_feed_agent.py?raw";
import testE2E from "../../pipeline/tests/test_pipeline_e2e.py?raw";

export type Accent = "rain" | "veg" | "heat" | "soil";

export interface Stage {
  id: string;
  name: string;
  etl: "E" | "T" | "L" | "F";
  tagline: string;
  accent: Accent;
  consumes: string;
  produces: string;
}

export interface Agent {
  id: string;
  stage: string;
  name: string;
  file: string;
  accent: Accent;
  charter: string;
  principles: string[];
  consumes: string;
  produces: string;
  code: string;
  testFile: string;
  test: string;
}

export const ACCENT: Record<
  Accent,
  { hex: string; text: string; bg: string; border: string; ring: string; name: string }
> = {
  rain: { hex: "#5aa9d6", text: "text-rain-400", bg: "bg-rain-500/10", border: "border-rain-500/40", ring: "ring-rain-500/30", name: "SPI · rainfall" },
  veg: { hex: "#7cc47f", text: "text-veg-400", bg: "bg-veg-500/10", border: "border-veg-500/40", ring: "ring-veg-500/30", name: "NDVI · vegetation" },
  heat: { hex: "#e8834a", text: "text-heat-400", bg: "bg-heat-500/10", border: "border-heat-500/40", ring: "ring-heat-500/30", name: "LST · heat" },
  soil: { hex: "#d9a441", text: "text-soil-400", bg: "bg-soil-500/10", border: "border-soil-500/40", ring: "ring-soil-500/30", name: "SMAP · soil" },
};

export const STAGES: Stage[] = [
  { id: "extract", name: "Extract", etl: "E", tagline: "pull raw district readings from GEE", accent: "rain", consumes: "GEE collections", produces: "raw_readings" },
  { id: "standardize", name: "Standardize", etl: "T", tagline: "normalize to 0–100, weight, classify", accent: "veg", consumes: "raw_readings", produces: "cdi_records" },
  { id: "load", name: "Load", etl: "L", tagline: "atomic write of the master table", accent: "soil", consumes: "cdi_records", produces: "master_district.csv" },
  { id: "feed", name: "Feed", etl: "F", tagline: "50/75/90 alerts to the field", accent: "heat", consumes: "cdi_records", produces: "alert feed" },
];

export const AGENTS: Agent[] = [
  {
    id: "base",
    stage: "Contract",
    name: "BaseAgent + contract",
    file: "src/bwdas/agents/base.py",
    accent: "soil",
    charter:
      "The seam every stage plugs into. It defines StageResult (a uniform report), PipelineContext (the artifact hand-off) and a template-method execute() that times each stage, captures failures and publishes artifacts. The orchestrator only ever talks to this interface — which is precisely what makes the stages reorderable and independently testable.",
    principles: [
      "Subclasses implement run(), never execute() — the wrapper is shared policy.",
      "Agents hand off via context.artifacts, never by importing each other.",
      "Every failure is captured into a StageResult, not swallowed.",
    ],
    consumes: "—",
    produces: "StageResult / PipelineContext",
    code: basePy,
    testFile: "tests/test_pipeline_e2e.py",
    test: testE2E,
  },
  {
    id: "extract",
    stage: "E · Extract",
    name: "ExtractAgent",
    file: "src/bwdas/agents/extract_agent.py",
    accent: "rain",
    charter:
      "Reduces each GEE collection to one value per district over the analysis window and persists a raw JSON artifact for provenance and replay. GEE sits behind the GEEGateway protocol and ee is imported lazily, so this module — and its whole test-suite — runs with zero Earth Engine credentials. A failed cell is logged and skipped, never fatal.",
    principles: [
      "GEE is a dependency injected through a protocol, not a global.",
      "Per-cell isolation: one cloudy Sentinel-2 tile can't kill a national run.",
      "Extraction degrades; it never aborts the pipeline.",
    ],
    consumes: "GEE (CHIRPS · S2 · MODIS · SMAP)",
    produces: "raw_readings",
    code: extractPy,
    testFile: "tests/test_extract_agent.py",
    test: testExtract,
  },
  {
    id: "standardize",
    stage: "T · Standardize",
    name: "StandardizeAgent",
    file: "src/bwdas/agents/standardize_agent.py",
    accent: "veg",
    charter:
      "The core IP, and deliberately pure: no I/O, no clock. It min-max scales each variable to 0–100 (inverting SPI/NDVI/SM where a low value means stress), applies the fixed World Bank weights 40/20/20/20, clamps and classifies each district. A district missing any variable is dropped with an explicit error — imputation is a Phase-1 decision, never a silent default.",
    principles: [
      "Pure function of its inputs — identical readings always yield identical CDI.",
      "Weights are 40/20/20/20 and asserted to sum to 1.0 in config.",
      "No silent imputation; missing data is surfaced, not invented.",
    ],
    consumes: "raw_readings",
    produces: "cdi_records",
    code: standardizePy,
    testFile: "tests/test_standardize_agent.py",
    test: testStandardize,
  },
  {
    id: "load",
    stage: "L · Load",
    name: "LoadAgent",
    file: "src/bwdas/agents/load_agent.py",
    accent: "soil",
    charter:
      "Persists the CDIRecords to master_district.csv via an atomic temp-file + rename, so a consumer can never read a half-written table. Each run also drops an immutable snapshot (cdi_<run_id>.csv) — that growing archive is the validated-season ground truth BWDAS.MD calls the long-term moat, and it makes every run auditable and re-runs idempotent.",
    principles: [
      "Atomic writes: temp file + os.replace, no torn reads on POSIX or Windows.",
      "Every run leaves an immutable snapshot for the ground-truth archive.",
      "Re-running a run_id overwrites deterministically.",
    ],
    consumes: "cdi_records",
    produces: "master_district.csv + snapshot",
    code: loadPy,
    testFile: "tests/test_load_agent.py",
    test: testLoad,
  },
  {
    id: "feed",
    stage: "F · Feed",
    name: "FeedAgent",
    file: "src/bwdas/agents/feed_agent.py",
    accent: "heat",
    charter:
      "Where a CSV becomes an early warning. Applies the 50/75/90 tiers (WATCH / ACTION REQUIRED / EMERGENCY), renders each alert as a plain-language district advisory in the Kweneng format from the brief, and pushes it through a Notifier protocol. The PoC notifier writes a markdown artifact; CallMeBot/WhatsApp slots in as a second Notifier without touching this agent.",
    principles: [
      "Thresholds come from config.alert_level, not inline magic numbers.",
      "Delivery is behind a Notifier protocol — swap WhatsApp/SMS without edits.",
      "Below 50 there is deliberately no alert; silence is a signal.",
    ],
    consumes: "cdi_records",
    produces: "alert feed",
    code: feedPy,
    testFile: "tests/test_feed_agent.py",
    test: testFeed,
  },
];

export const SUPPORT_FILES = [
  { name: "src/bwdas/config.py", note: "datasets, weights, districts, thresholds", code: configPy },
  { name: "src/bwdas/models.py", note: "pydantic row contracts", code: modelsPy },
  { name: "src/bwdas/cli.py", note: "orchestrator the scheduler calls", code: cliPy },
];

export interface GrillOption {
  label: string;
  verdict: "aligned" | "risky" | "avoid";
  feedback: string;
}
export interface GrillQuestion {
  id: string;
  topic: string;
  prompt: string;
  why: string;
  options: GrillOption[];
}

export const QUESTIONS: GrillQuestion[] = [
  {
    id: "gateway",
    topic: "Coupling",
    prompt: "Extract talks to Google Earth Engine. How close to the metal do you let it get?",
    why: "GEE is your only data source and your biggest flake risk (quotas, auth, timeouts). How you wrap it decides whether your test-suite needs credentials.",
    options: [
      { label: "Direct ee.* calls inside the agent", verdict: "avoid", feedback: "Then every test needs ee.Initialize() and a service account. You've made the flakiest dependency mandatory for a unit test. No." },
      { label: "A GEEGateway protocol, ee imported lazily", verdict: "aligned", feedback: "Correct. Tests inject a fake gateway, CI runs credential-free, and swapping to a cached/replay gateway for offline runs is a one-line change." },
      { label: "A global ee singleton configured at import", verdict: "risky", feedback: "Import-time side effects mean importing the module requires auth. You'll regret it the first time a linter or doc build touches it." },
    ],
  },
  {
    id: "missing",
    topic: "Missing data",
    prompt: "A district comes back missing one of the four variables. What happens to that district?",
    why: "This is the single most consequential data-quality decision in the pipeline, and it silently shapes every CDI you ever publish.",
    options: [
      { label: "Impute from neighbours or climatology", verdict: "risky", feedback: "Defensible later, dangerous now. Imputation is a modelling decision that must be validated against ground truth — which you don't have until after one season. Log it as Phase-1 work, not a silent default." },
      { label: "Drop the district, surface a loud error", verdict: "aligned", feedback: "Right call for the PoC. Nine honest scores beat nine polished ones. The error trail is also your evidence when you ask DMS for station data to fill the gap." },
      { label: "Fail the whole run", verdict: "avoid", feedback: "One cloudy tile over Ghanzi shouldn't darken the national picture. Fail-fast belongs at the stage level, not the cell level." },
    ],
  },
  {
    id: "baseline",
    topic: "Normalisation",
    prompt: "You min-max normalise each variable to 0–100. Across what population?",
    why: "The denominator of your normalisation IS your definition of 'stress'. Get the window wrong and every score is miscalibrated.",
    options: [
      { label: "Across the nine districts in the current run", verdict: "aligned", feedback: "This is what the PoC math in BWDAS.MD specifies and what the tests pin down. It's a relative ranking — fine for 'who is worst right now', and honest about being so." },
      { label: "Against the fixed climatological baseline (CHIRPS 1981–2025 etc.)", verdict: "risky", feedback: "Scientifically stronger — an absolute anomaly against history. But it needs baseline statistics computed and stored per district first. That's a real sub-project; sequence it after the PoC proves the plumbing, not instead of it." },
      { label: "Against a rolling 12-month window", verdict: "risky", feedback: "A rolling window redefines 'normal' every week, so scores drift even when conditions don't. Bad for a weekly alert product where comparability across weeks is the whole point." },
    ],
  },
  {
    id: "weights",
    topic: "Methodology",
    prompt: "Someone suggests making the 40/20/20/20 CDI weights configurable per district. Your move?",
    why: "Your credibility argument is 'we run the government's own endorsed method'. This question tests whether you'll spend that credibility.",
    options: [
      { label: "Make weights a config knob", verdict: "avoid", feedback: "The moment weights are tunable, a CDI of 74 in Kweneng isn't comparable to a 74 from the World Bank's 2018 map. You've traded the methodology's authority for flexibility you don't need yet." },
      { label: "Hard-assert 40/20/20/20 sums to 1.0, refuse changes", verdict: "aligned", feedback: "Exactly. config.py asserts the split and the doc marks it non-negotiable. If a stakeholder wants different weights, that's a new, clearly-labelled indicator — not a quiet re-weighting of the CDI." },
    ],
  },
  {
    id: "target",
    topic: "Load target",
    prompt: "The PoC persists to master_district.csv. A reviewer asks why not Supabase/PostGIS now, since it's in the stack.",
    why: "You have ~30 days and one hard deadline. Storage is the classic place scope quietly triples.",
    options: [
      { label: "Ship CSV now; PostGIS is post-PoC", verdict: "aligned", feedback: "BWDAS.MD is explicit: the PoC output is a file that opens in any browser, no server, no deployment. CSV + snapshots is also trivially diffable in git — free auditing. PostGIS earns its keep when the dashboard needs spatial queries, not before." },
      { label: "Wire Supabase now to avoid a migration later", verdict: "risky", feedback: "Migrations are cheap when the table is 9 rows × 13 columns. You'd be spending deadline budget on infra the stakeholder demo never touches. The Load agent's interface already isolates this swap." },
    ],
  },
  {
    id: "failure",
    topic: "Failure policy",
    prompt: "Standardize returns ok=False because zero districts were complete. The Load agent never runs. Is that right?",
    why: "Fail-fast vs degrade-gracefully isn't one policy — it's a different policy per stage, and that distinction is the architecture.",
    options: [
      { label: "Yes — stages after a hard failure must not run", verdict: "aligned", feedback: "Correct. Extraction degrades (partial data is still data), but Standardize/Load/Feed fail-fast: a feed with zero scored districts would silently publish nothing and nobody would notice. A non-zero exit code makes the scheduler shout." },
      { label: "No — run Feed anyway so something always ships", verdict: "avoid", feedback: "Shipping an empty alert feed looks like success. The dangerous failure mode of an early-warning system is not noise, it's silence. Fail loudly." },
    ],
  },
  {
    id: "rerun",
    topic: "Idempotency",
    prompt: "The Monday 06:00 scheduled run crashes at Load. You re-run it. What must be true?",
    why: "A weekly pipeline that can't be safely re-run will be manually babysat — and eventually skipped.",
    options: [
      { label: "Re-run with the same run_id overwrites cleanly; snapshots stay immutable", verdict: "aligned", feedback: "Yes. master_district.csv is the current state (overwrite), cdi_<run_id>.csv is history (append-only). os.replace makes the overwrite atomic, so there's no window where a reader sees garbage." },
      { label: "Every run appends a new master file with a timestamp", verdict: "risky", feedback: "Then consumers don't know which file is current, and 'the master table' becomes a glob pattern. You've moved the coordination problem onto every reader." },
    ],
  },
  {
    id: "scheduler",
    topic: "Orchestration",
    prompt: "How does the weekly run actually get triggered on your Ryzen 5 laptop?",
    why: "The PoC runs where you are — a Windows box with no CUDA and no server. The trigger has to match that reality.",
    options: [
      { label: "Windows Task Scheduler → python -m bwdas.cli run", verdict: "aligned", feedback: "Per the brief, and correct: local, zero cloud dependency, one entry point. The non-zero exit code on failure is what makes it observable. GitHub Actions replaces it post-PoC without touching the agents." },
      { label: "A long-running Python process with a sleep loop", verdict: "avoid", feedback: "A laptop that suspends, a terminal that closes, a reboot — any of them silently kills your 'weekly' system. Cron-style scheduling exists precisely because sleep-loops are fragile." },
    ],
  },
];
