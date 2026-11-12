export interface ChangeLocation {
  lineNumber: number | null;
  sectionLabel: string | null;
}

/**
 * Kind of course item. The common kinds have their own colors; courses can
 * define more in courselens.json (e.g. "studio"), so any string is allowed.
 */
export type KnownFileType =
  | "lecture"
  | "homework"
  | "lab"
  | "quiz"
  | "project"
  | "exam"
  | "discussion"
  | "schedule"
  | "other";
export type FileType = KnownFileType | (string & {});
export type ChangeType = "rename" | "reword" | "restructure" | "add" | "remove" | "clarify";
export type Priority = "primary" | "secondary";
export type ReviewStatus = "approved" | "removed" | "modified";
export type PreviewAction = "replace" | "insert_after" | "insert_before" | "delete" | "highlight";

export interface ChangeTarget {
  text: string;
  before: string | null;
  after: string | null;
}

export interface CourseChange {
  id: string;
  file: string;
  filePath?: string;
  fileType: FileType;
  week: number | null;
  lectureNumber: number | null;
  changeType: ChangeType;
  action?: PreviewAction;
  priority: Priority;
  summary: string;
  location: ChangeLocation;
  originalSnippet: string | null;
  proposedSnippet: string | null;
  target?: ChangeTarget;
  newText?: string | null;
  reviewStatus?: ReviewStatus;
}

export interface CourseChangeset {
  totalFilesTouched: number;
  changes: CourseChange[];
}
