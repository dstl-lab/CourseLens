import { useRef, useEffect, useCallback, useState } from "react";
import type { CourseChange, ReviewStatus } from "../../types/changes";
import { injectHighlights } from "../../utils/highlightInjection";
import ChangesAnnotationsPanel from "./ChangesAnnotationsPanel";

interface Props {
  viewerFilename: string;
  blobUrls: Record<string, string>;
  viewerChanges: CourseChange[];
  viewerPanelWidth: number | null;
  viewerPanelRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  isDraggingAny: boolean;
  showChangeSidebar: boolean;
  onToggleChangeSidebar: () => void;
  changesSidebarWidth: number;
  handleChangesSidebarDragStart: (e: React.MouseEvent) => void;
  handleViewerDragStart: (e: React.MouseEvent) => void;
  reviewStatusMap?: Record<string, ReviewStatus>;
  onReviewStatusChange?: (changeId: string, status: ReviewStatus) => void;
  /** True while the preview is being fetched from the course folder. */
  previewLoading?: boolean;
  /** Why the preview could not be shown, if it failed. */
  previewError?: string | null;
}

export default function ViewerPanel({
  viewerFilename,
  blobUrls,
  viewerChanges,
  viewerPanelWidth,
  viewerPanelRef,
  onClose,
  isDraggingAny,
  showChangeSidebar,
  onToggleChangeSidebar,
  changesSidebarWidth,
  handleChangesSidebarDragStart,
  handleViewerDragStart,
  reviewStatusMap,
  onReviewStatusChange,
  previewLoading = false,
  previewError = null,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [focusedListChangeId, setFocusedListChangeId] = useState<string | null>(null);

  const applyHighlights = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc || doc.readyState === "loading") return;
    const first = injectHighlights(doc, viewerChanges);
    if (first) {
      try { first.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (_) {}
    }
  }, [viewerChanges]);

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (doc && doc.readyState !== "loading") applyHighlights();
  }, [viewerChanges, viewerFilename, applyHighlights]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "courselens-preview-change-click") return;
      if (typeof event.data.changeId !== "string") return;
      setFocusedListChangeId(event.data.changeId);
      window.setTimeout(() => setFocusedListChangeId(null), 2500);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const scrollToChange = useCallback((change: CourseChange) => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const tip = `[${change.changeType}] ${change.summary}`;
    const all = doc.querySelectorAll<HTMLElement>("[data-cl-tip]");
    for (const el of all) {
      if (el.getAttribute("data-cl-tip") === tip) {
        try { el.scrollIntoView({ block: "center" }); } catch (_) {}
        return;
      }
    }
  }, []);

  return (
    <>
      <div
        onMouseDown={handleViewerDragStart}
        className="w-1 flex-none cursor-col-resize bg-th-border hover:bg-[#6366F1] transition-colors relative select-none"
        title="Drag to resize viewer"
      >
        <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
      </div>

      <div
        ref={viewerPanelRef}
        className="flex flex-col border-l border-th-border flex-none"
        style={{ width: viewerPanelWidth ?? "50%" }}
      >
        <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-th-border bg-th-panel">
          <span className="text-xs text-th-muted truncate">{viewerFilename}</span>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            <button
              onClick={onToggleChangeSidebar}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                showChangeSidebar
                  ? "bg-[#6366F1] text-white border-[#6366F1]"
                  : "text-th-faint border-th-border-s hover:border-[#6366F1] hover:text-[#6366F1]"
              }`}
              title={showChangeSidebar ? "Hide change annotations" : "Show change annotations"}
            >
              Changes {viewerChanges.length > 0 ? `(${viewerChanges.length})` : ""}
            </button>
            <button
              onClick={onClose}
              className="text-th-dim hover:text-th-text text-base leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden relative">
            {isDraggingAny && <div className="absolute inset-0 z-50 cursor-col-resize" />}
            {blobUrls[viewerFilename] ? (
              <>
                <iframe
                  ref={iframeRef}
                  src={blobUrls[viewerFilename]}
                  onLoad={applyHighlights}
                  className="w-full h-full border-0 bg-white"
                  title={viewerFilename}
                />
                {viewerFilename.toLowerCase().endsWith(".pdf") && viewerChanges.length > 0 && (
                  <div className="absolute top-2 left-2 right-2 pointer-events-none z-10">
                    <div className="bg-th-elevated/90 border border-th-border-s rounded px-3 py-2 text-[11px] text-th-muted flex items-center gap-2">
                      <span className="text-[#F59E0B] flex-shrink-0">⚠</span>
                      <span>PDF format — inline highlights unavailable. Changes are shown in the sidebar.</span>
                    </div>
                  </div>
                )}
              </>
            ) : previewLoading ? (
              <div className="flex items-center justify-center h-full gap-2 text-th-dim text-sm">
                <div className="w-4 h-4 border-2 border-th-dim border-t-transparent rounded-full animate-spin"></div>
                Loading preview…
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
                <span className="text-th-dim text-sm">File preview unavailable</span>
                <span className="text-th-dim text-xs leading-relaxed">
                  {previewError ??
                    "This file isn't in the course folder CourseLens is reading. Proposed changes are listed in the Changes panel."}
                </span>
              </div>
            )}
          </div>

          {showChangeSidebar && (
            <>
              <div
                onMouseDown={handleChangesSidebarDragStart}
                className="w-1 flex-none cursor-col-resize bg-th-border hover:bg-[#6366F1] transition-colors relative select-none"
                title="Drag to resize changes panel"
              >
                <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
              </div>
              <div className="flex-none overflow-hidden" style={{ width: changesSidebarWidth }}>
                <ChangesAnnotationsPanel
                  changes={viewerChanges}
                  reviewStatusMap={reviewStatusMap}
                  onReviewStatusChange={onReviewStatusChange}
                  focusedChangeId={focusedListChangeId}
                  onChangeClick={(change) => {
                    scrollToChange(change);
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
