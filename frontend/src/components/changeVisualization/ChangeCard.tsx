import { useState, useRef, useEffect } from "react";
import type { CourseChange, ReviewStatus } from "../../types/changes";
import { CHANGE_TYPE_STYLE, REVIEW_STATUS_LABEL, REVIEW_STATUS_OPTIONS, findSnippetContext } from "./constants";

interface Props {
  change: CourseChange;
  fileContent: string | null;
  reviewStatus: ReviewStatus | null;
  onReviewStatusChange: (status: ReviewStatus) => void;
  isFocused?: boolean;
  changeId: string;
}

export default function ChangeCard({
  change,
  fileContent,
  reviewStatus,
  onReviewStatusChange,
  isFocused,
  changeId,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isFocused && cardRef.current) {
      setExpanded(true);
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [isFocused]);

  const ctx = change.originalSnippet && fileContent ? findSnippetContext(fileContent, change.originalSnippet) : null;
  const hasDiff = change.originalSnippet || change.proposedSnippet;
  const typeStyle = CHANGE_TYPE_STYLE[change.changeType] ?? "text-th-muted bg-th-raised/40";

  return (
    <div
      ref={cardRef}
      data-change-id={changeId}
      className={`border rounded-lg overflow-hidden transition-all duration-300 ${
        isFocused
          ? "border-[#6366F1] ring-2 ring-[#6366F1]/50 shadow-[0_0_20px_rgba(99,102,241,0.3)]"
          : "border-th-border"
      }`}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-th-elevated/40 transition-colors text-left"
      >
        <span className="text-th-dim text-[10px] flex-shrink-0">{expanded ? "▼" : "▶"}</span>
        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded flex-shrink-0 ${typeStyle}`}>
          {change.changeType}
        </span>
        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded flex-shrink-0 ${
          change.priority === "primary" ? "text-[#F97316] bg-[#F97316]/10" : "text-th-faint bg-th-raised/40"
        }`}>
          {change.priority}
        </span>
        {change.location.sectionLabel && (
          <span className="text-[10px] text-th-faint flex-shrink-0">§ {change.location.sectionLabel}</span>
        )}
        {change.location.lineNumber && (
          <span className="text-[10px] text-th-dim flex-shrink-0">:{change.location.lineNumber}</span>
        )}
        <span className="text-[11px] text-th-dim truncate flex-1 text-right">{change.summary}</span>
      </button>

      {expanded && (
        <div className="px-4 pt-3 pb-4 space-y-2.5 border-t border-th-border">
          <p className="text-xs text-th-muted leading-relaxed">{change.summary}</p>
          {hasDiff && (
            <div className="font-mono text-xs rounded overflow-hidden border border-th-border">
              {change.originalSnippet && (
                <div className="bg-[#EF4444]/8 border-l-2 border-[#EF4444] px-3 py-1.5 text-[#FCA5A5] whitespace-pre-wrap break-all">
                  − {change.originalSnippet}
                </div>
              )}
              {change.proposedSnippet && (
                <div className="bg-[#22C55E]/8 border-l-2 border-[#22C55E] px-3 py-1.5 text-[#86EFAC] whitespace-pre-wrap break-all">
                  + {change.proposedSnippet}
                </div>
              )}
            </div>
          )}
          {ctx && (
            <div className="font-mono text-xs rounded overflow-hidden border border-th-border bg-th-panel">
              <div className="px-3 py-1 text-[10px] text-th-dim border-b border-th-border">
                file context · line {ctx.lineNumber}
              </div>
              {ctx.lines.map((line) => (
                <div key={line.n} className={`flex gap-2 px-3 py-0.5 ${line.isMatch ? "bg-[#F59E0B]/10" : ""}`}>
                  <span className="text-th-dim select-none w-6 text-right flex-shrink-0">{line.n}</span>
                  <span className={line.isMatch ? "text-[#FDE68A]" : "text-th-dim"}>{line.text || " "}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-th-border flex items-center gap-3">
            <span className="text-[10px] text-th-muted font-medium tracking-wide uppercase">
              Review status
            </span>
            <select
              value={reviewStatus || ""}
              onChange={(e) => {
                if (e.target.value) onReviewStatusChange(e.target.value as ReviewStatus);
              }}
              className="bg-th-panel border border-th-border-s rounded px-2 py-1.5 text-[11px] text-th-soft focus:outline-none focus:border-[#6366F1] cursor-pointer"
            >
              <option value="">Not reviewed</option>
              {REVIEW_STATUS_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {reviewStatus && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                reviewStatus === "approved"
                  ? "bg-[#10B981]/20 text-[#34D399]"
                  : reviewStatus === "removed"
                    ? "bg-[#EF4444]/20 text-[#F87171]"
                    : "bg-[#F59E0B]/20 text-[#FBBF24]"
              }`}>
                {REVIEW_STATUS_LABEL[reviewStatus]}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
