/* Canonical BWDAS data — compiled from BWDAS.MD (Aug 15, 2026, Brent Molefe).
   District stress scores are ILLUSTRATIVE scenarios: the live pipeline is Phase 1
   work and has not ingested satellite data yet. Everything else mirrors the doc. */

export type Scores = [number, number, number, number]; // [spi, ndvi, lst, smap] stress 0–100
export type Scenario = "baseline" | "peak";

export interface District {
  id: string;
  name: string;
  short: string;
  points: string; // stylised SVG polygon
  label: { x: number; y: number };
  scores: Record<Scenario, Scores>;
  situation: string; // El Niño peak narrative
  action: string;
}

export interface Level {
  name: "Low" | "Moderate" | "High" | "Severe";
  min: number;
  color: string;
  ink: string;
}

export const LEVELS: Level[] = [
  { name: "Low", min: 0, color: "#C0DD97", ink: "#17290f" },
  { name: "Moderate", min: 25, color: "#EF9F27", ink: "#2e1c03" },
  { name: "High", min: 50, color: "#D85A30", ink: "#fdeedd" },
  { name: "Severe", min: 75, color: "#A32D2D", ink: "#fbe9e4" },
];

export function cdiOf(s: Scores): number {
  return Math.round(s[0] * 0.4 + s[1] * 0.2 + s[2] * 0.2 + s[3] * 0.2);
}

export function levelOf(cdi: number): Level {
  if (cdi >= 75) return LEVELS[3];
  if (cdi >= 50) return LEVELS[2];
  if (cdi >= 25) return LEVELS[1];
  return LEVELS[0];
}

export const WEIGHTS = [
  {
    key: "SPI-3",
    label: "Rainfall deficit",
    source: "CHIRPS daily",
    dataset: "UCSB-CHG/CHIRPS/DAILY",
    res: "5 km · baseline 1981–2025",
    weight: 40,
    color: "#6b9ce8",
  },
  {
    key: "NDVI",
    label: "Vegetation stress",
    source: "Sentinel-2",
    dataset: "COPERNICUS/S2_SR_HARMONIZED",
    res: "10 m · baseline 2017–2024",
    weight: 20,
    color: "#55dda4",
  },
  {
    key: "LST",
    label: "Heat stress",
    source: "MODIS Terra",
    dataset: "MODIS/061/MOD11A1",
    res: "1 km · baseline 2017–2024",
    weight: 20,
    color: "#f26a50",
  },
  {
    key: "SMAP",
    label: "Soil moisture deficit",
    source: "NASA SMAP",
    dataset: "NASA/SMAP/SPL3SMP_E/005",
    res: "36 km · baseline 2015–2024",
    weight: 20,
    color: "#eda22f",
  },
];

export const OUTLINE =
  "58,34 118,26 196,34 262,46 334,74 318,120 336,168 300,226 316,274 286,330 252,356 196,368 128,372 84,356 64,300 72,230 60,160 66,92";

export const DISTRICTS: District[] = [
  {
    id: "north-west",
    name: "North-West",
    short: "N-W",
    points: "58,34 118,26 196,34 262,46 280,120 150,96 110,140 66,92",
    label: { x: 163, y: 74 },
    scores: { baseline: [26, 22, 20, 24], peak: [44, 38, 42, 46] },
    situation: "Okavango inflows sustaining the delta, but dryland cropping under pressure on the fringes.",
    action: "Drought-tolerant seed support; FP158 rangeland plots on weekly NDVI watch.",
  },
  {
    id: "north-east",
    name: "North-East",
    short: "N-E",
    points: "262,46 334,74 318,120 280,120",
    label: { x: 299, y: 90 },
    scores: { baseline: [22, 18, 16, 20], peak: [52, 40, 44, 48] },
    situation: "Mildest district — the Shashe catchment buffers, but the maize belt watches every rainfall decile.",
    action: "Maintain weekly monitoring cadence; pre-position input advisories.",
  },
  {
    id: "central",
    name: "Central",
    short: "CENTRAL",
    points: "280,120 318,120 336,168 300,226 260,210 170,190 150,96",
    label: { x: 250, y: 168 },
    scores: { baseline: [36, 28, 26, 30], peak: [78, 62, 58, 64] },
    situation: "Rangeland condition declining across the district; borehole pressure rising week on week.",
    action: "Rotate grazing, prioritise water-point maintenance, track livestock body condition.",
  },
  {
    id: "ghanzi",
    name: "Ghanzi",
    short: "GHANZI",
    points: "110,140 150,96 170,190 140,270 72,230 60,160",
    label: { x: 112, y: 190 },
    scores: { baseline: [40, 34, 30, 36], peak: [76, 70, 66, 72] },
    situation: "Commercial ranch belt drying fastest in the west; veld-fire risk compounding feed losses.",
    action: "Destock ahead of panic pricing; cut firebreaks; lock in fodder contracts.",
  },
  {
    id: "kgalagadi",
    name: "Kgalagadi",
    short: "KGALAGADI",
    points: "140,270 72,230 64,300 84,356 128,372 170,330",
    label: { x: 114, y: 306 },
    scores: { baseline: [46, 40, 36, 42], peak: [88, 76, 74, 80] },
    situation: "Severe compound stress — projected to be the driest district of the season.",
    action: "Plan emergency water trucking, livestock evacuation routes; trigger anticipatory relief.",
  },
  {
    id: "kweneng",
    name: "Kweneng",
    short: "KWENENG",
    points: "170,190 260,210 230,280 170,330 140,270",
    label: { x: 196, y: 252 },
    scores: { baseline: [36, 30, 28, 32], peak: [82, 68, 66, 71] },
    situation: "Compound drought stress. Grazing deteriorating. Crop establishment at risk.",
    action: "Livestock water supply, fodder advisories, delay planting decisions.",
  },
  {
    id: "kgatleng",
    name: "Kgatleng",
    short: "KGAT.",
    points: "260,210 300,226 316,274 230,280",
    label: { x: 275, y: 244 },
    scores: { baseline: [30, 24, 22, 26], peak: [68, 56, 54, 60] },
    situation: "Smallholder plots missing the establishment window; visible maize stress in late rains.",
    action: "Replant only where soil moisture recovers; push sorghum and millet guidance.",
  },
  {
    id: "south-east",
    name: "South-East",
    short: "S-E",
    points: "230,280 316,274 286,330 252,356",
    label: { x: 273, y: 300 },
    scores: { baseline: [28, 24, 22, 26], peak: [66, 52, 50, 58] },
    situation: "Peri-urban food prices already moving; market stress amplifying farm stress near Gaborone.",
    action: "Coordinate WFP pre-positioning; watch vegetable-belt irrigation demand.",
  },
  {
    id: "southern",
    name: "Southern",
    short: "SOUTHERN",
    points: "230,280 252,356 196,368 128,372 170,330",
    label: { x: 190, y: 330 },
    scores: { baseline: [44, 38, 34, 40], peak: [86, 74, 72, 78] },
    situation: "Hardest hit alongside Kgalagadi — the projection mirrors the 2015–16 impact pattern.",
    action: "Activate district drought committee protocols; ground-truth via extension officers.",
  },
];

export function rawReadings(s: Scores) {
  const [spi, ndvi, lst, sm] = s;
  const pct = (v: number, f: number) => Math.round(Math.abs(v - 50) * f);
  const spiVal = (50 - spi) / 28;
  return [
    {
      label: "Rainfall · SPI-3",
      value: spi,
      detail: `${spiVal > 0 ? "+" : "−"}${Math.abs(spiVal).toFixed(1)} SPI · ${
        spi >= 50 ? `${pct(spi, 1.05)}% below 10-yr avg` : `${pct(spi, 1.05)}% above avg`
      }`,
    },
    {
      label: "Vegetation · NDVI",
      value: ndvi,
      detail: `${pct(ndvi, 0.72)}% ${ndvi >= 50 ? "below" : "above"} seasonal average`,
    },
    {
      label: "Heat · LST",
      value: lst,
      detail: `${lst >= 50 ? "+" : "−"}${(Math.abs(lst - 50) * 0.06).toFixed(1)} °C ${
        lst >= 50 ? "above" : "below"
      } seasonal`,
    },
    {
      label: "Soil moisture · SMAP",
      value: sm,
      detail: `${pct(sm, 0.85)}% ${sm >= 50 ? "below" : "above"} baseline`,
    },
  ];
}

export function baselineText(level: Level): { situation: string; action: string } {
  if (level.name === "Low")
    return {
      situation: "Within normal variability for the late dry season.",
      action: "Weekly satellite refresh only — no field action required.",
    };
  return {
    situation: "Elevated dry-season stress — expected for August, worth watching as El Niño develops.",
    action: "Pre-position advisories; confirm water-point and fodder readiness.",
  };
}

export interface Phase {
  id: number;
  name: string;
  window: string;
  deadline: string; // ISO date
  milestone: string;
  detail: string;
}

export const PHASES: Phase[] = [
  {
    id: 0,
    name: "Environment setup",
    window: "days 1–2",
    deadline: "2026-08-17",
    milestone: "GEE authenticated · Earthdata live · GADM Level 1 downloaded",
    detail: "GEE approval can take 24 h — the single hard blocker for everything.",
  },
  {
    id: 1,
    name: "Data pipeline",
    window: "days 3–10",
    deadline: "2026-08-25",
    milestone: "master_district.csv — 4 variables × 9 districts",
    detail: "CHIRPS → Sentinel-2 → MODIS → SMAP → merge, all through GEE.",
  },
  {
    id: 2,
    name: "CDI + dashboard",
    window: "days 11–21",
    deadline: "2026-09-05",
    milestone: "bwdas_poc_map.html — choropleth, district panels, Monday 06:00 refresh",
    detail: "Folium map that opens anywhere. No server, no domain, no deployment.",
  },
  {
    id: 3,
    name: "Alert engine",
    window: "days 22–27",
    deadline: "2026-09-12",
    milestone: "Threshold alerts at 50 / 75 / 90 firing to WhatsApp via CallMeBot",
    detail: "End-to-end test: pipeline → cdi.py → alert on a real phone.",
  },
  {
    id: 4,
    name: "Show it",
    window: "days 28–31",
    deadline: "2026-09-15",
    milestone: "One-pager in front of DMS, CI Botswana or BITRI",
    detail: "One page, one ask: a 30-minute meeting and ground-station data.",
  },
];

export const LAYERS = [
  {
    tag: "L1",
    name: "Government & extension dashboard",
    who: "MoA · DAPS extension officers · EWTC · district drought committees",
    what: "Weekly district CDI map; WhatsApp and SMS alerts when any district crosses 50 / 75 / 90",
    value: "Turns the national seasonal outlook into a field-level instruction",
    money: "contract · P500k–P2M/yr · NDC2 leverage",
  },
  {
    tag: "L2",
    name: "Agribusiness intelligence feed",
    who: "agro-dealers · cattle traders · BAMB · input suppliers · lenders",
    what: "Livestock offtake timing, district input-demand forecasts, commodity price stress",
    value: "Four weeks of warning before a panic sell-off is a material commercial edge",
    money: "subscriptions · P5k–15k/mo · 5 subs cover infra",
  },
  {
    tag: "L3",
    name: "Humanitarian pre-positioning",
    who: "WFP Botswana · UNICEF · Oxfam · CI FP158 programme",
    what: "60–90 day food-insecurity probability by village cluster; FP158 recovery tracking vs controls",
    value: "Aid moves before the peak, not after — exactly what anticipatory-action budgets fund",
    money: "engagements · $20k–50k each",
  },
];

export const BELAP_NOTE =
  "Labour, education and economic data from Stats Botswana — already partially built as the BELAP pipeline. Overlaid on agricultural stress it yields compound vulnerability scores no single-sector dashboard can compute.";

export const STAKEHOLDERS = [
  {
    name: "Pearl Gosiame",
    org: "Dept. of Meteorological Services",
    why: "Holds the EWS mandate, the SASSCAL station data, and co-developed the CDI itself",
    approach: "Data collaboration — you are operationalising the methodology she helped write",
    contact: "pgosiame@gov.bw",
  },
  {
    name: "CI Botswana — FP158 M&E lead",
    org: "Conservation International",
    why: "The $96.7M GCF rangeland programme needs near-real-time monitoring for reporting",
    approach: "Fastest route to revenue — B2B, far shorter procurement cycle than government",
    contact: "LinkedIn · CI Botswana",
  },
  {
    name: "Prof. Nnyaladzi Batisani",
    org: "BITRI — Climate Change Division",
    why: "Partner or competitor — one conversation answers which",
    approach: "Climate modelling division · TNA working group member",
    contact: "nbatisani@bitri.co.bw",
  },
];

export const PITCH_PAIRS = [
  {
    dont: "“Botswana has no early warning system.”",
    do: "“Botswana had AMEWI — discontinued in 2018. The World Bank CDI was validated here in 2018 and never ran live. BWDAS runs it weekly.”",
  },
  {
    dont: "“I built an AI drought platform.”",
    do: "“District-level stress intelligence that reaches extension officers as a WhatsApp alert — not a PDF report.”",
  },
];

export const LONG_GAME = [
  "A proprietary district-level ground-truth dataset from the worst El Niño in a decade — no competitor replicates it without running their own season.",
  "BELAP integration: labour + education + economic signals over agricultural stress → compound vulnerability nobody else computes.",
  "SADC expansion: the same satellite stack covers Zimbabwe and Zambia without rebuilding the pipeline.",
  "Entry point to a Botswana investor-intelligence platform — climate risk is sector intelligence for capital allocators.",
];

export const STATS = [
  { big: ">90%", label: "El Niño probability", sub: "DMS · Oct 26 – Mar 27 season" },
  { big: "36M", label: "people pushed into hunger", sub: "last super El Niño · 2015–16" },
  { big: "9", label: "districts scored weekly", sub: "GADM Level 1 boundaries" },
  { big: "6+", label: "data holders unified", sub: "govt depts · SADC · World Bank" },
  { big: "$2.5B", label: "NDC2 adaptation budget", sub: "84% conditional on climate finance" },
];

export const DEADLINE_POC = new Date("2026-09-15T09:00:00");
export const SEASON_START = new Date("2026-10-01T00:00:00");
