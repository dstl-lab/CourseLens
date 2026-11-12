import { useEffect, useRef } from "react";
import type { CourseChange, ReviewStatus } from "../../types/changes";
import { CHANGE_TYPE_STYLE, REVIEW_STATUS_OPTIONS, getChangeId } from "./constants";

interface Props {
  changes: CourseChange[];
  onChangeClick?: (change: CourseChange) => void;
  reviewStatusMap?: Record<string, ReviewStatus>;
  onReviewStatusChange?: (changeId: string, status: ReviewStatus) => void;
  focusedChangeId?: string | null;
}

type ChangeGroup = { sectionLabel: string; lineNumber: number | null; changes: CourseChange[] };

export default function ChangesAnnotationsPanel({
  changes,
  onChangeClick,
  reviewStatusMap = {},
  onReviewStatusChange,
  focusedChangeId,
}: Props) {
  const changeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const groupMap = new Map<string, ChangeGroup>();

  useEffect(() => {
    if (!focusedChangeId) return;
    const el = changeRefs.current[focusedChangeId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusedChangeId]);

  const sortedByLine = [...changes].sort((a, b) => {
    const la = a.location.lineNumber ?? Infinity;
    const lb = b.location.lineNumber ?? Infinity;
    return la - lb;
  });

  for (const change of sortedByLine) {
    const key =
      change.location.sectionLabel ||
      (change.location.lineNumber != null ? `Line ${change.location.lineNumber}` : "General");
    if (!groupMap.has(key)) {
      groupMap.set(key, { sectionLabel: key, lineNumber: change.location.lineNumber, changes: [] });
    }
    groupMap.get(key)!.changes.push(change);
  }

  const sortedGroups = [...groupMap.values()].sort((a, b) => {
    if (a.lineNumber != null && b.lineNumber != null) return a.lineNumber - b.lineNumber;
    if (a.lineNumber != null) return -1;
    if (b.lineNumber != null) return 1;
    return a.sectionLabel.localeCompare(b.sectionLabel);
  });

  return (
    <div className="flex flex-col h-full bg-th-panel border-l border-th-border overflow-hidden">
      <div className="px-3 py-2 border-b border-th-border bg-th-bg shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-th-text">Changes</span>
          {changes.length > 0 && (
            <span className="text-xs text-th-faint bg-th-elevated rounded-full px-2 py-0.5">
              {changes.length}
            </span>
          )}
        </div>
        <p className="text-[11px] text-th-dim mt-0.5">Proposed changes by location</p>
      </div>

      {changes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-xs text-th-dim text-center">No changes found for this file.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-th-elevated [&::-webkit-scrollbar-thumb]:rounded-full">
          {sortedGroups.map((group) => (
            <div key={group.sectionLabel}>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-th-border" />
                <span
                  className="text-[11px] font-medium text-th-faint whitespace-nowrap max-w-[180px] truncate"
                  title={group.sectionLabel}
                >
                  {group.lineNumber != null ? `L${group.lineNumber} · ` : ""}
                  {group.sectionLabel}
                </span>
                <div className="h-px flex-1 bg-th-border" />
              </div>

              <div className="space-y-2">
                {group.changes.map((change, i) => {
                  const typeStyle = CHANGE_TYPE_STYLE[change.changeType] ?? "text-th-muted bg-th-raised/40";
                  const changeId = getChangeId(change);
                  return (
                    <div
                      key={changeId || i}
                      ref={(el) => { changeRefs.current[changeId] = el; }}
                      data-change-id={changeId}
                      onClick={() => onChangeClick?.(change)}
                      className={`rounded-md border bg-th-bg px-3 py-2.5 transition-colors ${
                        focusedChangeId === changeId
                          ? "border-[#6366F1] ring-2 ring-[#6366F1]/40 bg-th-elevated/80"
                          : onChangeClick
                          ? "border-th-border hover:border-[#6366F1]/50 hover:bg-th-elevated/70 cursor-pointer"
                          : "border-th-border"
                      }`}
                      title={onChangeClick ? "Click to locate in file" : undefined}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${typeStyle}`}>
                          {change.changeType}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          change.priority === "primary"
                            ? "text-[#F97316] bg-[#F97316]/10"
                            : "text-th-faint bg-th-raised/40"
                        }`}>
                          {change.priority}
                        </span>
                        {onChangeClick && <span className="ml-auto text-[10px] text-th-dim">↗ locate</span>}
                      </div>
                      <p className="text-xs font-medium text-th-soft leading-snug mb-1.5">{change.summary}</p>
                      {(change.originalSnippet || change.proposedSnippet) && (
                        <div className="font-mono text-[10px] rounded overflow-hidden border border-th-border mt-1.5">
                          {change.originalSnippet && (
                            <div className="bg-[#EF4444]/8 border-l-2 border-[#EF4444] px-2 py-1 text-[#FCA5A5] whitespace-pre-wrap break-all">
                              <span className="block font-sans text-[9px] uppercase tracking-wide text-[#FCA5A5]/70 mb-0.5">
                                Before
                              </span>
                              {change.originalSnippet}
                            </div>
                          )}
                          {(change.proposedSnippet || change.newText) && (
                            <div className="bg-[#22C55E]/8 border-l-2 border-[#22C55E] px-2 py-1 text-[#86EFAC] whitespace-pre-wrap break-all">
                              <span className="block font-sans text-[9px] uppercase tracking-wide text-[#86EFAC]/70 mb-0.5">
                                After
                              </span>
                              {change.proposedSnippet ?? change.newText}
                            </div>
                          )}
                        </div>
                      )}
                      {onReviewStatusChange && (
                        <div className="mt-2 pt-2 border-t border-th-border flex items-center gap-2">
                          <label
                            className="text-[10px] text-th-dim"
                            htmlFor={`preview-status-${changeId}`}
                          >
                            Review status
                          </label>
                          <select
                            id={`preview-status-${changeId}`}
                            value={reviewStatusMap[changeId] ?? ""}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              if (e.target.value) {
                                onReviewStatusChange(changeId, e.target.value as ReviewStatus);
                              }
                            }}
                            className="bg-th-panel border border-th-border-s rounded px-1.5 py-1 text-[10px] text-th-soft focus:outline-none focus:border-[#6366F1]"
                          >
                            <option value="">Not reviewed</option>
                            {REVIEW_STATUS_OPTIONS.map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
