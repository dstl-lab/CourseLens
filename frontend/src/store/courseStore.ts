import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CourseChangeset } from "../types/changes";
import { API_URL, errorDetail } from "../utils/api";

export type ThemeMode = "system" | "light" | "dark";

/** A file in the instructor's course folder, as listed by /api/sync-course. */
export interface RepoFile {
  filename: string;
  fileType: string;
  path?: string;
  repo?: string | null;
  stem?: string | null;
  previewPath?: string | null;
  /** Shared by every copy of one course item (e.g. "homework/hw1"). */
  artifactId?: string;
  week?: number | null;
  weekSource?: "schedule" | "path" | null;
  /** Lower ranks are preferred when picking which copy of an item to show. */
  preferRank?: number;
  size?: number;
  /** Only set in tests; the backend never sends file contents. */
  content?: string | null;
}

/** Summary of the configured course folder, from /api/course-info. */
export interface CourseInfo {
  configured: boolean;
  rootExists: boolean;
  rootName?: string | null;
  name?: string | null;
  weeks?: number | null;
  configFound: boolean;
  hasSchedule: boolean;
  stablePreviewTypes: string[];
  fileCount: number;
  unscheduledCount: number;
  warnings: string[];
}

interface CourseState {
  /** Files in the course folder; contents are fetched on demand. */
  repoFiles: RepoFile[];
  courseInfo: CourseInfo | null;
  syncError: string | null;
  isSyncing: boolean;
  syncRepoFiles: () => Promise<void>;

  /** The pasted AI suggestions (kept across reloads) and their parsed form. */
  changesRawText: string;
  setChangesRawText: (text: string) => void;
  changesParsedData: CourseChangeset | null;
  setChangesParsedData: (data: CourseChangeset | null) => void;

  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

export const useCourseStore = create<CourseState>()(
  persist(
    (set) => ({
      repoFiles: [],
      courseInfo: null,
      syncError: null,
      isSyncing: false,

      syncRepoFiles: async () => {
        set({ isSyncing: true, syncError: null });
        try {
          const [filesRes, infoRes] = await Promise.all([
            fetch(`${API_URL}/api/sync-course`),
            fetch(`${API_URL}/api/course-info`),
          ]);
          if (!filesRes.ok) {
            throw new Error(`Course sync failed: ${await errorDetail(filesRes)}`);
          }
          const repoFiles: RepoFile[] = await filesRes.json();
          const courseInfo: CourseInfo | null = infoRes.ok ? await infoRes.json() : null;
          set({ repoFiles, courseInfo, isSyncing: false });
        } catch (error) {
          console.error("Failed to sync course folder:", error);
          set({
            isSyncing: false,
            // fetch() rejects with a TypeError only when the server is unreachable.
            syncError:
              error instanceof TypeError
                ? `Couldn't reach the CourseLens backend at ${API_URL}. Is it running?`
                : error instanceof Error
                  ? error.message
                  : String(error),
          });
        }
      },

      changesRawText: "",
      setChangesRawText: (text) => set({ changesRawText: text }),
      changesParsedData: null,
      setChangesParsedData: (data) => set({ changesParsedData: data }),

      themeMode: "system",
      setThemeMode: (mode) => set({ themeMode: mode }),
    }),
    {
      name: "courselens-storage",
      version: 1,
      partialize: (state) => ({
        themeMode: state.themeMode,
        changesRawText: state.changesRawText,
      }),
    },
  ),
);
