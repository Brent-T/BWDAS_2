import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  File as FileIcon,
  FileCode2,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Search,
} from "lucide-react";
import type { TreeEntry } from "../lib/github";
import { formatBytes } from "../lib/github";

interface TreeNode {
  name: string;
  path: string;
  type: "blob" | "tree";
  size?: number;
  children: TreeNode[];
}

function ensureDir(byPath: Map<string, TreeNode>, rootChildren: TreeNode[], dirPath: string): TreeNode {
  const existing = byPath.get(dirPath);
  if (existing) return existing;
  const parts = dirPath.split("/");
  const name = parts[parts.length - 1];
  const node: TreeNode = { name, path: dirPath, type: "tree", children: [] };
  byPath.set(dirPath, node);
  if (parts.length === 1) {
    rootChildren.push(node);
  } else {
    const parent = ensureDir(byPath, rootChildren, parts.slice(0, -1).join("/"));
    parent.children.push(node);
  }
  return node;
}

function buildTree(entries: TreeEntry[]): TreeNode[] {
  const byPath = new Map<string, TreeNode>();
  const root: TreeNode[] = [];
  for (const e of entries) {
    if (e.type === "tree") {
      ensureDir(byPath, root, e.path);
    } else {
      const parts = e.path.split("/");
      if (parts.length === 1) {
        root.push({ name: e.path, path: e.path, type: "blob", size: e.size, children: [] });
      } else {
        const parent = ensureDir(byPath, root, parts.slice(0, -1).join("/"));
        parent.children.push({ name: parts[parts.length - 1], path: e.path, type: "blob", size: e.size, children: [] });
      }
    }
  }
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === "tree" ? -1 : 1
    );
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(root);
  return root;
}

function fileIcon(name: string) {
  if (/\.(py|pyw|ipynb)$/.test(name)) return <FileCode2 className="h-3.5 w-3.5 text-ember-400" />;
  if (/\.(md|rst|txt)$/.test(name)) return <FileText className="h-3.5 w-3.5 text-mint-400" />;
  if (/\.(json|ya?ml|toml|cfg|ini)$/.test(name)) return <FileJson className="h-3.5 w-3.5 text-cobalt-300" />;
  if (/\.(js|ts|jsx|tsx|html|css|sh)$/.test(name)) return <FileCode2 className="h-3.5 w-3.5 text-cobalt-300" />;
  return <FileIcon className="h-3.5 w-3.5 text-ink-400" />;
}

interface Props {
  entries: TreeEntry[] | null;
  loading: boolean;
  selected: string | null;
  onSelect: (path: string) => void;
  fileCount: number;
}

export function FileTree({ entries, loading, selected, onSelect, fileCount }: Props) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const tree = useMemo(() => (entries ? buildTree(entries) : null), [entries]);

  // Expand the first two directory levels by default.
  useEffect(() => {
    if (!tree) return;
    const next = new Set<string>();
    const walk = (nodes: TreeNode[], depth: number) => {
      for (const n of nodes) {
        if (n.type === "tree") {
          if (depth <= 2) next.add(n.path);
          walk(n.children, depth + 1);
        }
      }
    };
    walk(tree, 1);
    setExpanded(next);
  }, [tree]);

  const matches = useMemo(() => {
    if (!entries || !query.trim()) return null;
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => e.type === "blob" && e.path.toLowerCase().includes(q))
      .slice(0, 60);
  }, [entries, query]);

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    if (node.type === "tree") {
      const open = expanded.has(node.path);
      return (
        <div key={node.path}>
          <button
            onClick={() => toggle(node.path)}
            className="group flex w-full items-center gap-1.5 rounded-sm py-[5px] pr-2 text-left font-mono text-[12.5px] text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100"
            style={{ paddingLeft: `${depth * 14 + 8}px` }}
          >
            <ChevronRight
              className={`h-3 w-3 shrink-0 text-ink-500 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
            />
            {open ? (
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-ember-400" />
            ) : (
              <Folder className="h-3.5 w-3.5 shrink-0 text-ink-400 transition-colors group-hover:text-ember-400" />
            )}
            <span className="truncate">{node.name}</span>
            <span className="ml-auto text-[10px] text-ink-600">{node.children.length}</span>
          </button>
          {open && node.children.map((c) => renderNode(c, depth + 1))}
        </div>
      );
    }
    const active = selected === node.path;
    return (
      <button
        key={node.path}
        onClick={() => onSelect(node.path)}
        className={`relative flex w-full items-center gap-1.5 rounded-sm py-[5px] pr-2 text-left font-mono text-[12.5px] transition-all duration-150 ${
          active
            ? "bg-ink-750 text-ember-300"
            : "text-ink-200 hover:bg-ink-800 hover:text-ink-50 hover:pl-[3px]"
        }`}
        style={{ paddingLeft: `${depth * 14 + 23}px` }}
      >
        {active && <span className="absolute inset-y-1 left-1 w-[2.5px] rounded-full bg-ember-500" />}
        {fileIcon(node.name)}
        <span className="truncate">{node.name}</span>
        <span className="ml-auto shrink-0 text-[10px] text-ink-500">{formatBytes(node.size)}</span>
      </button>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-ink-700/70 p-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filter ${fileCount || ""} files…`}
            className="w-full rounded-md border border-ink-700 bg-ink-900 py-1.5 pl-8 pr-2.5 font-mono text-[12px] text-ink-100 placeholder:text-ink-500 outline-none transition-colors focus:border-ember-500/60 focus:ring-2 focus:ring-ember-500/15"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {loading && (
          <div className="space-y-2 p-2">
            {[72, 55, 84, 48, 66, 58, 76, 42].map((w, i) => (
              <div key={i} className="skeleton h-4" style={{ width: `${w}%` }} />
            ))}
          </div>
        )}

        {!loading && matches && (
          <div>
            <div className="px-2 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">
              {matches.length} match{matches.length === 1 ? "" : "es"}
            </div>
            {matches.map((m) => {
              const active = selected === m.path;
              return (
                <button
                  key={m.path}
                  onClick={() => onSelect(m.path)}
                  className={`flex w-full items-center gap-1.5 rounded-sm px-2 py-[5px] text-left font-mono text-[12px] transition-colors ${
                    active ? "bg-ink-750 text-ember-300" : "text-ink-200 hover:bg-ink-800"
                  }`}
                >
                  {fileIcon(m.path)}
                  <span className="truncate">{m.path}</span>
                </button>
              );
            })}
            {matches.length === 0 && (
              <p className="px-2 py-3 font-mono text-[12px] text-ink-500">No files match “{query}”.</p>
            )}
          </div>
        )}

        {!loading && !matches && tree && tree.map((n) => renderNode(n, 0))}

        {!loading && !matches && (!tree || tree.length === 0) && (
          <p className="px-2 py-4 font-mono text-[12px] text-ink-500">Empty tree — no files on this branch.</p>
        )}
      </div>
    </div>
  );
}
