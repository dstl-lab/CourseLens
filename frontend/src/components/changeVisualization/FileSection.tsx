import { useState, useRef, useEffect } from "react";
import type { CourseChange, ReviewStatus } from "../../types/changes";
import { fileTypeStyle, getChangeId } from "./constants";
import type { TCStatus } from "./constants";
import ChangeCard from "./ChangeCard";

interface Props {
  filename: string;
  /** Kind of course item; defaults to the first change's type. */
  fileType?: string;
  changes: CourseChange[];
  fileContent: string | null;
  matchedFilename: string | null;
  isViewing?: boolean;
  onToggleView?: () => void;
  blobUrl: string | null;
  toolCallStatus?: TCStatus | null;
  reviewStatusMap: Record<string, ReviewStatus>;
  onReviewStatusChange: (changeId: string, status: ReviewStatus) => void;
  focusedChangeId?: string | null;
  isTagged?: boolean;
  onToggleTag?: () => void;
  isFocusedFile?: boolean;
}

export default function FileSection({
  filename,
  fileType: itemFileType,
  changes,
  fileContent,
  matchedFilename,
  isViewing,
  onToggleView,
  toolCallStatus,
  reviewStatusMap,
  onReviewStatusChange,
  focusedChangeId,
  isTagged,
  onToggleTag,
  isFocusedFile,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const fileType = itemFileType ?? changes[0]?.fileType ?? "other";
  const sectionRef = useRef<HTMLDivElement>(null);

  const isBaseline = changes.length === 0;

  useEffect(() => {
    if (focusedChangeId && changes.some(c => getChangeId(c) === focusedChangeId)) {
      setCollapsed(false);
    }
  }, [focusedChangeId, changes]);

  useEffect(() => {
    if (isFocusedFile && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isFocusedFile]);

  const hasProposedChanges = !isBaseline || toolCallStatus === "read_and_changed";
  // tcLoaded mirrors whether a JSONL was uploaded — same condition the sidebar buckets use
  const tcLoaded = toolCallStatus != null;

  const boxClass = isFocusedFile
    ? "border rounded-lg overflow-hidden transition-all duration-300 border-[#F59E0B] ring-2 ring-[#F59E0B]/50 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
    : tcLoaded && hasProposedChanges
      ? "border rounded-lg overflow-hidden transition-all duration-300 bg-th-panel border-[#22C55E]/60 shadow-[0_0_15px_rgba(34,197,94,0.15)]"
      : tcLoaded && toolCallStatus === "read_only"
        ? "border rounded-lg overflow-hidden transition-all duration-300 bg-th-panel border-[#F97316]/60 shadow-[0_0_15px_rgba(249,115,22,0.12)]"
        : tcLoaded
          ? "border rounded-lg overflow-hidden transition-all duration-300 border-th-border/50 bg-th-panel/20 opacity-60 hover:opacity-90"
          : hasProposedChanges
            ? "border rounded-lg overflow-hidden transition-all duration-300 bg-th-panel border-[#6366F1]/60 shadow-[0_0_15px_rgba(99,102,241,0.12)]"
            : "border rounded-lg overflow-hidden transition-all duration-300 border-th-border/50 bg-th-panel/20 opacity-70 hover:opacity-100";

  const accentClass = isFocusedFile
    ? ""
    : tcLoaded && hasProposedChanges
      ? "border-l-2 border-[#22C55E]"
      : tcLoaded && toolCallStatus === "read_only"
        ? "border-l-2 border-[#F97316]"
        : "";

  return (
    <div ref={sectionRef} className={boxClass}>
      <div className={`flex items-center gap-2 px-3 py-2.5 ${accentClass}`}>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity text-left overflow-hidden"
        >
          <span className="text-[10px] flex-shrink-0 text-th-dim">
            {collapsed ? "▶" : "▼"}
          </span>
          <span className={`text-sm truncate flex-1 ${isBaseline ? "text-th-muted" : "font-medium text-th-text"}`}>
            {filename}
          </span>
          {matchedFilename && matchedFilename !== filename && (
            <span
              className="text-[10px] text-th-dim flex-shrink-0 truncate max-w-[80px]"
              title={matchedFilename}
            >
              → {matchedFilename}
            </span>
          )}
          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded flex-shrink-0 ${fileTypeStyle(fileType)}`}>
            {fileType}
          </span>
          {!isBaseline && (
            <span className="text-[10px] text-[#818CF8] font-bold flex-shrink-0 bg-[#6366F1]/10 px-1.5 py-0.5 rounded">
              {changes.length} updates
            </span>
          )}
        </button>
        {onToggleView && (
          <button
            onClick={onToggleView}
            className={`flex-shrink-0 px-2 py-1 text-[10px] font-medium rounded transition-colors ${
              isViewing ? "bg-[#6366F1] text-white" : "text-th-muted bg-th-elevated hover:bg-th-raised hover:text-th-text"
            }`}
          >
            View
          </button>
        )}
        {onToggleTag && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleTag(); }}
            className={`flex-shrink-0 px-2 py-1 text-[10px] font-medium rounded transition-colors ${
              isTagged
                ? "bg-[#F59E0B] text-white"
                : "text-th-muted bg-th-elevated hover:bg-th-raised hover:text-th-text"
            }`}
            title={isTagged ? "Remove from needs review" : "Mark as needing follow-up review"}
          >
            {isTagged ? "⚑ Tagged" : "⚐ Tag"}
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="px-3 pt-2 pb-3 space-y-2 bg-th-bg">
          {isBaseline && (
            <div className="text-xs text-th-dim px-1 py-1">No proposed changes for this file.</div>
          )}

          {changes.map((c) => {
            const changeId = getChangeId(c);
            return (
              <ChangeCard
                key={changeId}
                changeId={changeId}
                change={c}
                fileContent={fileContent}
                reviewStatus={reviewStatusMap[changeId] || null}
                onReviewStatusChange={(status) => onReviewStatusChange(changeId, status)}
                isFocused={focusedChangeId === changeId}
              />
            );
          })}

        </div>
      )}
    </div>
  );
}
