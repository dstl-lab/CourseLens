import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useCourseStore } from "../store/courseStore";
import { parseLLMOutput } from "../utils/changeParser";
import { parseToolCallJsonl } from "../utils/toolCallParser";
import {
  buildCourseArtifacts,
  findArtifactForChange,
  previewPathForChanges,
} from "../utils/courseArtifacts";
import { dedupeChangesForArtifacts } from "../utils/changeIdentity";
import {
  courseFileUrl,
  courseFolderUrl,
  errorDetail,
  notebookPreviewUrl,
  withBaseHref,
} from "../utils/api";
import type { ToolCallAnalysisResult, FileClassification } from "../utils/toolCallParser";
import type { CourseChange, CourseChangeset, FileType, ReviewStatus } from "../types/changes";
import { fileStem, getChangeId, fileTypeStyle } from "./changeVisualization/constants";
import type { TCStatus, FileEntry } from "./changeVisualization/constants";
import SummaryPanel from "./changeVisualization/SummaryPanel";
import ToolCallSection from "./changeVisualization/ToolCallSection";
import TimelineView from "./changeVisualization/TimelineView";
import ListView from "./changeVisualization/ListView";
import ViewerPanel from "./changeVisualization/ViewerPanel";
import { useResizablePanels } from "../hooks/useResizablePanels";

type SortBy = "filename" | "fileType" | "changeCount";

interface ChangeVisualizationPanelProps {
  rawText: string;
  onRawTextChange: (text: string) => void;
  parsedData: CourseChangeset | null;
  onParsedDataChange: (data: CourseChangeset | null) => void;
}

const REVIEW_CONTENT_EXTS = new Set([".md", ".pdf", ".html", ".htm", ".ipynb", ".tex", ".qmd", ".rmd"]);
const TEXT_PREVIEW_EXTS = new Set([".md", ".tex", ".py", ".r", ".qmd", ".rmd", ".txt", ".csv"]);
/** Files larger than this are not fetched just to show context lines. */
const MAX_CONTEXT_BYTES = 2_000_000;

function extensionOf(path: string): string {
  const idx = path.lastIndexOf(".");
  return idx === -1 ? "" : path.slice(idx).toLowerCase();
}

/** Fetch a course file and wrap it in a same-origin blob URL for the preview iframe. */
async function loadCoursePreview(path: string): Promise<string> {
  const ext = extensionOf(path);
  const isNotebook = ext === ".ipynb";
  const response = await fetch(isNotebook ? notebookPreviewUrl(path) : courseFileUrl(path));
  if (!response.ok) throw new Error(await errorDetail(response));

  if (ext === ".pdf") {
    return URL.createObjectURL(new Blob([await response.arrayBuffer()], { type: "application/pdf" }));
  }
  const text = await response.text();
  if (isNotebook || ext === ".html" || ext === ".htm") {
    const html = withBaseHref(text, courseFolderUrl(path));
    return URL.createObjectURL(new Blob([html], { type: "text/html" }));
  }
  const type = TEXT_PREVIEW_EXTS.has(ext) ? "text/plain;charset=utf-8" : "text/plain";
  return URL.createObjectURL(new Blob([text], { type }));
}

export default function ChangeVisualizationPanel({
  rawText,
  onRawTextChange,
  parsedData,
  onParsedDataChange,
}: ChangeVisualizationPanelProps) {
  const syncRepoFiles = useCourseStore((s) => s.syncRepoFiles);
  const isSyncing = useCourseStore((s) => s.isSyncing);
  const repoFiles = useCourseStore((s) => s.repoFiles);
  const courseInfo = useCourseStore((s) => s.courseInfo);
  const syncError = useCourseStore((s) => s.syncError);

  const [viewerFilename, setViewerFilename] = useState<string | null>(null);
  const [showChangeSidebar, setShowChangeSidebar] = useState(true);
  const [showReviewInputPanel, setShowReviewInputPanel] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "timeline">("timeline");
  const [showSummary, setShowSummary] = useState(false);
  const [focusedChangeId, setFocusedChangeId] = useState<string | null>(null);
  const [focusedFilename, setFocusedFilename] = useState<string | null>(null);
  const [reviewStatusMap, setReviewStatusMap] = useState<Record<string, ReviewStatus>>({});
  const [taggedFiles, setTaggedFiles] = useState<Set<string>>(new Set());
  const [showTutorial, setShowTutorial] = useState(false);
  const [activeFileTypes, setActiveFileTypes] = useState<Set<FileType>>(new Set());
  const [sortBy, setSortBy] = useState<SortBy>("filename");
  const [toolCallResult, setToolCallResult] = useState<ToolCallAnalysisResult | null>(null);
  const [toolCallSections, setToolCallSections] = useState({ readAndChanged: true, readOnly: false, notConsidered: false });
  const toolCallInputRef = useRef<HTMLInputElement>(null);
  // Previews and context text for course files are fetched on demand.
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [previewErrors, setPreviewErrors] = useState<Record<string, string>>({});
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);
  const [repoTexts, setRepoTexts] = useState<Record<string, string>>({});
  const requestedTexts = useRef<Set<string>>(new Set());
  const previewUrlsRef = useRef(previewUrls);
  const stablePreviewTypes = useMemo(() => courseInfo?.stablePreviewTypes ?? [], [courseInfo]);

  useEffect(() => {
    previewUrlsRef.current = previewUrls;
  }, [previewUrls]);

  const {
    viewerPanelWidth,
    setViewerPanelWidth,
    splitContainerRef,
    viewerPanelRef,
    handleViewerDragStart,
    changesSidebarWidth,
    handleChangesSidebarDragStart,
    isDraggingAny,
  } = useResizablePanels();

  useEffect(() => {
    syncRepoFiles();
  }, [syncRepoFiles]);

  useEffect(
    () => () => {
      Object.values(previewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  useEffect(() => {
    const saved = localStorage.getItem("reviewStatusMap");
    if (saved) {
      try { setReviewStatusMap(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
    const savedTags = localStorage.getItem("taggedFiles");
    if (savedTags) {
      try { setTaggedFiles(new Set(JSON.parse(savedTags))); } catch (e) { console.error(e); }
    }
  }, []);

  const handleReviewStatusChange = useCallback((changeId: string, status: ReviewStatus) => {
    setReviewStatusMap((prev) => {
      const next = { ...prev, [changeId]: status };
      localStorage.setItem("reviewStatusMap", JSON.stringify(next));
      return next;
    });
  }, []);

  const handleToggleFileTag = useCallback((filename: string) => {
    setTaggedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) {
        next.delete(filename);
      } else {
        next.add(filename);
      }
      localStorage.setItem("taggedFiles", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const handleSummaryChangeClick = useCallback((change: CourseChange) => {
    const changeId = getChangeId(change);
    setFocusedChangeId(changeId);
    setTimeout(() => setFocusedChangeId(null), 2500);
  }, []);

  const handleSummaryFileClick = useCallback((filename: string) => {
    setFocusedFilename(filename);
    setTimeout(() => setFocusedFilename(null), 2500);
  }, []);

  const repoArtifacts = useMemo(() => buildCourseArtifacts(repoFiles), [repoFiles]);

  const dedupedChanges = useMemo(
    () => parsedData ? dedupeChangesForArtifacts(parsedData.changes, repoArtifacts) : [],
    [parsedData, repoArtifacts],
  );

  const summaryData = useMemo(() => {
    if (!dedupedChanges.length) return { approved: [], removed: [], modified: [], pending: [] };
    const result: { approved: CourseChange[]; removed: CourseChange[]; modified: CourseChange[]; pending: CourseChange[] } = {
      approved: [], removed: [], modified: [], pending: [],
    };
    for (const change of dedupedChanges) {
      const changeId = getChangeId(change);
      const status = reviewStatusMap[changeId];
      if (status === "approved") result.approved.push(change);
      else if (status === "removed") result.removed.push(change);
      else if (status === "modified") result.modified.push(change);
      else result.pending.push(change);
    }
    return result;
  }, [dedupedChanges, reviewStatusMap]);

  const repoPathSet = useMemo(() => {
    const paths = new Set<string>();
    for (const file of repoFiles) {
      if (file.path) paths.add(file.path);
      if (file.previewPath) paths.add(file.previewPath);
    }
    return paths;
  }, [repoFiles]);

  // File name (without extension) -> the preview path of its course item.
  const previewByStem = useMemo(() => {
    const map = new Map<string, string>();
    for (const artifact of repoArtifacts) {
      map.set(fileStem(artifact.displayName), artifact.previewPath);
      map.set(fileStem(artifact.primaryPath), artifact.previewPath);
      map.set(fileStem(artifact.previewPath), artifact.previewPath);
      for (const variant of artifact.variants) {
        map.set(fileStem(variant.filename), artifact.previewPath);
        map.set(fileStem(variant.path), artifact.previewPath);
      }
    }
    return map;
  }, [repoArtifacts]);

  const matchCourseFile = useCallback(
    (llmFile: string) => previewByStem.get(fileStem(llmFile)) ?? null,
    [previewByStem],
  );

  const unifiedFiles = useMemo<FileEntry[]>(() => {
    const map = new Map<string, FileEntry>();
    repoArtifacts.forEach((artifact) => {
      map.set(artifact.id, {
        filename: artifact.displayName,
        primaryPath: artifact.primaryPath,
        previewPath: artifact.previewPath,
        repo: artifact.repo,
        fileType: artifact.fileType,
        week: artifact.week,
        changes: [],
      });
    });

    if (dedupedChanges.length > 0) {
      dedupedChanges.forEach((change) => {
        const artifact = findArtifactForChange(change, repoArtifacts);
        if (artifact && map.has(artifact.id)) {
          map.get(artifact.id)!.changes.push(change);
        } else {
          const key = change.filePath ?? change.file;
          if (!map.has(key)) {
            map.set(key, {
              filename: change.file,
              primaryPath: change.filePath,
              previewPath: change.filePath,
              fileType: change.fileType ?? "other",
              week: change.week,
              changes: [],
            });
          }
          map.get(key)!.changes.push(change);
        }
      });
    }

    for (const artifact of repoArtifacts) {
      const entry = map.get(artifact.id);
      if (entry && entry.changes.length > 0) {
        entry.previewPath = previewPathForChanges(artifact, entry.changes, stablePreviewTypes);
      }
    }

    return Array.from(map.values());
  }, [repoArtifacts, dedupedChanges, stablePreviewTypes]);

  // Fetch the text of files with proposed changes so change cards can show
  // the surrounding lines. Large files are skipped.
  useEffect(() => {
    const sizeByPath = new Map(repoFiles.map((f) => [f.path ?? f.filename, f.size ?? 0]));
    const wanted: string[] = [];
    for (const entry of unifiedFiles) {
      const path = entry.previewPath ?? entry.primaryPath;
      if (
        entry.changes.length > 0 &&
        path &&
        repoPathSet.has(path) &&
        !requestedTexts.current.has(path) &&
        (sizeByPath.get(path) ?? 0) <= MAX_CONTEXT_BYTES &&
        extensionOf(path) !== ".pdf"
      ) {
        wanted.push(path);
      }
    }
    for (const path of wanted) {
      requestedTexts.current.add(path);
      fetch(courseFileUrl(path))
        .then((response) => (response.ok ? response.text() : null))
        .then((text) => {
          if (text !== null) setRepoTexts((prev) => ({ ...prev, [path]: text }));
        })
        .catch(() => undefined);
    }
  }, [unifiedFiles, repoFiles, repoPathSet]);

  const viewerChanges = useMemo(() => {
    if (!viewerFilename) return [];
    return dedupedChanges
      .filter((change) => {
        const artifact = findArtifactForChange(change, repoArtifacts);
        if (artifact) {
          return (
            artifact.previewPath === viewerFilename ||
            artifact.primaryPath === viewerFilename ||
            artifact.variants.some((variant) => variant.path === viewerFilename)
          );
        }
        return matchCourseFile(change.filePath ?? change.file) === viewerFilename;
      })
      .sort((a, b) => (a.location.lineNumber ?? Infinity) - (b.location.lineNumber ?? Infinity));
  }, [viewerFilename, dedupedChanges, repoArtifacts, matchCourseFile]);

  const fetchAndShowPreview = useCallback(async (filename: string) => {
    setViewerFilename(filename);
    // Only files in the course folder can be previewed.
    if (!repoPathSet.has(filename) || previewUrls[filename]) return;

    setLoadingPreview(filename);
    setPreviewErrors((prev) => {
      const next = { ...prev };
      delete next[filename];
      return next;
    });
    try {
      const url = await loadCoursePreview(filename);
      setPreviewUrls((prev) => ({ ...prev, [filename]: url }));
    } catch (error) {
      const detail = error instanceof TypeError
        ? "Couldn't reach the CourseLens backend. Is it running?"
        : error instanceof Error ? error.message : String(error);
      setPreviewErrors((prev) => ({ ...prev, [filename]: detail }));
    } finally {
      setLoadingPreview((current) => (current === filename ? null : current));
    }
  }, [repoPathSet, previewUrls]);

  const handleToggleView = useCallback((matched: string) => {
    if (viewerFilename === matched) {
      setViewerFilename(null);
      setViewerPanelWidth(null);
    } else {
      setViewerPanelWidth(null);
      fetchAndShowPreview(matched);
    }
  }, [viewerFilename, setViewerPanelWidth, fetchAndShowPreview]);

  // ─── Tool-call status lookup ─────────────────────────────────────────────────

  const shortCode = (s: string): string | null => {
    const m = s.match(/^([a-z]+\d+)/i);
    return m ? m[1].toLowerCase() : null;
  };

  const { toolCallExactMap, toolCallShortMap } = useMemo(() => {
    const exact = new Map<string, TCStatus>();
    const short = new Map<string, TCStatus>();
    const PRIORITY: Record<TCStatus, number> = { read_and_changed: 2, read_only: 1, not_considered: 0 };

    const register = (basename: string, status: TCStatus) => {
      const stem = fileStem(basename);
      const existingExact = exact.get(stem);
      if (!existingExact || PRIORITY[status] > PRIORITY[existingExact]) exact.set(stem, status);
      const code = shortCode(stem);
      if (code) {
        const existingShort = short.get(code);
        if (!existingShort || PRIORITY[status] > PRIORITY[existingShort]) short.set(code, status);
      }
    };

    if (toolCallResult) {
      for (const e of toolCallResult.readAndChanged) register(e.basename, "read_and_changed");
      for (const e of toolCallResult.readOnly) register(e.basename, "read_only");
    }
    return { toolCallExactMap: exact, toolCallShortMap: short };
  }, [toolCallResult]);

  const lookupToolCallStatus = useCallback((filename: string): TCStatus | null => {
    if (!toolCallResult) return null;
    const bn = filename.split(/[/\\]/).pop() || filename;
    const stem = fileStem(bn);

    if (toolCallExactMap.has(stem)) return toolCallExactMap.get(stem)!;

    const code = shortCode(stem);
    if (code && toolCallShortMap.has(code)) return toolCallShortMap.get(code)!;

    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const normalizedStem = norm(stem);
    if (normalizedStem.length >= 5) {
      let best: TCStatus | null = null;
      let bestLen = 0;
      for (const [key, val] of toolCallExactMap) {
        const normalizedKey = norm(key);
        const shorter = normalizedKey.length <= normalizedStem.length ? normalizedKey : normalizedStem;
        const longer  = normalizedKey.length <= normalizedStem.length ? normalizedStem : normalizedKey;
        if (shorter.length >= 5 && longer.includes(shorter) && shorter.length > bestLen) {
          bestLen = shorter.length;
          best = val;
        }
      }
      if (best) return best;
    }

    return null;
  }, [toolCallResult, toolCallExactMap, toolCallShortMap]);

  const toolCallBuckets = useMemo(() => {
    type Entry = { path: string; basename: string; classification: FileClassification };
    const sugg: Entry[] = [];
    const cons: Entry[] = [];
    const not: Entry[] = [];
    if (!toolCallResult) return { suggestedChanges: sugg, consideredNoChanges: cons, notConsidered: not };

    const normalizedPath = (value: string) => value.toLowerCase().replace(/\\/g, "/");
    const parsedEntryKey = (entry: Entry) => normalizedPath(entry.path || entry.basename);
    const variantMatchesEntry = (
      variantPath: string,
      variantFilename: string,
      entry: Entry,
    ) => {
      const entryPath = normalizedPath(entry.path);
      const variant = normalizedPath(variantPath);
      const entryStem = fileStem(entry.basename);
      const variantStem = fileStem(variantFilename);
      return (
        entryPath === variant ||
        entryPath.endsWith(`/${variant}`) ||
        variant.endsWith(`/${entryPath}`) ||
        (entryStem.length >= 3 && entryStem === variantStem)
      );
    };
    const artifactMatchesEntry = (
      artifact: (typeof repoArtifacts)[number],
      entry: Entry,
    ) =>
      artifact.variants.some((variant) =>
        variantMatchesEntry(variant.path, variant.filename, entry),
      );
    const artifactHasReviewContent = (artifact: (typeof repoArtifacts)[number]) =>
      artifact.variants.some((variant) => REVIEW_CONTENT_EXTS.has(variant.extension));

    const matchedParsedKeys = new Set<string>();
    const entryByArtifactId = new Map(unifiedFiles.map((file) => [file.primaryPath, file]));

    for (const artifact of repoArtifacts) {
      if (!artifactHasReviewContent(artifact)) continue;

      const matchedChanged = toolCallResult.readAndChanged.filter((entry) =>
        artifactMatchesEntry(artifact, entry),
      );
      const matchedReadOnly = toolCallResult.readOnly.filter((entry) =>
        artifactMatchesEntry(artifact, entry),
      );
      matchedChanged.forEach((entry) => matchedParsedKeys.add(parsedEntryKey(entry)));
      matchedReadOnly.forEach((entry) => matchedParsedKeys.add(parsedEntryKey(entry)));

      const fileEntry = entryByArtifactId.get(artifact.primaryPath);
      const tcStatus =
        matchedChanged.length > 0
          ? "read_and_changed"
          : matchedReadOnly.length > 0
            ? "read_only"
            : lookupToolCallStatus(artifact.displayName);
      const hasProposed = (fileEntry?.changes.length ?? 0) > 0 || tcStatus === "read_and_changed";
      const bucketEntry = {
        path: artifact.primaryPath,
        basename: artifact.displayName,
        classification: hasProposed
          ? "read_and_changed"
          : tcStatus === "read_only"
            ? "read_only"
            : "not_considered",
      } satisfies Entry;

      if (hasProposed) {
        sugg.push(bucketEntry);
      } else if (tcStatus === "read_only") {
        cons.push(bucketEntry);
      } else {
        not.push(bucketEntry);
      }
    }

    // Include manifest/tool-call changed files that aren't in the repo listing.
    // Repo sync can be unavailable, and generated manifests are still useful
    // evidence of suggested changes.
    for (const entry of toolCallResult.readAndChanged) {
      const key = parsedEntryKey(entry);
      if (!matchedParsedKeys.has(key)) {
        sugg.push(entry);
        matchedParsedKeys.add(key);
      }
    }

    // When repo sync is unavailable, parsed read-only files are the only
    // evidence we have. When sync is available, unmatched read-only paths are
    // usually prompts, manifests, docs, or repo admin files rather than course
    // artifacts, so keep them out of the course-content denominator.
    if (repoArtifacts.length === 0) {
      for (const entry of toolCallResult.readOnly) {
        const key = parsedEntryKey(entry);
        if (!matchedParsedKeys.has(key)) {
          cons.push({ path: entry.path, basename: entry.basename, classification: "read_only" });
          matchedParsedKeys.add(key);
        }
      }
    }

    return { suggestedChanges: sugg, consideredNoChanges: cons, notConsidered: not };
  }, [toolCallResult, repoArtifacts, unifiedFiles, lookupToolCallStatus]);

  const handleToolCallUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) setToolCallResult(parseToolCallJsonl(content));
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const toggleToolCallSection = (key: keyof typeof toolCallSections) =>
    setToolCallSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleParse = () => {
    const trimmed = rawText.trim();
    if (!trimmed) return;
    onParsedDataChange(parseLLMOutput(trimmed));
  };

  const presentFileTypes = useMemo(
    () => [...new Set(unifiedFiles.map((f) => f.fileType).filter(Boolean))] as FileType[],
    [unifiedFiles]
  );

  const toggleFileType = (ft: FileType) => {
    setActiveFileTypes((prev) => {
      const next = new Set(prev);
      if (next.has(ft)) {
        next.delete(ft);
      } else {
        next.add(ft);
      }
      return next;
    });
  };

  const visibleEntries = useMemo(() => {
    let entries = unifiedFiles;
    if (activeFileTypes.size > 0) {
      entries = entries.filter((f) => activeFileTypes.has(f.fileType as FileType));
    }
    entries.sort((a, b) => {
      if (sortBy === "fileType") return a.fileType.localeCompare(b.fileType);
      if (sortBy === "changeCount") return b.changes.length - a.changes.length;
      return a.filename.localeCompare(b.filename);
    });
    return entries;
  }, [unifiedFiles, activeFileTypes, sortBy]);

  const sharedViewProps = {
    visibleEntries,
    matchCourseFile,
    fileContents: repoTexts,
    blobUrls: previewUrls,
    viewerFilename,
    onToggleView: handleToggleView,
    lookupToolCallStatus,
    toolCallResult,
    reviewStatusMap,
    onReviewStatusChange: handleReviewStatusChange,
    focusedChangeId,
    taggedFiles,
    onToggleFileTag: handleToggleFileTag,
    focusedFilename,
  };

  return (
    <div className="flex flex-col h-full min-w-0 overflow-hidden bg-th-bg text-th-text">
      {/* Header */}
      <div className="px-6 py-3 border-b border-th-border flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">Course Review</span>
          {courseInfo?.name && (
            <span className="text-xs text-th-muted">{courseInfo.name}</span>
          )}
          <button
            type="button"
            aria-label="Course Review help"
            onClick={() => setShowTutorial(true)}
            className="w-6 h-6 rounded border border-th-border-s text-th-dim hover:text-th-text hover:bg-th-elevated transition-colors text-xs"
          >
            ?
          </button>
          {isSyncing ? (
            <span className="text-[10px] text-[#F59E0B] flex items-center gap-1.5 px-2 py-0.5 bg-[#F59E0B]/10 rounded border border-[#F59E0B]/20">
              <div className="w-2.5 h-2.5 border border-[#F59E0B] border-t-transparent rounded-full animate-spin"></div>
              Reading course folder...
            </span>
          ) : repoFiles.length > 0 ? (
            <span
              className="text-[10px] text-[#10B981] flex items-center gap-1.5 px-2 py-0.5 bg-[#10B981]/10 rounded border border-[#10B981]/20"
              title={courseInfo?.rootName ? `Course folder: ${courseInfo.rootName}` : undefined}
            >
              ✓ Course folder synced ({repoFiles.length} files)
            </span>
          ) : null}
          {courseInfo && !courseInfo.hasSchedule && repoFiles.length > 0 && (
            <span
              className="text-[10px] text-th-dim px-2 py-0.5 rounded border border-th-border-s"
              title="Add a schedule to courselens.json (see docs/courselens-config.md) to place files in weeks."
            >
              No course schedule — files are unscheduled
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {parsedData && (
            <span className="text-xs text-th-faint">
              {dedupedChanges.length} proposed change{dedupedChanges.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {(syncError || (courseInfo?.warnings.length ?? 0) > 0) && (
        <div role="alert" className="px-6 py-2 border-b border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[11px] text-th-soft space-y-0.5">
          {syncError && <p>{syncError}</p>}
          {courseInfo?.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      )}

      {showTutorial && (
        <div className="fixed inset-0 z-40 bg-th-bg/70 flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-lg border border-th-border bg-th-panel shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-th-border">
              <h2 className="text-sm font-semibold text-th-text">Course Review help</h2>
              <button
                type="button"
                onClick={() => setShowTutorial(false)}
                className="text-th-dim hover:text-th-text"
                aria-label="Close Course Review help"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs text-th-muted leading-relaxed">
              <p><strong className="text-th-soft">Review changes:</strong> paste generated suggestions and show them against course files.</p>
              <p><strong className="text-th-soft">File review analysis:</strong> upload tool-call logs to see which files were changed, checked, or skipped.</p>
              <p><strong className="text-th-soft">Timeline:</strong> files appear in the week your course schedule (courselens.json) lists them; the rest are under Unscheduled.</p>
              <p><strong className="text-th-soft">File blocks:</strong> expand files to inspect their proposed changes.</p>
              <p><strong className="text-th-soft">Preview:</strong> open a file to locate highlighted edits and set review status.</p>
              <p><strong className="text-th-soft">Tags:</strong> mark files that need follow-up review.</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {showReviewInputPanel ? (
          <div className="relative flex-shrink-0">
            <div className="w-80 h-full flex flex-col border-r border-th-border bg-th-bg">
              <div className="p-4 flex flex-col gap-3 shrink-0">
                <label className="block text-xs text-th-muted shrink-0">Paste generated suggestions</label>
                <textarea
                  value={rawText}
                  onChange={(e) => onRawTextChange(e.target.value)}
                  placeholder="Paste generated suggestions..."
                  className="h-44 shrink-0 px-3 py-2 text-sm bg-th-panel border border-th-border-s rounded text-th-text focus:outline-none focus:border-[#6366F1] resize-none font-mono cl-scrollbar"
                />
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={handleParse}
                    disabled={!rawText.trim()}
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-[#6366F1] hover:bg-[#4F46E5] rounded disabled:opacity-40 transition-colors"
                  >
                    Review changes
                  </button>
                </div>
              </div>

              {/* File review analysis */}
              <div className="flex flex-col border-t border-th-border overflow-hidden flex-1 min-h-0">
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs font-semibold text-th-muted">File review analysis</span>
                  <button
                    onClick={() => toolCallInputRef.current?.click()}
                    className="text-[10px] px-2.5 py-1 bg-th-elevated hover:bg-th-raised text-th-muted hover:text-th-text rounded border border-th-border-s transition-colors flex-shrink-0"
                  >
                    Upload .jsonl
                  </button>
                  <input ref={toolCallInputRef} type="file" onChange={handleToolCallUpload} className="hidden" />
                </div>

                {toolCallResult ? (
                  <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-th-elevated [&::-webkit-scrollbar-thumb]:rounded-full">
                    <div className="text-[10px] text-th-dim px-1 pb-1">
                      {toolCallResult.totalLines} events · {toolCallBuckets.suggestedChanges.length + toolCallBuckets.consideredNoChanges.length + toolCallBuckets.notConsidered.length} files
                      {toolCallResult.parseErrors > 0 && (
                        <span className="text-[#F59E0B] ml-1">· {toolCallResult.parseErrors} parse errors</span>
                      )}
                    </div>
                    <ToolCallSection
                      label="Suggested changes"
                      count={toolCallBuckets.suggestedChanges.length}
                      files={toolCallBuckets.suggestedChanges}
                      open={toolCallSections.readAndChanged}
                      onToggle={() => toggleToolCallSection("readAndChanged")}
                      color="green"
                      taggedFiles={taggedFiles}
                      onToggleFileTag={handleToggleFileTag}
                    />
                    <ToolCallSection
                      label="Checked, no changes"
                      count={toolCallBuckets.consideredNoChanges.length}
                      files={toolCallBuckets.consideredNoChanges}
                      open={toolCallSections.readOnly}
                      onToggle={() => toggleToolCallSection("readOnly")}
                      color="amber"
                      taggedFiles={taggedFiles}
                      onToggleFileTag={handleToggleFileTag}
                    />
                    <ToolCallSection
                      label="Not checked"
                      count={toolCallBuckets.notConsidered.length}
                      files={toolCallBuckets.notConsidered}
                      open={toolCallSections.notConsidered}
                      onToggle={() => toggleToolCallSection("notConsidered")}
                      color="slate"
                      taggedFiles={taggedFiles}
                      onToggleFileTag={handleToggleFileTag}
                    />
                    <button
                      onClick={() => setToolCallResult(null)}
                      className="w-full mt-1 text-[10px] text-th-dim hover:text-th-muted transition-colors"
                    >
                      clear
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center px-4 pb-4">
                    <p className="text-[11px] text-th-dim text-center leading-relaxed">
                      Upload a .jsonl tool-call export to see which files were changed, checked, or skipped.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              aria-label="Collapse review input panel"
              title="Collapse review input panel"
              onClick={() => setShowReviewInputPanel(false)}
              className="absolute top-4 -right-3 z-10 w-6 h-9 rounded border border-th-border-s bg-th-panel text-th-dim hover:text-th-text hover:bg-th-elevated shadow-sm transition-colors"
            >
              <span aria-hidden="true">&lt;</span>
            </button>
          </div>
        ) : (
          <div className="w-7 flex-shrink-0 border-r border-th-border bg-th-bg pt-4 flex justify-center">
            <button
              type="button"
              aria-label="Expand review input panel"
              title="Expand review input panel"
              onClick={() => setShowReviewInputPanel(true)}
              className="w-6 h-9 rounded border border-th-border-s bg-th-panel text-th-dim hover:text-th-text hover:bg-th-elevated shadow-sm transition-colors"
            >
              <span aria-hidden="true">&gt;</span>
            </button>
          </div>
        )}

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {presentFileTypes.length > 0 && (
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-th-border flex-wrap gap-2">
              <div className="flex items-center gap-1.5 flex-wrap flex-1">
                <span className="text-[10px] text-th-dim uppercase tracking-wide mr-1">Filter</span>
                {presentFileTypes.map((ft) => (
                  <button
                    key={ft}
                    onClick={() => toggleFileType(ft)}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                      activeFileTypes.has(ft)
                        ? `${fileTypeStyle(ft)} ring-1 ring-current`
                        : "text-th-faint bg-th-elevated hover:bg-th-raised"
                    }`}
                  >
                    {ft}
                  </button>
                ))}
                {activeFileTypes.size > 0 && (
                  <button
                    onClick={() => setActiveFileTypes(new Set())}
                    className="text-[10px] text-th-dim hover:text-th-muted ml-1"
                  >
                    clear
                  </button>
                )}
              </div>

              <div className="flex items-center gap-4 flex-shrink-0">
                <div className={`flex items-center gap-1.5 transition-opacity ${viewMode === 'timeline' ? 'opacity-50 pointer-events-none' : ''}`}>
                  <span className="text-[10px] text-th-dim uppercase tracking-wide">Sort</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortBy)}
                    className="text-[11px] bg-th-elevated border border-th-border-s text-th-muted rounded px-1.5 py-0.5 focus:outline-none focus:border-[#6366F1]"
                  >
                    <option value="filename">Filename</option>
                    <option value="fileType">File type</option>
                    <option value="changeCount">Change count</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 border-l border-th-border pl-4">
                  <span className="text-[10px] text-th-dim uppercase tracking-wide">View</span>
                  <div className="flex bg-th-elevated rounded p-0.5">
                    <button
                      onClick={() => setViewMode("list")}
                      className={`px-3 py-1 text-[10px] font-medium rounded transition-colors ${
                        viewMode === "list" ? "bg-[#6366F1] text-white" : "text-th-muted hover:text-th-text"
                      }`}
                    >
                      List
                    </button>
                    <button
                      onClick={() => setViewMode("timeline")}
                      className={`px-3 py-1 text-[10px] font-medium rounded transition-colors ${
                        viewMode === "timeline" ? "bg-[#6366F1] text-white" : "text-th-muted hover:text-th-text"
                      }`}
                    >
                      Timeline
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 border-l border-th-border pl-4">
                  <button
                    onClick={() => setShowSummary(!showSummary)}
                    className={`px-3 py-1 text-[10px] font-medium rounded transition-colors ${
                      showSummary ? "bg-[#10B981] text-white" : "bg-th-elevated text-th-muted hover:text-th-text"
                    }`}
                  >
                    Summary
                  </button>
                </div>
              </div>
            </div>
          )}

          <div ref={splitContainerRef} className="flex flex-1 min-h-0 overflow-hidden">
            <div className={`cl-review-overview-scroll cl-scrollbar px-4 pt-4 pb-8 flex-1 min-w-0 ${viewMode === "timeline" ? "overflow-y-auto overflow-x-auto" : "overflow-y-auto overflow-x-hidden"}`}>
              {visibleEntries.length > 0 ? (
                viewMode === "timeline"
                  ? <TimelineView {...sharedViewProps} termWeeks={courseInfo?.weeks} />
                  : <ListView {...sharedViewProps} />
              ) : (
                <div className="flex items-center justify-center h-full text-th-dim text-sm">
                  {repoFiles.length > 0
                    ? "No files match the current filter."
                    : !courseInfo
                      ? "No course files loaded yet."
                      : !courseInfo.configured
                        ? "No course folder is set. Add COURSE_REVIEW_ROOT to backend/.env and restart the backend."
                        : "No course files were found in your course folder. Check its folder and file names (see docs/courselens-config.md)."}
                </div>
              )}
            </div>

            {viewerFilename && (
              <ViewerPanel
                viewerFilename={viewerFilename}
                blobUrls={previewUrls}
                previewLoading={loadingPreview === viewerFilename}
                previewError={previewErrors[viewerFilename] ?? null}
                viewerChanges={viewerChanges}
                viewerPanelWidth={viewerPanelWidth}
                viewerPanelRef={viewerPanelRef}
                onClose={() => { setViewerFilename(null); setViewerPanelWidth(null); }}
                isDraggingAny={isDraggingAny}
                showChangeSidebar={showChangeSidebar}
                onToggleChangeSidebar={() => setShowChangeSidebar((v) => !v)}
                changesSidebarWidth={changesSidebarWidth}
                handleChangesSidebarDragStart={handleChangesSidebarDragStart}
                handleViewerDragStart={handleViewerDragStart}
                reviewStatusMap={reviewStatusMap}
                onReviewStatusChange={handleReviewStatusChange}
              />
            )}

            {showSummary && (
              <SummaryPanel
                summaryData={summaryData}
                taggedFiles={taggedFiles}
                onClose={() => setShowSummary(false)}
                onChangeClick={handleSummaryChangeClick}
                onFileClick={handleSummaryFileClick}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
