import type { CourseChange } from "../types/changes";
import type { CourseArtifact } from "./courseArtifacts";
import { findArtifactForChange } from "./courseArtifacts";

function normalizeText(value?: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}

function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function canonicalFileKey(change: CourseChange, artifacts: CourseArtifact[]): string {
  const artifact = findArtifactForChange(change, artifacts);
  return artifact?.id ?? change.filePath ?? change.file;
}

function actionKey(change: CourseChange): string {
  return change.action ?? change.changeType;
}

function targetKey(change: CourseChange): string {
  return normalizeText(change.target?.text ?? change.originalSnippet);
}

function proposedKey(change: CourseChange): string {
  return normalizeText(change.newText ?? change.proposedSnippet);
}

function summaryKey(change: CourseChange): string {
  return normalizeText(change.summary);
}

function stableKey(change: CourseChange, artifacts: CourseArtifact[]): string {
  const target = targetKey(change);
  const proposed = proposedKey(change);
  return [
    canonicalFileKey(change, artifacts),
    actionKey(change),
    target || summaryKey(change),
    proposed,
  ].join("|");
}

export function getStableChangeId(
  change: CourseChange,
  artifacts: CourseArtifact[] = [],
): string {
  if (change.id) return change.id;
  return hashString(stableKey(change, artifacts));
}

function richnessScore(change: CourseChange): number {
  let score = 0;
  if (change.target?.text) score += 1000;
  if (change.target?.before) score += 100;
  if (change.target?.after) score += 100;
  if (change.originalSnippet) score += 200;
  if (change.proposedSnippet || change.newText) score += 200;
  if (change.filePath) score += 50;
  score += Math.min(change.summary.length, 200);
  return score;
}

function changesAreEquivalent(
  a: CourseChange,
  b: CourseChange,
  artifacts: CourseArtifact[],
): boolean {
  if (canonicalFileKey(a, artifacts) !== canonicalFileKey(b, artifacts)) return false;
  if (actionKey(a) !== actionKey(b)) return false;

  const aTarget = targetKey(a);
  const bTarget = targetKey(b);
  if (aTarget && bTarget && aTarget !== bTarget) return false;

  const aProposed = proposedKey(a);
  const bProposed = proposedKey(b);
  if (aProposed && bProposed && aProposed !== bProposed) return false;

  if (aTarget || bTarget) return true;
  return summaryKey(a) === summaryKey(b);
}

export function dedupeChangesForArtifacts(
  changes: CourseChange[],
  artifacts: CourseArtifact[],
): CourseChange[] {
  const deduped: CourseChange[] = [];

  for (const change of changes) {
    const existingIndex = deduped.findIndex((existing) =>
      changesAreEquivalent(existing, change, artifacts),
    );
    if (existingIndex === -1) {
      deduped.push(change);
      continue;
    }
    if (richnessScore(change) > richnessScore(deduped[existingIndex])) {
      deduped[existingIndex] = change;
    }
  }

  return deduped;
}
