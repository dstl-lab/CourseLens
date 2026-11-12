import type { FileEntry } from "../components/changeVisualization/constants";
import { fileTypeRank, naturalCompare } from "../components/changeVisualization/constants";

const WEEK_IN_PATH = /(?:^|[^a-z])(?:week|wk)[-_ ]?0*(\d{1,2})(?![0-9])/i;

/**
 * Week for a file. Course files get theirs from the backend (courselens.json
 * schedule, or a week named in the path). Files known only from an agent's
 * suggestions fall back to a week named in their path. Nothing is guessed:
 * anything else is unscheduled.
 */
export function timelineWeek(entry: Pick<FileEntry, "week" | "filename" | "primaryPath">): number | null {
  if (typeof entry.week === "number" && entry.week >= 1) return entry.week;
  for (const candidate of [entry.primaryPath, entry.filename]) {
    if (!candidate) continue;
    for (const segment of candidate.split(/[/\\]/).reverse()) {
      const match = segment.match(WEEK_IN_PATH);
      if (match) return parseInt(match[1], 10);
    }
  }
  return null;
}

/** Group entries into week columns (1..termWeeks, plus any later weeks used). */
export function groupByWeek(
  entries: FileEntry[],
  termWeeks: number | null | undefined,
): { weeks: Array<{ week: number; files: FileEntry[] }>; unscheduled: FileEntry[] } {
  const byWeek = new Map<number, FileEntry[]>();
  const unscheduled: FileEntry[] = [];
  for (const entry of entries) {
    const week = timelineWeek(entry);
    if (week === null) {
      unscheduled.push(entry);
    } else {
      byWeek.set(week, [...(byWeek.get(week) ?? []), entry]);
    }
  }

  const lastWeek = Math.max(termWeeks ?? 0, ...byWeek.keys(), 0);
  const order = (a: FileEntry, b: FileEntry) =>
    fileTypeRank(a.fileType) - fileTypeRank(b.fileType) || naturalCompare(a.filename, b.filename);

  const weeks = [];
  for (let week = 1; week <= lastWeek; week++) {
    weeks.push({ week, files: [...(byWeek.get(week) ?? [])].sort(order) });
  }
  return { weeks, unscheduled: [...unscheduled].sort(order) };
}
