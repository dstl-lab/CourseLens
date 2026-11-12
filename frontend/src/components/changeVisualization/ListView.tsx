import type { ReviewStatus } from "../../types/changes";
import type { ToolCallAnalysisResult } from "../../utils/toolCallParser";
import type { FileEntry, TCStatus } from "./constants";
import { resolveFileContent } from "./constants";
import FileSection from "./FileSection";

interface Props {
  visibleEntries: FileEntry[];
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

export default function ListView({
  visibleEntries,
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
  return (
    <div className="space-y-3">
      {visibleEntries.map(({ filename, fileType, changes, previewPath, primaryPath }) => {
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
    </div>
  );
}
