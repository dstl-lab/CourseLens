import { isPreviewManifestVersion } from "./changeParser";

export type FileClassification = "read_and_changed" | "read_only" | "not_considered";

export interface ToolCallFileEntry {
  path: string;
  basename: string;
  classification: FileClassification;
}

export interface ToolCallAnalysisResult {
  readAndChanged: ToolCallFileEntry[];
  readOnly: ToolCallFileEntry[];
  // not_considered is computed by the UI from repoFiles — not included here
  totalLines: number;
  parseErrors: number;
}

// Tool names used by Codex, Claude Code and similar agents.
const READ_ONLY_TOOLS = new Set([
  "read_file", "view", "open_file", "read", "get_file_content", "Read", "view_file",
  "NotebookRead",
]);

const WRITE_TOOLS = new Set([
  "write_file", "str_replace_editor", "create_file", "patch_file",
  "apply_patch", "edit_file", "replace_in_file", "write", "create",
  "update_file", "overwrite_file", "Edit", "Write", "MultiEdit", "NotebookEdit",
]);

// Searches only count for an explicit file argument (a search over a whole
// folder does not mean the agent looked at every file in it).
const SEARCH_TOOLS = new Set(["Grep", "Glob", "LS", "grep", "glob", "search", "find"]);

const SHELL_TOOLS = new Set(["exec_command", "shell", "bash", "run_command", "Bash", "local_shell"]);

function getBasename(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

function resolvePath(cwd: string, rel: string): string {
  if (/^[a-zA-Z]:/.test(rel) || rel.startsWith("/")) return rel;
  const base = cwd.endsWith("/") ? cwd : cwd + "/";
  const parts = (base + rel).split("/").filter(Boolean);
  const resolved: string[] = [];
  for (const p of parts) {
    if (p === "..") resolved.pop();
    else if (p !== ".") resolved.push(p);
  }
  return "/" + resolved.join("/");
}

function findJsonObjectEnd(text: string, start: number): number | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }

  return null;
}

function extractPreviewManifestFiles(text: string, cwd: string): string[] {
  const files = new Set<string>();
  // Matches the current format name and the earlier one (see isPreviewManifestVersion).
  const marker = "-preview-changes/v1";
  let searchFrom = 0;

  while (true) {
    const markerIndex = text.indexOf(marker, searchFrom);
    if (markerIndex === -1) break;
    searchFrom = markerIndex + marker.length;

    let start = text.lastIndexOf("{", markerIndex);
    while (start !== -1) {
      const end = findJsonObjectEnd(text, start);
      if (end == null) break;

      try {
        const parsed = JSON.parse(text.slice(start, end));
        if (isPreviewManifestVersion(parsed?.version) && Array.isArray(parsed.changes)) {
          for (const change of parsed.changes) {
            const file = change?.file;
            if (typeof file !== "string" || file === "relative/path/to/file.ext") continue;
            files.add(resolvePath(cwd, file));
          }
          break;
        }
      } catch {
        // Try the previous opening brace. Command output can contain JSON-like docs
        // before the actual manifest.
      }

      start = text.lastIndexOf("{", start - 1);
    }
  }

  return [...files];
}

const KNOWN_EXTS = /\.(ipynb|py|md|tex|csv|pdf|html|htm|js|ts|tsx|json|txt|r|Rmd|rst)$/i;

function extractPaths(text: string, cwd: string): string[] {
  const found = new Set<string>();
  // Absolute paths: /foo/bar.ext
  const absRe = /(?<![a-zA-Z0-9_:])(\/([\w.\-]+\/)*[\w.\-]+\.[\w]{1,12})\b/g;
  for (const m of text.matchAll(absRe)) found.add(m[1]);
  // Explicit relative paths: ./foo/bar.ext or ../foo/bar.ext
  const relRe = /(?<![a-zA-Z0-9_])(\.{1,2}\/[\w.\-/]+\.[\w]{1,12})\b/g;
  for (const m of text.matchAll(relRe)) found.add(resolvePath(cwd, m[1]));
  // Relative paths inside folders: lectures/lec05/lec05.ipynb (not parts of
  // absolute paths or URLs, which the lookbehind rules out).
  const nestedRe = /(?<![\w./\\:-])([\w][\w.-]*\/(?:[\w.-]+\/)*[\w.-]+\.\w{1,12})\b/g;
  for (const m of text.matchAll(nestedRe)) {
    if (KNOWN_EXTS.test(m[1])) found.add(resolvePath(cwd, m[1]));
  }
  // Bare relative filenames with known extensions: lec25.ipynb, AGENTS.md, etc.
  const bareRe = /(?<![a-zA-Z0-9_/\\])([\w][\w.\-]*\.[\w]{1,12})\b/g;
  for (const m of text.matchAll(bareRe)) {
    if (KNOWN_EXTS.test(m[1])) found.add(resolvePath(cwd, m[1]));
  }
  return [...found];
}

/** Files named in an apply_patch body ("*** Update File: path"). */
function extractPatchFiles(text: string, cwd: string): string[] {
  const files = new Set<string>();
  for (const m of text.matchAll(/^\*\*\* (?:Update|Add|Delete) File: (.+?)\s*$/gm)) {
    files.add(resolvePath(cwd, m[1].trim()));
  }
  for (const m of text.matchAll(/^\*\*\* Move to: (.+?)\s*$/gm)) {
    files.add(resolvePath(cwd, m[1].trim()));
  }
  return [...files];
}

type ToolArgs = Record<string, unknown>;

function fileArgument(args: ToolArgs): string {
  const value = args.path || args.file_path || args.notebook_path || args.filename || args.target || "";
  return typeof value === "string" ? value : "";
}

function hasWriteIndicator(cmd: string): boolean {
  if (/\bsed\s+(-[a-zA-Z]*i|--in-place)/.test(cmd)) return true;
  if (/(?:^|[|;&\n`])\s*(tee|patch|rm|touch)\s/.test(cmd)) return true;
  // Strip heredoc bodies first (`<<DELIM ... DELIM` or `<<'DELIM' ... DELIM`) —
  // their content is data fed to stdin, so `>` inside Python code (`if x > y`)
  // isn't a shell redirect and must not be treated as one.
  let stripped = cmd.replace(
    /<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\b/g,
    "",
  );
  // Then strip remaining string literals.
  stripped = stripped.replace(/(['"`])(?:(?!\1)[^\\]|\\.)*\1/g, '""');
  if (/(?<![<=>!])(>>?)(?![>=])/.test(stripped)) return true;
  return false;
}

function parseEvents(content: string): { events: any[]; totalLines: number; parseErrors: number } {
  const trimmed = content.trim();

  // JSON array or single object
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const events = Array.isArray(parsed) ? parsed : [parsed];
      return { events, totalLines: events.length, parseErrors: 0 };
    } catch {
      // fall through to JSONL
    }
  }

  // JSONL — one JSON object per line
  const rawLines = trimmed.split("\n").filter((l) => l.trim());
  const events: any[] = [];
  let parseErrors = 0;
  for (const line of rawLines) {
    try {
      events.push(JSON.parse(line));
    } catch {
      parseErrors++;
    }
  }
  return { events, totalLines: rawLines.length, parseErrors };
}

/**
 * Classify the files an agent touched from its activity log.
 *
 * Supports Codex CLI rollouts (`response_item` / `function_call` events) and
 * Claude Code session logs (`assistant` messages with `tool_use` blocks).
 * Files are "changed" when written or named in a generated CourseLens
 * manifest, and "read" when opened, searched as a specific file, or named in a
 * shell command.
 */
export function parseToolCallJsonl(content: string): ToolCallAnalysisResult {
  const { events, totalLines, parseErrors: initialErrors } = parseEvents(content);
  const parseErrors = initialErrors;
  let currentCwd = "/";
  const callCwds = new Map<string, string>();

  const writtenFiles = new Set<string>();
  const readFiles = new Set<string>();

  const recordToolCall = (tool: string, args: ToolArgs, cwd: string) => {
    if (SHELL_TOOLS.has(tool)) {
      const rawCmd = args.cmd ?? args.command ?? args.input ?? "";
      const cmd = Array.isArray(rawCmd) ? rawCmd.join(" ") : String(rawCmd);
      if (!cmd) return;
      extractPreviewManifestFiles(cmd, cwd).forEach((p) => writtenFiles.add(p));
      const patched = extractPatchFiles(cmd, cwd);
      patched.forEach((p) => writtenFiles.add(p));
      const paths = extractPaths(cmd, cwd).filter((p) => !patched.includes(p));
      if (hasWriteIndicator(cmd)) {
        paths.forEach((p) => writtenFiles.add(p));
      } else {
        paths.forEach((p) => readFiles.add(p));
      }
    } else if (WRITE_TOOLS.has(tool)) {
      const p = fileArgument(args);
      if (p) writtenFiles.add(resolvePath(cwd, p));
      for (const val of [args.input, args.patch]) {
        if (typeof val === "string") extractPatchFiles(val, cwd).forEach((f) => writtenFiles.add(f));
      }
    } else if (READ_ONLY_TOOLS.has(tool)) {
      const p = fileArgument(args);
      if (p) readFiles.add(resolvePath(cwd, p));
    } else if (SEARCH_TOOLS.has(tool)) {
      const p = fileArgument(args);
      if (p && /\.[\w]{1,12}$/.test(p)) readFiles.add(resolvePath(cwd, p));
    } else {
      // Unknown tool — extract any file-like paths from all string argument values
      for (const val of Object.values(args)) {
        if (typeof val === "string") {
          extractPaths(val, cwd).forEach((p) => readFiles.add(p));
        }
      }
    }
  };

  const parseArgs = (raw: unknown): ToolArgs => {
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : { input: raw };
      } catch {
        return { input: raw };
      }
    }
    return raw && typeof raw === "object" ? (raw as ToolArgs) : {};
  };

  for (const event of events) {
    if (!event || typeof event !== "object") continue;

    // ── Claude Code session logs ────────────────────────────────────────────
    if ((event.type === "assistant" || event.type === "user") && Array.isArray(event.message?.content)) {
      const cwd = typeof event.cwd === "string" && event.cwd ? event.cwd : currentCwd;
      currentCwd = cwd;
      for (const block of event.message.content) {
        if (block?.type === "tool_use") {
          if (block.id) callCwds.set(block.id, cwd);
          recordToolCall(String(block.name ?? ""), parseArgs(block.input), cwd);
        } else if (block?.type === "tool_result") {
          const outputCwd = callCwds.get(block.tool_use_id) || cwd;
          const output = typeof block.content === "string"
            ? block.content
            : Array.isArray(block.content)
              ? block.content.map((part: { text?: unknown }) => (typeof part?.text === "string" ? part.text : "")).join("\n")
              : "";
          extractPreviewManifestFiles(output, outputCwd).forEach((p) => writtenFiles.add(p));
        } else if (block?.type === "text" && event.type === "assistant" && typeof block.text === "string") {
          // A manifest returned as the agent's final answer.
          extractPreviewManifestFiles(block.text, cwd).forEach((p) => writtenFiles.add(p));
        }
      }
      continue;
    }

    // ── Codex CLI rollouts ──────────────────────────────────────────────────
    if (event.type === "turn_context" && event.payload?.cwd) {
      currentCwd = event.payload.cwd;
    }

    if (event.type !== "response_item" || !event.payload) continue;
    const { payload } = event;

    if (payload.type === "function_call_output" || payload.type === "custom_tool_call_output") {
      const output = typeof payload.output === "string" ? payload.output : "";
      const cwd = callCwds.get(payload.call_id) || currentCwd;
      extractPreviewManifestFiles(output, cwd).forEach((p) => writtenFiles.add(p));
      continue;
    }

    if (payload.type !== "function_call" && payload.type !== "custom_tool_call" && payload.type !== "local_shell_call") {
      continue;
    }

    const args = payload.type === "local_shell_call"
      ? { command: payload.action?.command ?? "", workdir: payload.action?.working_directory }
      : parseArgs(payload.arguments ?? payload.input);
    const tool: string = payload.type === "local_shell_call" ? "local_shell" : payload.name || "";
    const effectiveCwd = typeof args.workdir === "string" && args.workdir
      ? args.workdir
      : currentCwd;
    if (payload.call_id) callCwds.set(payload.call_id, effectiveCwd);
    recordToolCall(tool, args, effectiveCwd);
  }

  // Written files belong only in readAndChanged, not also in readOnly
  writtenFiles.forEach((p) => readFiles.delete(p));

  const byBasename = (a: ToolCallFileEntry, b: ToolCallFileEntry) =>
    a.basename.localeCompare(b.basename);

  return {
    readAndChanged: [...writtenFiles]
      .map((path) => ({ path, basename: getBasename(path), classification: "read_and_changed" as FileClassification }))
      .sort(byBasename),
    readOnly: [...readFiles]
      .map((path) => ({ path, basename: getBasename(path), classification: "read_only" as FileClassification }))
      .sort(byBasename),
    totalLines,
    parseErrors,
  };
}
