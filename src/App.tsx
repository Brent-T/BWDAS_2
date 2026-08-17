import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpenText,
  ChevronDown,
  Code2,
  ExternalLink,
  FolderGit2,
  History,
  Lock,
  Pin,
  RefreshCw,
} from "lucide-react";
import { ConsoleStrip } from "./components/ConsoleStrip";
import { FileTree } from "./components/FileTree";
import { CodeViewer } from "./components/CodeViewer";
import { CommitsPanel } from "./components/CommitsPanel";
import { RepoVitals } from "./components/RepoVitals";
import { AccessPanel, WorkflowCard } from "./components/AccessPanel";
import { Markdown } from "./lib/markdown";
import {
  DEFAULT_OWNER,
  DEFAULT_REPO,
  VERIFIED_BWDAS,
  decodeBase64,
  getCommits,
  getFile,
  getLanguages,
  getRateLimit,
  getRepoMeta,
  getTokenUser,
  getTree,
  listRepos,
} from "./lib/github";
import type { CommitInfo, FileContent, RateInfo, RepoMeta, TreeEntry } from "./lib/github";

const TOKEN_KEY = "bwdas_workbench_pat";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Unexpected error talking to GitHub.";
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode */
  }
}

type Tab = "code" | "readme" | "history";

const TICKER = [
  "BWDAS verified public · Python · branch main · 48 KB",
  "no token → 60 GitHub API calls/hr from this browser",
  "paste a PAT → 5,000 calls/hr + every private repo unlocks",
  "this bench is read-only — commits happen from your machine",
  "click any file to pull its live contents from main",
  "sha pills in History copy the full commit hash",
];

export default function App() {
  const [token, setToken] = useState<string | null>(readStoredToken);
  const [verifiedUser, setVerifiedUser] = useState<string | null>(null);
  const [checkingToken, setCheckingToken] = useState(false);

  const [current, setCurrent] = useState({ owner: DEFAULT_OWNER, repo: DEFAULT_REPO });
  const [branch, setBranch] = useState("main");
  const [meta, setMeta] = useState<RepoMeta | null>(VERIFIED_BWDAS);

  const [tree, setTree] = useState<TreeEntry[] | null>(null);
  const [treeLoading, setTreeLoading] = useState(true);
  const [commits, setCommits] = useState<CommitInfo[] | null>(null);
  const [commitsLoading, setCommitsLoading] = useState(true);
  const [commitsError, setCommitsError] = useState<string | null>(null);
  const [languages, setLanguages] = useState<Record<string, number> | null>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [file, setFile] = useState<FileContent | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [readme, setReadme] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("code");
  const [repos, setRepos] = useState<RepoMeta[] | null>(null);
  const [rate, setRate] = useState<RateInfo | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  const fileCount = useMemo(() => (tree ? tree.filter((e) => e.type === "blob").length : 0), [tree]);

  /* ---------- data loading ---------- */

  const openFile = useCallback(
    async (owner: string, repo: string, path: string, tok: string | null) => {
      setFileLoading(true);
      setFile(null);
      try {
        const f = await getFile(owner, repo, path, tok);
        setFile(f);
      } catch (e) {
        setFile(null);
        setBanner(errMsg(e));
      } finally {
        setFileLoading(false);
      }
    },
    []
  );

  const loadRepo = useCallback(
    async (owner: string, repo: string, tok: string | null) => {
      setRefreshing(true);
      setTreeLoading(true);
      setCommitsLoading(true);
      setTree(null);
      setCommits(null);
      setLanguages(null);
      setFile(null);
      setSelected(null);
      setReadme(null);
      setBanner(null);
      setCommitsError(null);

      let branchName = "main";
      try {
        const m = await getRepoMeta(owner, repo, tok);
        setMeta(m);
        branchName = m.default_branch || "main";
        setBranch(branchName);
      } catch (e) {
        if (owner !== DEFAULT_OWNER || repo !== DEFAULT_REPO) setMeta(null);
        setBanner(errMsg(e));
      }

      const [t, c, l] = await Promise.allSettled([
        getTree(owner, repo, branchName, tok),
        getCommits(owner, repo, tok),
        getLanguages(owner, repo, tok),
      ]);

      if (t.status === "fulfilled") {
        setTree(t.value.entries);
        // auto-pick: README at root → any README → first .py → first file
        const blobs = t.value.entries.filter((e) => e.type === "blob");
        const isReadme = (p: string) => /(^|\/)readme(\.(md|rst|txt))?$/i.test(p);
        const rootReadme = blobs.find((b) => isReadme(b.path) && !b.path.includes("/"));
        const anyReadme = blobs.find((b) => isReadme(b.path));
        const firstPy = blobs.find((b) => b.path.endsWith(".py") && !b.path.includes("/"));
        const pick = (rootReadme ?? firstPy ?? blobs[0])?.path ?? null;

        if (anyReadme) {
          getFile(owner, repo, anyReadme.path, tok)
            .then((f) => f.content && setReadme(decodeBase64(f.content)))
            .catch(() => setReadme(null));
        }
        if (pick) {
          setSelected(pick);
          openFile(owner, repo, pick, tok);
        }
      } else {
        setTree(null);
        setBanner(errMsg(t.reason));
      }

      if (c.status === "fulfilled") setCommits(c.value);
      else setCommitsError(errMsg(c.reason));
      if (l.status === "fulfilled") setLanguages(l.value);

      setTreeLoading(false);
      setCommitsLoading(false);
      setRefreshing(false);

      getRateLimit(tok).then(setRate).catch(() => {});
    },
    [openFile]
  );

  const refreshRepos = useCallback(async (tok: string | null) => {
    try {
      const list = await listRepos(DEFAULT_OWNER, tok);
      setRepos(list);
    } catch {
      setRepos(null);
    }
  }, []);

  useEffect(() => {
    const stored = readStoredToken();
    loadRepo(DEFAULT_OWNER, DEFAULT_REPO, stored);
    refreshRepos(stored);
    if (stored) {
      setCheckingToken(true);
      getTokenUser(stored)
        .then(setVerifiedUser)
        .catch(() => setVerifiedUser(null))
        .finally(() => setCheckingToken(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- actions ---------- */

  const handleTokenChange = useCallback(
    (t: string | null) => {
      setToken(t);
      storeToken(t);
      setCheckingToken(!!t);
      if (t) {
        getTokenUser(t)
          .then((login) => {
            setVerifiedUser(login);
            setBanner(null);
          })
          .catch((e) => {
            setVerifiedUser(null);
            setBanner(errMsg(e));
          })
          .finally(() => setCheckingToken(false));
      } else {
        setVerifiedUser(null);
      }
      refreshRepos(t);
      loadRepo(current.owner, current.repo, t);
    },
    [current, loadRepo, refreshRepos]
  );

  const switchRepo = useCallback(
    (r: RepoMeta) => {
      setSwitcherOpen(false);
      const owner = r.full_name.split("/")[0] || DEFAULT_OWNER;
      setCurrent({ owner, repo: r.name });
      loadRepo(owner, r.name, token);
    },
    [loadRepo, token]
  );

  const handleSelect = useCallback(
    (path: string) => {
      setSelected(path);
      setTab("code");
      openFile(current.owner, current.repo, path, token);
    },
    [current, openFile, token]
  );

  /* click-outside for the switcher */
  useEffect(() => {
    if (!switcherOpen) return;
    const onDown = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) setSwitcherOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [switcherOpen]);

  const publicCount = repos ? repos.filter((r) => !r.private).length : null;
  const switcherRepos = useMemo(() => {
    if (!repos) return null;
    return [...repos].sort((a, b) => {
      const ap = a.full_name === `${DEFAULT_OWNER}/${DEFAULT_REPO}` ? 0 : 1;
      const bp = b.full_name === `${DEFAULT_OWNER}/${DEFAULT_REPO}` ? 0 : 1;
      return ap - bp;
    });
  }, [repos]);

  const githubFileUrl = selected
    ? `https://github.com/${current.owner}/${current.repo}/blob/${branch}/${selected}`
    : undefined;

  const rateTone =
    rate === null ? "bg-ink-400" : rate.remaining > 20 ? "bg-mint-400" : rate.remaining > 5 ? "bg-ember-400" : "bg-rust-500";

  const tabs: { id: Tab; label: string; icon: React.ReactNode; hint: string }[] = [
    { id: "code", label: "Code", icon: <Code2 className="h-3.5 w-3.5" />, hint: `${fileCount || "…"} files` },
    { id: "readme", label: "README", icon: <BookOpenText className="h-3.5 w-3.5" />, hint: readme ? "found" : treeLoading ? "…" : "check" },
    { id: "history", label: "History", icon: <History className="h-3.5 w-3.5" />, hint: commits ? `${commits.length}` : "…" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <div className="bg-scene" aria-hidden />

      {/* ---------- header ---------- */}
      <header className="sticky top-0 z-40 border-b border-ink-700/70 bg-ink-900/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3 lg:px-6">
          <a href="https://github.com/Brent26/BWDAS" target="_blank" rel="noreferrer" className="group flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-md border border-ember-500/50 bg-ember-500/10 transition-all group-hover:bg-ember-500/20 group-hover:shadow-[0_0_18px_rgba(237,162,47,0.25)]">
              <FolderGit2 className="h-4.5 w-4.5 text-ember-400" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-[17px] font-bold tracking-tight text-ink-50">
                BWDAS<span className="text-ember-400">_</span>
              </span>
              <span className="block font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-400">
                repo workbench
              </span>
            </span>
          </a>

          {/* repo switcher */}
          <div className="relative ml-2 hidden sm:block" ref={switcherRef}>
            <button
              onClick={() => setSwitcherOpen((o) => !o)}
              className="flex items-center gap-2 rounded-md border border-ink-700 bg-ink-850 px-3 py-1.5 font-mono text-[12px] text-ink-200 transition-all hover:border-ember-500/50 hover:text-ink-50"
            >
              <span className="text-ink-400">{current.owner}/</span>
              <span className="font-medium text-ember-300">{current.repo}</span>
              <ChevronDown className={`h-3.5 w-3.5 text-ink-400 transition-transform duration-200 ${switcherOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {switcherOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                  className="absolute left-0 top-[calc(100%+6px)] z-50 w-[320px] overflow-hidden rounded-lg border border-ink-600 bg-ink-850 shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
                >
                  <div className="border-b border-ink-700 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
                    {switcherRepos
                      ? `${switcherRepos.length} repos · ${token ? "token scope" : "public only"}`
                      : "loading repos…"}
                  </div>
                  <div className="max-h-72 overflow-y-auto p-1.5">
                    {!switcherRepos &&
                      [0, 1, 2].map((i) => <div key={i} className="skeleton mx-1.5 my-1.5 h-8" />)}
                    {switcherRepos?.map((r) => {
                      const active = r.full_name === `${current.owner}/${current.repo}`;
                      const pinned = r.full_name === `${DEFAULT_OWNER}/${DEFAULT_REPO}`;
                      return (
                        <button
                          key={r.id}
                          onClick={() => switchRepo(r)}
                          className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors ${
                            active ? "bg-ink-750" : "hover:bg-ink-800"
                          }`}
                        >
                          {pinned ? (
                            <Pin className="h-3.5 w-3.5 shrink-0 text-ember-400" />
                          ) : r.private ? (
                            <Lock className="h-3.5 w-3.5 shrink-0 text-ember-300" />
                          ) : (
                            <FolderGit2 className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate font-mono text-[12.5px] ${active ? "text-ember-300" : "text-ink-100"}`}>
                              {r.name}
                            </span>
                            <span className="block truncate text-[10.5px] text-ink-500">
                              {r.private ? "private · " : ""}
                              {r.language ?? "—"} · pushed {r.pushed_at.slice(0, 10)}
                            </span>
                          </span>
                          {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ember-400" />}
                        </button>
                      );
                    })}
                  </div>
                  {!token && (
                    <div className="border-t border-ink-700 bg-ink-900/60 px-3.5 py-2 text-[10.5px] leading-snug text-ink-400">
                      Only public repos are listed. Add a token in the Access panel to see private ones.
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span
              className="hidden items-center gap-1.5 rounded-md border border-ink-700 bg-ink-850 px-2.5 py-1.5 font-mono text-[10.5px] text-ink-300 md:inline-flex"
              title="GitHub REST API quota remaining for this browser"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${rateTone}`} />
              api {rate ? `${rate.remaining}/${rate.limit}` : "…"}
            </span>
            <button
              onClick={() => loadRepo(current.owner, current.repo, token)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-850 px-2.5 py-1.5 font-mono text-[11px] text-ink-200 transition-all hover:border-mint-500/50 hover:text-mint-300 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">refresh</span>
            </button>
            <a
              href={`https://github.com/${current.owner}/${current.repo}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-cobalt-500/50 bg-cobalt-500/10 px-2.5 py-1.5 font-mono text-[11px] text-cobalt-300 transition-all hover:bg-cobalt-500/20 active:scale-95"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">github</span>
            </a>
          </div>
        </div>
      </header>

      <ConsoleStrip />

      {/* ---------- error banner ---------- */}
      <AnimatePresence>
        {banner && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-b border-rust-500/40 bg-rust-500/10"
          >
            <div className="mx-auto flex max-w-[1600px] items-center gap-2.5 px-4 py-2 lg:px-6">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rust-400" />
              <p className="min-w-0 flex-1 font-mono text-[11.5px] text-rust-300">{banner}</p>
              <button
                onClick={() => loadRepo(current.owner, current.repo, token)}
                className="shrink-0 rounded border border-rust-500/50 px-2 py-0.5 font-mono text-[10.5px] text-rust-300 transition-colors hover:bg-rust-500/15"
              >
                retry
              </button>
              <button
                onClick={() => setBanner(null)}
                className="shrink-0 font-mono text-[10.5px] text-ink-400 transition-colors hover:text-ink-100"
              >
                dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- main bench ---------- */}
      <main className="mx-auto grid w-full max-w-[1600px] flex-1 gap-4 px-4 py-4 lg:grid-cols-[288px_minmax(0,1fr)_332px] lg:px-6">
        {/* explorer */}
        <section className="panel rise flex max-h-[440px] flex-col overflow-hidden lg:sticky lg:top-[122px] lg:h-[calc(100vh-150px)] lg:max-h-none" style={{ animationDelay: "60ms" }}>
          <div className="flex items-center justify-between border-b border-ink-700/70 px-3.5 py-2.5">
            <h2 className="panel-title">Explorer</h2>
            <span className="font-mono text-[10px] text-ink-500">
              <span className="text-mint-400">{branch}</span> · {fileCount || "…"} files
            </span>
          </div>
          <div className="min-h-0 flex-1">
            <FileTree entries={tree} loading={treeLoading} selected={selected} onSelect={handleSelect} fileCount={fileCount} />
          </div>
        </section>

        {/* viewer */}
        <section className="panel rise flex min-h-[560px] flex-col overflow-hidden" style={{ animationDelay: "140ms" }}>
          <div className="flex items-center gap-1 border-b border-ink-700/70 bg-ink-900/50 px-2 pt-2">
            {tabs.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative flex items-center gap-1.5 rounded-t-md px-3.5 py-2 font-mono text-[12px] transition-colors ${
                    active ? "text-ember-300" : "text-ink-400 hover:text-ink-200"
                  }`}
                >
                  {t.icon}
                  {t.label}
                  <span className={`text-[9.5px] ${active ? "text-ember-500" : "text-ink-600"}`}>{t.hint}</span>
                  {active && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-ember-500" />}
                </button>
              );
            })}
            <span className="ml-auto hidden pr-2 font-mono text-[10px] text-ink-500 md:block">
              live from api.github.com
            </span>
          </div>

          <div className="min-h-0 flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 7 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.17, ease: "easeOut" }}
                className="h-full"
              >
                {tab === "code" && (
                  <CodeViewer path={selected} file={file} loading={fileLoading} githubUrl={githubFileUrl} />
                )}
                {tab === "readme" && (
                  <div className="h-full overflow-y-auto px-5 py-4 md:px-7">
                    {treeLoading && !readme ? (
                      <div className="space-y-3">
                        <div className="skeleton h-7 w-1/2" />
                        <div className="skeleton h-3.5 w-full" />
                        <div className="skeleton h-3.5 w-5/6" />
                        <div className="skeleton h-3.5 w-2/3" />
                        <div className="skeleton mt-6 h-5 w-1/3" />
                        <div className="skeleton h-3.5 w-full" />
                        <div className="skeleton h-3.5 w-3/4" />
                      </div>
                    ) : readme ? (
                      <Markdown source={readme} />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                        <BookOpenText className="h-6 w-6 text-ink-500" />
                        <p className="font-display text-[15px] font-semibold text-ink-200">No README on this branch</p>
                        <p className="max-w-xs text-[12.5px] text-ink-400">
                          The repo has no readme file — writing one is a great first change to make together.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {tab === "history" && (
                  <div className="h-full overflow-y-auto">
                    <CommitsPanel
                      commits={commits}
                      loading={commitsLoading}
                      error={commitsError}
                      onRetry={() => loadRepo(current.owner, current.repo, token)}
                    />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        {/* rail */}
        <aside className="space-y-4">
          <div className="rise" style={{ animationDelay: "220ms" }}>
            <RepoVitals meta={meta} languages={languages} commitCount={commits ? commits.length : null} />
          </div>
          <div className="rise" style={{ animationDelay: "300ms" }}>
            <AccessPanel
              token={token}
              onTokenChange={handleTokenChange}
              verifiedUser={verifiedUser}
              checking={checkingToken}
              visibleCount={repos ? repos.length : null}
              publicCount={publicCount}
            />
          </div>
          <div className="rise" style={{ animationDelay: "380ms" }}>
            <WorkflowCard />
          </div>
        </aside>
      </main>

      {/* ---------- ticker ---------- */}
      <div className="marquee-wrap overflow-hidden border-t border-ink-700/70 bg-ink-900/80">
        <div className="animate-marquee flex w-max items-center gap-8 py-2 pl-8">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center gap-8" aria-hidden={dup === 1}>
              {TICKER.map((t, i) => (
                <span key={i} className="flex items-center gap-8 whitespace-nowrap font-mono text-[11px] text-ink-400">
                  <span className="text-ember-500">▰</span> {t}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ---------- footer ---------- */}
      <footer className="border-t border-ink-700/70 bg-ink-950">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3.5 lg:px-6">
          <p className="font-mono text-[10.5px] text-ink-500">
            reads <span className="text-ink-300">github.com/Brent26</span> live · nothing is pushed from this sandbox
          </p>
          <nav className="ml-auto flex items-center gap-4 font-mono text-[10.5px]">
            <a href="https://github.com/Brent26/BWDAS" target="_blank" rel="noreferrer" className="text-ink-400 transition-colors hover:text-ember-300">
              repository ↗
            </a>
            <a href="https://docs.github.com/rest" target="_blank" rel="noreferrer" className="text-ink-400 transition-colors hover:text-ember-300">
              github api ↗
            </a>
            <a
              href="https://github.com/settings/tokens/new?scopes=repo&description=BWDAS%20Workbench"
              target="_blank"
              rel="noreferrer"
              className="text-ink-400 transition-colors hover:text-ember-300"
            >
              new token ↗
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
