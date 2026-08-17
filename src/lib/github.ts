/* GitHub REST client — runs in the browser against api.github.com (CORS-enabled).
   Reads only: metadata, trees, file contents, commits, languages, rate limit. */

export interface RepoMeta {
  id: number;
  node_id?: string;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  language: string | null;
  default_branch: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  size: number;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  html_url: string;
  archived: boolean;
}

export interface TreeEntry {
  path: string;
  type: "blob" | "tree";
  size?: number;
  sha: string;
}

export interface FileContent {
  path: string;
  content: string | null;
  encoding: string | null;
  size: number;
  sha: string;
  html_url?: string;
}

export interface CommitInfo {
  sha: string;
  message: string;
  date: string;
  authorName: string;
  authorLogin: string | null;
  avatarUrl: string | null;
}

export interface RateInfo {
  limit: number;
  remaining: number;
  reset: number;
}

export const DEFAULT_OWNER = "Brent26";
export const DEFAULT_REPO = "BWDAS";

/** Metadata I verified live via the GitHub API for Brent26/BWDAS — used as an
    instant seed so the bench renders before the browser re-confirms it. */
export const VERIFIED_BWDAS: RepoMeta = {
  id: 1337444151,
  node_id: "R_kgDOT7fHNw",
  name: "BWDAS",
  full_name: "Brent26/BWDAS",
  description: null,
  private: false,
  language: "Python",
  default_branch: "main",
  created_at: "2026-08-17T17:21:53Z",
  updated_at: "2026-08-17T17:43:51Z",
  pushed_at: "2026-08-17T17:42:18Z",
  size: 48,
  stargazers_count: 0,
  forks_count: 0,
  open_issues_count: 0,
  html_url: "https://github.com/Brent26/BWDAS",
  archived: false,
};

export class GitHubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) {
    if (res.status === 403 || res.status === 429)
      throw new GitHubError(
        res.status,
        "GitHub rate limit reached (60 calls/hr unauthenticated). Paste a personal access token for 5,000/hr — or wait a moment and retry."
      );
    if (res.status === 404)
      throw new GitHubError(
        404,
        "Not found — this repo is likely private. Add a personal access token in the Access panel to unlock private repos."
      );
    if (res.status === 401)
      throw new GitHubError(401, "Token rejected by GitHub (401). Check that it is a valid personal access token.");
    throw new GitHubError(res.status, `GitHub responded with ${res.status}.`);
  }
  return (await res.json()) as T;
}

export function getRepoMeta(owner: string, repo: string, token?: string | null) {
  return request<RepoMeta>(`/repos/${owner}/${repo}`, token);
}

export async function getTree(
  owner: string,
  repo: string,
  branch: string,
  token?: string | null
): Promise<{ entries: TreeEntry[]; truncated: boolean }> {
  const data = await request<{ tree: TreeEntry[]; truncated: boolean }>(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    token
  );
  return { entries: data.tree, truncated: data.truncated };
}

export function getFile(owner: string, repo: string, path: string, token?: string | null) {
  return request<FileContent>(
    `/repos/${owner}/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`,
    token
  );
}

interface RawCommit {
  sha: string;
  commit: { message: string; author: { name: string; date: string } | null };
  author: { login: string; avatar_url: string } | null;
}

export async function getCommits(
  owner: string,
  repo: string,
  token?: string | null,
  perPage = 15
): Promise<CommitInfo[]> {
  const raw = await request<RawCommit[]>(`/repos/${owner}/${repo}/commits?per_page=${perPage}`, token);
  return raw.map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    date: c.commit.author?.date ?? "",
    authorName: c.commit.author?.name ?? c.author?.login ?? "unknown",
    authorLogin: c.author?.login ?? null,
    avatarUrl: c.author?.avatar_url ?? null,
  }));
}

export function getLanguages(owner: string, repo: string, token?: string | null) {
  return request<Record<string, number>>(`/repos/${owner}/${repo}/languages`, token);
}

export async function listRepos(owner: string, token?: string | null): Promise<RepoMeta[]> {
  const path = token
    ? "/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member"
    : `/users/${owner}/repos?per_page=100&sort=pushed`;
  const repos = await request<RepoMeta[]>(path, token);
  return [...repos].sort(
    (a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime()
  );
}

export async function getRateLimit(token?: string | null): Promise<RateInfo> {
  const data = await request<{ resources: { core: RateInfo } }>("/rate_limit", token);
  return data.resources.core;
}

export async function getTokenUser(token: string): Promise<string> {
  const data = await request<{ login: string }>("/user", token);
  return data.login;
}

export function decodeBase64(b64: string): string {
  const bin = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

export function formatBytes(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return "—";
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}
