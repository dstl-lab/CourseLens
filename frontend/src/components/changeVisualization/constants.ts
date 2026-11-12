import type { CourseChange, ReviewStatus } from "../../types/changes";
import { getStableChangeId } from "../../utils/changeIdentity";

export type TCStatus = "read_and_changed" | "read_only" | "not_considered";

// What instructors see for each review decision, in dropdown order. The stored
// values are unchanged, so decisions saved in the browser keep their meaning.
export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  modified: "Needs review",
  approved: "Approved",
  removed: "Removed",
};

export const REVIEW_STATUS_OPTIONS = Object.entries(REVIEW_STATUS_LABEL) as [ReviewStatus, string][];

export interface FileEntry {
  filename: string;
  primaryPath?: string;
  previewPath?: string;
  repo?: string | null;
  fileType: string;
  /** Week from the course schedule or the file's path; null = unscheduled. */
  week?: number | null;
  changes: CourseChange[];
}

export const CHANGE_TYPE_STYLE: Record<string, string> = {
  rename: "text-[#F59E0B] bg-[#F59E0B]/10",
  reword: "text-[#6366F1] bg-[#6366F1]/10",
  restructure: "text-[#EC4899] bg-[#EC4899]/10",
  add: "text-[#22C55E] bg-[#22C55E]/10",
  remove: "text-[#EF4444] bg-[#EF4444]/10",
  clarify: "text-[#06B6D4] bg-[#06B6D4]/10",
};

export const FILE_TYPE_STYLE: Record<string, string> = {
  lecture: "text-[#6366F1] bg-[#6366F1]/10",
  homework: "text-[#F59E0B] bg-[#F59E0B]/10",
  lab: "text-[#22C55E] bg-[#22C55E]/10",
  quiz: "text-[#EC4899] bg-[#EC4899]/10",
  project: "text-[#06B6D4] bg-[#06B6D4]/10",
  exam: "text-[#EF4444] bg-[#EF4444]/10",
  discussion: "text-[#A855F7] bg-[#A855F7]/10",
  schedule: "text-[#94A3B8] bg-[#94A3B8]/10",
  other: "text-[#94A3B8] bg-[#94A3B8]/10",
};

/** Style for a file type, including types a course defines itself. */
export function fileTypeStyle(fileType: string): string {
  return FILE_TYPE_STYLE[fileType] ?? FILE_TYPE_STYLE.other;
}

/** Order of file types within a week of the timeline. */
const FILE_TYPE_ORDER = [
  "lecture",
  "discussion",
  "lab",
  "homework",
  "quiz",
  "project",
  "exam",
  "schedule",
];

export function fileTypeRank(fileType: string): number {
  const idx = FILE_TYPE_ORDER.indexOf(fileType);
  return idx === -1 ? FILE_TYPE_ORDER.length : idx;
}

/** "lec2" sorts before "lec10". */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function fileStem(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").toLowerCase();
}

export function getChangeId(change: CourseChange): string {
  return getStableChangeId(change);
}

export function findSnippetContext(content: string, snippet: string, pad = 2) {
  const lines = content.split("\n");
  const lower = snippet.toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(lower)) {
      const start = Math.max(0, i - pad);
      const end = Math.min(lines.length - 1, i + pad);
      return {
        lineNumber: i + 1,
        lines: Array.from({ length: end - start + 1 }, (_, idx) => ({
          n: start + idx + 1,
          text: lines[start + idx],
          isMatch: start + idx === i,
        })),
      };
    }
  }
  return null;
}

export function resolveFileContent(
  actualFile: string,
  fileContents: Record<string, string>,
): string | null {
  return fileContents[actualFile] ?? null;
}
