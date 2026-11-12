import type { ToolCallAnalysisResult } from "../../utils/toolCallParser";

interface Props {
  label: string;
  count: number;
  files: ToolCallAnalysisResult["readAndChanged"];
  open: boolean;
  onToggle: () => void;
  color: "green" | "amber" | "slate";
  taggedFiles?: Set<string>;
  onToggleFileTag?: (path: string) => void;
}

export default function ToolCallSection({
  label,
  count,
  files,
  open,
  onToggle,
  color,
  taggedFiles,
  onToggleFileTag,
}: Props) {
  const colorMap = {
    green: { badge: "text-[#22C55E] bg-[#22C55E]/10", dot: "bg-[#22C55E]" },
    amber: { badge: "text-[#F59E0B] bg-[#F59E0B]/10", dot: "bg-[#F59E0B]" },
    slate: { badge: "text-th-faint bg-th-raised/40", dot: "bg-th-dim" },
  };
  const { badge, dot } = colorMap[color];

  return (
    <div className="rounded-md border border-th-border overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-th-elevated/40 transition-colors text-left"
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
        <span className="text-[11px] text-th-soft flex-1 font-medium">{label}</span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badge}`}>{count}</span>
        <span className="text-th-dim text-[10px] flex-shrink-0">{open ? "▼" : "▶"}</span>
      </button>
      {open && count > 0 && (
        <div className="border-t border-th-border max-h-40 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-th-elevated [&::-webkit-scrollbar-thumb]:rounded-full">
          {files.map((f) => {
            const fileKey = f.path || f.basename;
            const tagged = taggedFiles?.has(fileKey) ?? false;
            return (
              <div
                key={fileKey}
                title={f.path}
                className="px-3 py-1.5 text-[11px] text-th-muted hover:text-th-text hover:bg-th-elevated/40 transition-colors font-mono truncate cursor-default flex items-center gap-2"
              >
                <span className="truncate flex-1">{f.basename}</span>
                {onToggleFileTag && (
                  <button
                    type="button"
                    aria-label={tagged ? "Untag file" : "Tag file"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFileTag(fileKey);
                    }}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                      tagged
                        ? "text-[#F59E0B] border-[#F59E0B]/50 bg-[#F59E0B]/10"
                        : "text-th-dim border-th-border-s hover:text-th-muted"
                    }`}
                  >
                    {tagged ? "Tagged" : "Tag"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {open && count === 0 && (
        <div className="border-t border-th-border px-3 py-2">
          <p className="text-[11px] text-th-dim italic">None</p>
        </div>
      )}
    </div>
  );
}
