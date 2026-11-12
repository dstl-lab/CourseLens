import { useMemo } from "react";
import type { ReviewStatus } from "../../types/changes";
import type { ToolCallAnalysisResult } from "../../utils/toolCallParser";
import type { FileEntry, TCStatus } from "./constants";
import { resolveFileContent } from "./constants";
import { groupByWeek } from "../../utils/timelineWeeks";
import FileSection from "./FileSection";

interface Props {
  visibleEntries: FileEntry[];
  /** Length of the term from courselens.json, if set. */
  termWeeks?: number | null;
  matchCourseFile: (llmFile: string) => string | null;
  fileContents: Record<string, string>;
  blobUrls: Record<string, string>;
  viewerFilename: string | null;
  onToggleView: (matched: string) => void;
  lookupToolCallStatus: (filename: string) => TCStatus | null;
  toolCallResult: ToolCallAnalysisResult | null;
  reviewStatusMap: Record<string, ReviewStatus>;
  onReviewStatusChange: (changeId: string, status: ReviewStatus) => void;
  focusedChangeId: string | null;
  taggedFiles: Set<string>;
  onToggleFileTag: (filename: string) => void;
  focusedFilename: string | null;
}

export default function TimelineView({
  visibleEntries,
  termWeeks,
  matchCourseFile,
  fileContents,
  blobUrls,
  viewerFilename,
  onToggleView,
  lookupToolCallStatus,
  toolCallResult,
  reviewStatusMap,
  onReviewStatusChange,
  focusedChangeId,
  taggedFiles,
  onToggleFileTag,
  focusedFilename,
}: Props) {
  const { weeks, unscheduled } = useMemo(
    () => groupByWeek(visibleEntries, termWeeks),
    [visibleEntries, termWeeks],
  );
  const columns = [
    ...weeks.map(({ week, files }) => ({ key: `week-${week}`, label: `Week ${week}`, files, isUnscheduled: false })),
    ...(unscheduled.length > 0
      ? [{ key: "unscheduled", label: "Unscheduled", files: unscheduled, isUnscheduled: true }]
      : []),
  ];

  return (
    <div className="flex gap-6 min-w-max">
      {columns.map(({ key, label, files, isUnscheduled }) => {
          return (
            <div key={key} className="flex flex-col w-80 flex-shrink-0">
              <div className="text-sm font-bold border-b border-th-border pb-2 mb-3 text-th-text sticky top-0 bg-th-bg z-10 pt-1">
                {label}
              </div>
              {isUnscheduled && (
                <p className="text-[11px] text-th-dim leading-relaxed mb-3">
                  Not in the course schedule. Add these to <code className="text-th-muted">courselens.json</code> to place them in a week.
                </p>
              )}
              <div className="flex flex-col gap-3">
                {files.map(({ filename, fileType, changes, previewPath, primaryPath }) => {
                  const matched = matchCourseFile(filename);
                  const actualFile = previewPath ?? primaryPath ?? matched ?? filename;
                  const fileContent = resolveFileContent(actualFile, fileContents);

                  return (
                    <FileSection
                      key={primaryPath ?? filename}
                      filename={filename}
                      fileType={fileType}
                      changes={changes}
                      fileContent={fileContent}
                      matchedFilename={null}
                      isViewing={viewerFilename === actualFile}
                      onToggleView={actualFile ? () => onToggleView(actualFile) : undefined}
                      blobUrl={actualFile ? blobUrls[actualFile] : null}
                      toolCallStatus={lookupToolCallStatus(filename) ?? (toolCallResult ? "not_considered" : null)}
                      reviewStatusMap={reviewStatusMap}
                      onReviewStatusChange={onReviewStatusChange}
                      focusedChangeId={focusedChangeId}
                      isTagged={taggedFiles.has(primaryPath ?? filename)}
                      onToggleTag={() => onToggleFileTag(primaryPath ?? filename)}
                      isFocusedFile={focusedFilename === filename || focusedFilename === primaryPath}
                    />
                  );
                })}
                {files.length === 0 && !isUnscheduled && (
                  <div className="px-3 py-4 border border-dashed border-th-border rounded flex items-center justify-center">
                    <span className="text-xs text-th-dim italic">No files this week</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}
