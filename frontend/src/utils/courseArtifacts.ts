import type { CourseChange } from "../types/changes";
import type { RepoFile } from "../store/courseStore";

export interface CourseArtifactVariant {
  filename: string;
  path: string;
  extension: string;
  fileType: string;
  previewPath?: string | null;
  repo?: string | null;
  content?: string | null;
  preferRank?: number;
  week?: number | null;
}

export interface CourseArtifact {
  id: string;
  displayName: string;
  fileType: string;
  primaryPath: string;
  previewPath: string;
  repo?: string | null;
  /** Week from the course schedule (or the path); null when unscheduled. */
  week?: number | null;
  variants: CourseArtifactVariant[];
}

function pathWithoutExtension(path: string): string {
  return path.replace(/\.[^.]+$/, "");
}

function extension(path: string): string {
  const idx = path.lastIndexOf(".");
  return idx === -1 ? "" : path.slice(idx).toLowerCase();
}

function basename(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

function stem(path: string): string {
  return basename(path).replace(/\.[^.]+$/, "");
}

function pathParts(path: string): string[] {
  return path.split(/[/\\]/).filter(Boolean);
}

/** Matches the backend: `Lec 01.ipynb`, `lec_1` and `LEC-01` all become `lec1`. */
export function normalizeItemKey(value: string): string {
  return stem(value)
    .toLowerCase()
    .replace(/[\s_-]+/g, "")
    .replace(/(?<![0-9])0+(?=[0-9])/g, "");
}

function readableArtifactName(value: string): string {
  return stem(value);
}

// Fallback grouping for files that arrive without a backend artifactId
// (e.g. older backends or tests): `homeworks/hw1/...` -> `homeworks/hw1`.
const KEYED_FOLDERS = [
  "homeworks",
  "assignments",
  "labs",
  "projects",
  "lectures",
  "slides",
  "discussions",
  "discussion",
  "quizzes",
  "exams",
];

function collectionKey(folder: string): string {
  return folder === "discussion" ? "discussions" : folder;
}

function artifactIdFromPath(
  path: string,
  formatName: (value: string) => string,
): string | null {
  const parts = pathParts(path);
  const lowerParts = parts.map((part) => part.toLowerCase());

  for (const folder of KEYED_FOLDERS) {
    const idx = lowerParts.indexOf(folder);
    if (idx !== -1 && parts[idx + 1]) {
      return `${collectionKey(folder)}/${formatName(parts[idx + 1])}`;
    }
  }

  return null;
}

function conceptualArtifactKey(file: RepoFile, path: string): string {
  if (file.artifactId) return file.artifactId;
  const artifactId = artifactIdFromPath(path, normalizeItemKey);
  if (artifactId) return artifactId;
  return pathWithoutExtension(path);
}

function readableArtifactId(primary: CourseArtifactVariant): string {
  return artifactIdFromPath(primary.path, readableArtifactName) ?? pathWithoutExtension(primary.path);
}

function itemKeyOf(groupKey: string): string {
  return normalizeItemKey(groupKey.split("/").pop() ?? groupKey);
}

function variantPriority(ext: string): number {
  if (ext === ".ipynb") return 0;
  if (ext === ".html" || ext === ".htm") return 1;
  if (ext === ".md" || ext === ".qmd" || ext === ".rmd") return 2;
  if (ext === ".tex") return 3;
  if (ext === ".pdf") return 4;
  return 5;
}

function previewPriority(ext: string): number {
  if (ext === ".html" || ext === ".htm") return 0;
  if (ext === ".ipynb") return 1;
  if (ext === ".md" || ext === ".qmd" || ext === ".rmd") return 2;
  if (ext === ".pdf") return 3;
  return 4;
}

const GENERATED_SEGMENTS = new Set(["build", "_build", "rebuild", "dist", "_site", "generated"]);

/**
 * Lower is preferred. The backend computes this from the course's `prefer`
 * setting; without it, hand-written sources beat build output.
 */
function sourcePriority(variant: CourseArtifactVariant): number {
  if (variant.preferRank !== undefined) return variant.preferRank;
  const generated = pathParts(variant.path).some((part) =>
    GENERATED_SEGMENTS.has(part.toLowerCase()),
  );
  return generated ? 1 : 0;
}

export function buildCourseArtifacts(files: RepoFile[]): CourseArtifact[] {
  const grouped = new Map<string, CourseArtifactVariant[]>();
  const explicitPreviewByPrimary = new Map<string, string>();
  const backendKeys = new Set<string>();

  for (const file of files) {
    const path = file.path ?? file.filename;
    const id = conceptualArtifactKey(file, path);
    if (file.artifactId) backendKeys.add(id);
    const variant: CourseArtifactVariant = {
      filename: file.filename,
      path,
      extension: extension(path),
      fileType: file.fileType,
      previewPath: file.previewPath,
      repo: file.repo,
      content: file.content,
      preferRank: file.preferRank,
      week: file.week,
    };
    const variants = grouped.get(id) ?? [];
    variants.push(variant);
    grouped.set(id, variants);
    if (file.previewPath) explicitPreviewByPrimary.set(path, file.previewPath);
  }

  return [...grouped.entries()]
    .map(([groupKey, variants]) => {
      const itemKey = itemKeyOf(groupKey);
      // A copy named after the item (lab1.ipynb for lab1) beats helper files
      // in the same folder (data_prep/world_population.ipynb).
      const nameRank = (variant: CourseArtifactVariant) =>
        normalizeItemKey(variant.filename) === itemKey ? 0 : 1;
      const depth = (variant: CourseArtifactVariant) => pathParts(variant.path).length;

      const sortedVariants = [...variants].sort((a, b) => {
        const bySource = sourcePriority(a) - sourcePriority(b);
        if (bySource) return bySource;
        const byName = nameRank(a) - nameRank(b);
        if (byName) return byName;
        const byPriority = variantPriority(a.extension) - variantPriority(b.extension);
        if (byPriority) return byPriority;
        return depth(a) - depth(b) || a.path.localeCompare(b.path);
      });
      const primary = sortedVariants[0];
      const explicitPreview = explicitPreviewByPrimary.get(primary.path);
      const preview =
        explicitPreview ??
        [...sortedVariants].sort((a, b) => {
          const byPriority = previewPriority(a.extension) - previewPriority(b.extension);
          if (byPriority) return byPriority;
          const bySource = sourcePriority(a) - sourcePriority(b);
          if (bySource) return bySource;
          const byName = nameRank(a) - nameRank(b);
          if (byName) return byName;
          return a.path.localeCompare(b.path);
        })[0].path;

      const weeks = sortedVariants
        .map((v) => v.week)
        .filter((w): w is number => typeof w === "number");

      return {
        id: backendKeys.has(groupKey) ? groupKey : readableArtifactId(primary),
        displayName: stem(primary.path),
        fileType: primary.fileType,
        primaryPath: primary.path,
        previewPath: preview,
        repo: primary.repo,
        week: primary.week ?? (weeks.length ? Math.min(...weeks) : null),
        variants: sortedVariants,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function findArtifactForChange(
  change: CourseChange,
  artifacts: CourseArtifact[],
): CourseArtifact | null {
  const refs = [change.filePath, change.file].filter((v): v is string => Boolean(v));
  for (const ref of refs) {
    const normalized = normalizedPath(ref);
    const exact = artifacts.find((artifact) =>
      artifact.variants.some((variant) => {
        const variantPath = normalizedPath(variant.path);
        // Agents often report paths relative to one repo inside the course
        // folder (lectures/lec01/lec01.ipynb for course-public/lectures/...).
        return variantPath === normalized || variantPath.endsWith(`/${normalized}`);
      }),
    );
    if (exact) return exact;
  }

  const changeStem = stem(change.file).toLowerCase();
  return (
    artifacts.find((artifact) =>
      artifact.displayName.toLowerCase() === changeStem ||
      artifact.variants.some((variant) => stem(variant.filename).toLowerCase() === changeStem),
    ) ?? null
  );
}

function normalizedPath(value: string): string {
  return value.toLowerCase().replace(/\\/g, "/").replace(/^\.?\//, "");
}

function htmlSiblingForVariant(
  variant: CourseArtifactVariant,
  artifact: CourseArtifact,
): string | null {
  if (variant.extension === ".html" || variant.extension === ".htm") {
    return variant.path;
  }
  if (variant.previewPath) return variant.previewPath;

  const variantStem = normalizedPath(pathWithoutExtension(variant.path));
  const sibling = artifact.variants.find((candidate) => {
    if (candidate.extension !== ".html" && candidate.extension !== ".htm") return false;
    return normalizedPath(pathWithoutExtension(candidate.path)) === variantStem;
  });
  return sibling?.path ?? null;
}

/**
 * Which file the preview pane should open for a set of changes. By default
 * it follows the copy a change targets; item types listed in the course's
 * `stable_preview_types` always use the item's preferred preview instead.
 */
export function previewPathForChanges(
  artifact: CourseArtifact,
  changes: CourseChange[],
  stablePreviewTypes: string[] = [],
): string {
  if (stablePreviewTypes.includes(artifact.fileType)) {
    return artifact.previewPath;
  }

  for (const change of changes) {
    const refs = [change.filePath, change.file].filter((v): v is string => Boolean(v));
    for (const ref of refs) {
      const normalizedRef = normalizedPath(ref);
      const exactVariant = artifact.variants.find(
        (variant) => normalizedPath(variant.path) === normalizedRef,
      );
      if (!exactVariant) continue;
      const preview = htmlSiblingForVariant(exactVariant, artifact);
      if (preview) return preview;
    }
  }

  return artifact.previewPath;
}
