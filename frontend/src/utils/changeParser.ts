import type { CourseChange, CourseChangeset, FileType, ChangeType, Priority, PreviewAction, ChangeTarget } from "../types/changes";

/**
 * Generate a deterministic ID for a change based on its properties.
 * Uses a simple string hash to create a consistent identifier.
 */
function generateChangeId(
  file: string,
  changeType: ChangeType,
  summary: string,
  lineNumber: number | null,
  sectionLabel: string | null
): string {
  const input = `${file}|${changeType}|${summary}|${lineNumber ?? ""}|${sectionLabel ?? ""}`;
  // Simple hash function (djb2 algorithm)
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  // Convert to positive hex string
  return (hash >>> 0).toString(16);
}

// Mirrors the backend's default types (backend/app/services/course_config.py).
// Only used for files that are not in the synced course folder; course files
// get their type from the backend, which also applies courselens.json.
const TYPE_PATTERNS: Array<[FileType, RegExp]> = [
  ["project", /^(projects?|projects?[-_\d].*|proj[-_\d].*|.*[-_]project.*)$/],
  ["exam", /^(exams?|exam[-_\d].*|midterms?|midterm\d.*|finals?|final[-_]exam.*)$/],
  ["homework", /^(homeworks?|homework[-_\d].*|hw.*|assignments?|assignment[-_\d].*|psets?.*|problem[-_]sets)$/],
  ["lab", /^(labs?|lab[-_\d].*)$/],
  ["quiz", /^(quizzes|quiz.*)$/],
  ["discussion", /^(discussions?.*|disc[-_\d].*|sections|recitations?.*|worksheets?.*)$/],
  ["lecture", /^(lectures?.*|lec.*|slides|notes)$/],
  ["schedule", /^(schedule.*|syllabus.*|calendar.*)$/],
];

function inferFileType(filePath: string): FileType {
  const segments = filePath.toLowerCase().split(/[/\\]/).filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    const candidates = i === segments.length - 1
      ? [segments[i], segments[i].replace(/\.[^.]+$/, "")]
      : [segments[i]];
    for (const [type, pattern] of TYPE_PATTERNS) {
      if (candidates.some((candidate) => pattern.test(candidate))) return type;
    }
  }
  return "other";
}

function extractLectureNumber(filename: string): number | null {
  const match = filename.match(/lec(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

function extractWeek(text: string): number | null {
  const match = text.match(/week\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

function inferChangeType(text: string): ChangeType {
  const lower = text.toLowerCase();
  if (/renam/.test(lower)) return "rename";
  if (/rewor/.test(lower)) return "reword";
  if (/restructur|reorganiz/.test(lower)) return "restructure";
  if (/\badd(ed|ing)?\b|\binsert|\bnew\b/.test(lower)) return "add";
  if (/remov|delet|drop/.test(lower)) return "remove";
  if (/clarif|simplif|explain|updat/.test(lower)) return "clarify";
  return "reword";
}

function inferPriority(text: string): Priority {
  const lower = text.toLowerCase();
  if (/secondary|optional|minor|downstream|derived/.test(lower)) return "secondary";
  if (/primary|high[- ]value|core|critical|important|major/.test(lower)) return "primary";
  return "primary";
}

function extractFromTo(text: string): { original: string | null; proposed: string | null } {
  // "from X to Y" with any quote style
  const q = `["'\`]`;
  const ftt = new RegExp(`from\\s+${q}([^"'\`]+)${q}\\s+to\\s+${q}([^"'\`]+)${q}`, "i");
  const m1 = text.match(ftt);
  if (m1) return { original: m1[1], proposed: m1[2] };

  // "X" → "Y" or "X" -> "Y"
  const arr = new RegExp(`${q}([^"'\`]+)${q}\\s*(?:→|->|⟶)\\s*${q}([^"'\`]+)${q}`);
  const m2 = text.match(arr);
  if (m2) return { original: m2[1], proposed: m2[2] };

  // change "X" to "Y"
  const chg = new RegExp(`change\\s+${q}([^"'\`]+)${q}\\s+to\\s+${q}([^"'\`]+)${q}`, "i");
  const m3 = text.match(chg);
  if (m3) return { original: m3[1], proposed: m3[2] };

  // rename X to Y (unquoted)
  const m4 = text.match(/renam\w*\s+(.+?)\s+to\s+(.+?)(?:\s*[.,\n]|$)/i);
  if (m4) return { original: m4[1].trim(), proposed: m4[2].trim() };

  return { original: null, proposed: null };
}

function extractLineNumber(text: string): number | null {
  // filename.ext:25 or line 25 or (line 25)
  const m1 = text.match(/\.\w+:(\d+)/);
  if (m1) return parseInt(m1[1], 10);
  const m2 = text.match(/\bline\s*:?\s*(\d+)/i);
  if (m2) return parseInt(m2[1], 10);
  return null;
}

const SECTION_LABELS = [
  "title", "introduction", "intro", "agenda", "overview", "summary",
  "conclusion", "header", "subtitle", "objectives", "learning goals", "outline",
  "motivation", "background", "setup",
];

function extractSectionLabel(text: string): string | null {
  const lower = text.toLowerCase();
  for (const s of SECTION_LABELS) {
    if (lower.includes(s)) return s.charAt(0).toUpperCase() + s.slice(1);
  }
  // parenthesized label: (Title)
  const m = text.match(/\(([A-Za-z][A-Za-z ]{2,30})\)/);
  if (m) return m[1].trim();
  return null;
}

function extractFilename(text: string): string | null {
  const m = text.match(/\b([\w][\w-]*\.(?:ipynb|py|md|tex|csv|pdf|txt|html|js|ts|json|r|Rmd))\b/i);
  return m ? m[1] : null;
}

function buildSummary(text: string): string {
  const clean = text.replace(/^[-*•#\s]+/gm, "").replace(/\n+/g, " ").trim();
  const end = clean.search(/[.!?]/);
  if (end > 20 && end < 200) return clean.substring(0, end + 1);
  return clean.length > 150 ? clean.substring(0, 150) + "…" : clean;
}

const PREVIEW_ACTIONS = new Set<PreviewAction>([
  "replace",
  "insert_after",
  "insert_before",
  "delete",
  "highlight",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getBasename(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

function actionToChangeType(action: PreviewAction): ChangeType {
  if (action === "delete") return "remove";
  if (action === "insert_after" || action === "insert_before") return "add";
  if (action === "highlight") return "clarify";
  return "reword";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

// The current name is courselens-preview-changes/v1. The same v1 format was
// generated under an earlier name by older prompts, so any
// "<name>-preview-changes/v1" is accepted.
const PREVIEW_MANIFEST_VERSION = /^[a-z][a-z0-9]*-preview-changes\/v1$/;

export function isPreviewManifestVersion(version: unknown): boolean {
  return typeof version === "string" && PREVIEW_MANIFEST_VERSION.test(version);
}

// Agents sometimes wrap the manifest in a ```json fence or add a sentence
// around it despite the prompt, so also try the fenced block and the outermost
// {...}. Returns the first candidate that parses as a manifest-shaped object.
function findManifestObject(rawText: string): Record<string, unknown> | null {
  const text = rawText.trim();
  const candidates = [text];
  const fenced = text.match(/```[a-zA-Z]*\s*\n([\s\S]*?)\n\s*```/);
  if (fenced) candidates.push(fenced[1]);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) candidates.push(text.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (isRecord(parsed) && ("version" in parsed || Array.isArray(parsed.changes))) return parsed;
    } catch {
      // Not JSON; try the next candidate.
    }
  }
  return null;
}

function parsePreviewManifest(parsed: Record<string, unknown>): CourseChangeset | null {
  if (!isPreviewManifestVersion(parsed.version) || !Array.isArray(parsed.changes)) {
    return null;
  }

  const changes: CourseChange[] = [];
  for (const item of parsed.changes) {
    if (!isRecord(item)) continue;

    const filePath = typeof item.file === "string" ? item.file.trim() : "";
    const action = typeof item.action === "string" && PREVIEW_ACTIONS.has(item.action as PreviewAction)
      ? item.action as PreviewAction
      : null;
    const summary = typeof item.summary === "string" ? buildSummary(item.summary) : "";
    const rawTarget = isRecord(item.target) ? item.target : null;
    const targetText = rawTarget && typeof rawTarget.text === "string" ? rawTarget.text : "";

    if (!filePath || !action || !summary || !targetText) continue;

    const filename = getBasename(filePath);
    const target: ChangeTarget = {
      text: targetText,
      before: rawTarget ? nullableString(rawTarget.before) : null,
      after: rawTarget ? nullableString(rawTarget.after) : null,
    };
    const newText = nullableString(item.new_text);
    const changeType = actionToChangeType(action);
    const lineNumber = extractLineNumber(`${filePath} ${summary}`);
    const sectionLabel = extractSectionLabel(summary);

    changes.push({
      id: generateChangeId(filename, changeType, summary, lineNumber, sectionLabel),
      file: filename,
      filePath,
      fileType: inferFileType(filePath),
      week: extractWeek(`${filePath} ${summary}`),
      lectureNumber: extractLectureNumber(filename),
      changeType,
      action,
      priority: "primary",
      summary,
      location: {
        lineNumber,
        sectionLabel,
      },
      originalSnippet: targetText,
      proposedSnippet: newText,
      target,
      newText,
    });
  }

  const uniqueFiles = new Set(changes.map((c) => c.filePath ?? c.file));
  return {
    totalFilesTouched: uniqueFiles.size,
    changes,
  };
}

// --- NEW HYBRID PARSER STARTS HERE ---

/**
 * Extract file paths from table-based or plain-text LLM output.
 * Matches paths like:
 *   - lectures/lec06/lec06.ipynb
 *   - homeworks/hw02/src/hw02.ipynb
 *   - exams/final/drafts/foo.ipynb
 *   - labs/lab3/src/lab3.ipynb
 *   - projects/final_project/src/final_project.ipynb
 *
 * Works with markdown tables: | path/to/file.ext | instances | notes |
 * And plain text mentions of paths.
 */
function parseTableOrPlainPaths(rawText: string, globalWeek: number | null): CourseChange[] {
  const changes: CourseChange[] = [];
  const seenFiles = new Set<string>();

  // Relative file paths with at least one folder (lectures/lec06/lec06.ipynb,
  // assignments/a1/a1.ipynb, ...). URLs are skipped.
  const pathRegex = /(?<![:/\w.-])((?:[\w.-]+\/)+[\w.-]+\.(?:ipynb|py|md|tex|csv|pdf|txt|html|js|ts|json|r|Rmd|qmd))\b/gi;

  const lines = rawText.split('\n');

  for (const line of lines) {
    // Skip markdown link lines - those are handled by the primary parser
    if (/\[([^\]]+)\]\(([^)]+)\)/.test(line)) continue;

    const matches = line.matchAll(pathRegex);

    for (const match of matches) {
      const fullPath = match[1];
      const filename = fullPath.split('/').pop() || fullPath;

      // Deduplicate by full path to avoid duplicate entries
      if (seenFiles.has(fullPath)) continue;
      seenFiles.add(fullPath);

      // Use the full line as context for inference
      const fullContext = line;

      // Try to extract instance count from table format: | path | 11 | notes |
      const tableMatch = line.match(/\|\s*[^|]*\|\s*(\d+)\s*\|/);
      const instanceCount = tableMatch ? parseInt(tableMatch[1], 10) : null;

      // Extract any notes/description from the table (third column onwards)
      const tablePartsMatch = line.match(/\|[^|]+\|[^|]+\|\s*([^|]+)/);
      const tableNotes = tablePartsMatch ? tablePartsMatch[1].trim() : null;

      // Build summary from available context
      let summary: string;
      if (tableNotes && tableNotes.length > 0) {
        summary = instanceCount
          ? `${instanceCount} instance${instanceCount !== 1 ? 's' : ''} - ${tableNotes}`
          : tableNotes;
      } else if (instanceCount) {
        summary = `${instanceCount} instance${instanceCount !== 1 ? 's' : ''} to update`;
      } else {
        // Fallback: extract clean context by stripping table formatting and the path itself
        const cleanedLine = line
          .replace(/\|/g, ' ')           // Remove pipe characters
          .replace(fullPath, '')          // Remove the file path
          .replace(/\s+/g, ' ')           // Normalize whitespace
          .trim();

        // Use cleaned line if it has meaningful content, otherwise empty string
        // (the UI will show the filename when summary is empty)
        summary = cleanedLine.length > 2 ? buildSummary(cleanedLine) : '';
      }

      const changeType = inferChangeType(fullContext);
      const lineNumber = extractLineNumber(fullContext);
      const sectionLabel = extractSectionLabel(fullContext);
      const { original, proposed } = extractFromTo(fullContext);

      changes.push({
        id: generateChangeId(filename, changeType, summary, lineNumber, sectionLabel),
        file: filename,
        fileType: inferFileType(fullPath), // Use full path for better type inference
        week: extractWeek(fullContext) ?? globalWeek,
        lectureNumber: extractLectureNumber(filename),
        changeType,
        priority: inferPriority(fullContext),
        summary,
        location: {
          lineNumber,
          sectionLabel,
        },
        originalSnippet: original,
        proposedSnippet: proposed,
      });
    }
  }

  return changes;
}

export function parseLLMOutput(rawText: string): CourseChangeset {
  const manifestObject = findManifestObject(rawText);
  if (manifestObject) {
    // A JSON manifest with an unrecognized version yields no changes rather
    // than falling through to the line-based parser below, which would turn
    // each JSON line into a bogus change.
    return parsePreviewManifest(manifestObject) ?? { totalFilesTouched: 0, changes: [] };
  }

  const globalWeek = extractWeek(rawText);
  const changes: CourseChange[] = [];
  const lines = rawText.split('\n');

  // Our robust regex: Matches [Text](Path) optionally followed by : or - and a description
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)(?:\s*[:-]\s*)?(.*)/;

  for (const line of lines) {
    const match = line.match(markdownLinkRegex);

    if (match) {
      const displayTitle = match[1].trim();
      const rawPath = match[2].trim();
      const description = match[3] ? match[3].trim() : displayTitle;

      let cleanPath = rawPath;
      let urlLineNumber: number | null = null;

      // Extract line number from the URL if it exists (e.g. file.ipynb:25)
      const lineMatch = rawPath.match(/(.*):(\d+)$/);
      if (lineMatch) {
        cleanPath = lineMatch[1];
        urlLineNumber = parseInt(lineMatch[2], 10);
      }

      // Fix URL Encoded spaces (so %20 becomes a space for the CSV file)
      try {
        cleanPath = decodeURI(cleanPath);
      } catch {
        // Fallback if the string encoding is malformed
      }

      // Extract the real filename from the end of the path
      let filename = cleanPath.split('/').pop() || displayTitle;

      // If the filename lacks an extension, try the backup extractor
      if (!filename.includes('.')) {
        const fallback = extractFilename(line);
        if (fallback) filename = fallback;
      }

      // Feed the raw text back into the heuristic functions to preserve UI tags/colors
      const fullContext = `${displayTitle} ${description}`;
      const { original, proposed } = extractFromTo(fullContext);

      const changeType = inferChangeType(fullContext);
      const summary = buildSummary(description);
      const lineNumber = urlLineNumber || extractLineNumber(fullContext);
      const sectionLabel = extractSectionLabel(fullContext);

      changes.push({
        id: generateChangeId(filename, changeType, summary, lineNumber, sectionLabel),
        file: filename,
        fileType: inferFileType(filename),
        week: extractWeek(fullContext) ?? globalWeek,
        lectureNumber: extractLectureNumber(filename),
        changeType,
        priority: inferPriority(fullContext),
        summary,
        location: {
          lineNumber,
          sectionLabel,
        },
        originalSnippet: original,
        proposedSnippet: proposed,
      });
    }
  }

  // --- SECONDARY PARSER: Table/Plain path extraction ---
  // Always run to catch any table-based paths not covered by markdown links
  const tableParsedChanges = parseTableOrPlainPaths(rawText, globalWeek);

  // Merge results, avoiding duplicates by filename
  const seenFiles = new Set(changes.map((c) => c.file));
  for (const change of tableParsedChanges) {
    if (!seenFiles.has(change.file)) {
      changes.push(change);
      seenFiles.add(change.file);
    }
  }

  const uniqueFiles = new Set(changes.map((c) => c.file));

  return {
    totalFilesTouched: uniqueFiles.size,
    changes,
  };
}
