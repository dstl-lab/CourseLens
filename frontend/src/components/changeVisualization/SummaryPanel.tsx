import { useState } from "react";
import type { CourseChange } from "../../types/changes";
import { CHANGE_TYPE_STYLE, REVIEW_STATUS_LABEL, getChangeId } from "./constants";

interface SummaryData {
  approved: CourseChange[];
  removed: CourseChange[];
  modified: CourseChange[];
  pending: CourseChange[];
}

interface Props {
  summaryData: SummaryData;
  taggedFiles: Set<string>;
  onClose: () => void;
  onChangeClick: (change: CourseChange) => void;
  onFileClick: (filename: string) => void;
}

function SummaryChangeEntry({ change, onClick }: { change: CourseChange; onClick: () => void }) {
  const typeStyle = CHANGE_TYPE_STYLE[change.changeType] ?? "text-th-muted bg-th-raised/40";

  return (
    <div
      onClick={onClick}
      className="px-3 py-2 bg-th-bg rounded border border-th-border hover:border-[#6366F1] hover:bg-th-elevated/50 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="text-[10px] text-th-faint font-medium truncate max-w-[100px]" title={change.file}>
          {change.file}
        </span>
        {change.location.lineNumber && (
          <span className="text-[10px] text-th-dim">:L{change.location.lineNumber}</span>
        )}
        {change.location.sectionLabel && (
          <span className="text-[10px] text-th-dim truncate max-w-[80px]" title={change.location.sectionLabel}>
            § {change.location.sectionLabel}
          </span>
        )}
        <span className={`ml-auto px-1.5 py-0.5 text-[9px] font-semibold uppercase rounded ${typeStyle}`}>
          {change.changeType}
        </span>
      </div>

      {(change.originalSnippet || change.proposedSnippet) && (
        <div className="font-mono text-[10px] rounded overflow-hidden border border-th-border mb-1.5">
          {change.originalSnippet && (
            <div className="bg-[#EF4444]/8 border-l-2 border-[#EF4444] px-2 py-0.5 text-[#FCA5A5] whitespace-pre-wrap break-all truncate">
              − {change.originalSnippet.length > 60 ? change.originalSnippet.slice(0, 60) + "…" : change.originalSnippet}
            </div>
          )}
          {change.proposedSnippet && (
            <div className="bg-[#22C55E]/8 border-l-2 border-[#22C55E] px-2 py-0.5 text-[#86EFAC] whitespace-pre-wrap break-all truncate">
              + {change.proposedSnippet.length > 60 ? change.proposedSnippet.slice(0, 60) + "…" : change.proposedSnippet}
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-th-muted leading-snug line-clamp-2">{change.summary}</p>
    </div>
  );
}

export default function SummaryPanel({ summaryData, taggedFiles, onClose, onChangeClick, onFileClick }: Props) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    tagged: true,
    approved: true,
    removed: true,
    modified: true,
    pending: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const total = summaryData.approved.length + summaryData.removed.length + summaryData.modified.length + summaryData.pending.length;
  const taggedFilesArray = Array.from(taggedFiles);

  const sections = [
    { key: "approved", label: REVIEW_STATUS_LABEL.approved, icon: "✓", changes: summaryData.approved, color: "text-[#10B981]", bg: "bg-[#10B981]/10", border: "border-[#10B981]/30" },
    { key: "removed", label: REVIEW_STATUS_LABEL.removed, icon: "✗", changes: summaryData.removed, color: "text-[#EF4444]", bg: "bg-[#EF4444]/10", border: "border-[#EF4444]/30" },
    { key: "modified", label: REVIEW_STATUS_LABEL.modified, icon: "⟳", changes: summaryData.modified, color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10", border: "border-[#F59E0B]/30" },
    { key: "pending", label: "Pending", icon: "○", changes: summaryData.pending, color: "text-th-faint", bg: "bg-th-faint/10", border: "border-th-faint/30" },
  ];

  return (
    <div className="w-80 border-l border-th-border bg-th-panel flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-th-border bg-th-bg flex items-center justify-between flex-shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-th-text">Review Summary</h3>
          <p className="text-[10px] text-th-dim mt-0.5">
            {total} changes · {taggedFilesArray.length} tagged files
          </p>
        </div>
        <button onClick={onClose} className="text-th-dim hover:text-th-text text-lg leading-none">
          ×
        </button>
      </div>

      <div className="px-4 py-2 border-b border-th-border flex items-center gap-2 flex-wrap flex-shrink-0 bg-th-bg/50">
        <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30 border">
          ⚑ {taggedFilesArray.length}
        </span>
        {sections.map((section) => (
          <span
            key={section.key}
            className={`px-2 py-0.5 text-[10px] font-medium rounded ${section.bg} ${section.color} ${section.border} border`}
          >
            {section.icon} {section.changes.length}
          </span>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-th-elevated [&::-webkit-scrollbar-thumb]:rounded-full">
        <div className="rounded-lg border border-[#F59E0B]/30 overflow-hidden">
          <button
            onClick={() => toggleSection("tagged")}
            className="w-full px-3 py-2 flex items-center justify-between bg-[#F59E0B]/10 hover:opacity-90 transition-opacity"
          >
            <div className="flex items-center gap-2">
              <span className="text-[#F59E0B] text-sm">⚑</span>
              <span className="text-xs font-medium text-[#F59E0B]">Tagged files</span>
              <span className="text-[10px] text-th-faint bg-th-elevated px-1.5 py-0.5 rounded-full">
                {taggedFilesArray.length}
              </span>
            </div>
            <span className="text-[10px] text-th-dim">{expandedSections["tagged"] ? "▼" : "▶"}</span>
          </button>

          {expandedSections["tagged"] && taggedFilesArray.length > 0 && (
            <div className="p-2 space-y-2 bg-th-panel">
              {taggedFilesArray.map((filename) => (
                <div
                  key={filename}
                  onClick={() => onFileClick(filename)}
                  className="px-3 py-2 bg-th-bg rounded border border-th-border hover:border-[#F59E0B] hover:bg-th-elevated/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[#F59E0B] text-xs">⚑</span>
                    <span className="text-[11px] text-th-soft font-medium truncate" title={filename}>
                      {filename}
                    </span>
                  </div>
                  <p className="text-[10px] text-th-faint mt-1">File needs manual review</p>
                </div>
              ))}
            </div>
          )}
          {expandedSections["tagged"] && taggedFilesArray.length === 0 && (
            <div className="px-3 py-4 text-center bg-th-panel">
              <span className="text-[11px] text-th-dim italic">No files tagged for review</span>
            </div>
          )}
        </div>

        {sections.map((section) => (
          <div key={section.key} className={`rounded-lg border ${section.border} overflow-hidden`}>
            <button
              onClick={() => toggleSection(section.key)}
              className={`w-full px-3 py-2 flex items-center justify-between ${section.bg} hover:opacity-90 transition-opacity`}
            >
              <div className="flex items-center gap-2">
                <span className={`${section.color} text-sm`}>{section.icon}</span>
                <span className={`text-xs font-medium ${section.color}`}>{section.label}</span>
                <span className="text-[10px] text-th-faint bg-th-elevated px-1.5 py-0.5 rounded-full">
                  {section.changes.length}
                </span>
              </div>
              <span className="text-[10px] text-th-dim">{expandedSections[section.key] ? "▼" : "▶"}</span>
            </button>

            {expandedSections[section.key] && section.changes.length > 0 && (
              <div className="p-2 space-y-2 bg-th-panel">
                {section.changes.map((change) => (
                  <SummaryChangeEntry
                    key={getChangeId(change)}
                    change={change}
                    onClick={() => onChangeClick(change)}
                  />
                ))}
              </div>
            )}
            {expandedSections[section.key] && section.changes.length === 0 && (
              <div className="px-3 py-4 text-center bg-th-panel">
                <span className="text-[11px] text-th-dim italic">No changes in this category</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export type { SummaryData };
