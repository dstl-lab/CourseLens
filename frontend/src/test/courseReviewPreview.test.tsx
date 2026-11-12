import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ChangeVisualizationPanel from "../components/ChangeVisualizationPanel";
import { useCourseStore, type CourseInfo, type RepoFile } from "../store/courseStore";
import { API_URL } from "../utils/api";

// Captured before any test replaces it with a mock.
const realSyncRepoFiles = useCourseStore.getState().syncRepoFiles;

const courseInfo: CourseInfo = {
  configured: true,
  rootExists: true,
  rootName: "cs101",
  name: "CS 101 (Spring)",
  weeks: 4,
  configFound: true,
  hasSchedule: true,
  stablePreviewTypes: [],
  fileCount: 4,
  unscheduledCount: 1,
  warnings: ["courselens.json has invalid settings (weeks: too large); using defaults."],
};

const repoFiles: RepoFile[] = [
  {
    filename: "a1.ipynb",
    path: "assignments/a1/a1.ipynb",
    fileType: "homework",
    artifactId: "homework/a1",
    previewPath: "assignments/a1/a1.html",
    week: 2,
    size: 100,
  },
  {
    filename: "a1.html",
    path: "assignments/a1/a1.html",
    fileType: "homework",
    artifactId: "homework/a1",
    previewPath: "assignments/a1/a1.html",
    week: 2,
    size: 100,
  },
  {
    filename: "Lecture 03.ipynb",
    path: "slides/Lecture 03.ipynb",
    fileType: "lecture",
    artifactId: "lecture/lecture3",
    previewPath: null,
    week: 3,
    size: 100,
  },
  {
    filename: "syllabus.md",
    path: "syllabus.md",
    fileType: "schedule",
    artifactId: "path/syllabus",
    week: null,
    size: 100,
  },
];

function renderPanel() {
  return render(
    <ChangeVisualizationPanel rawText="" onRawTextChange={vi.fn()} parsedData={null} onParsedDataChange={vi.fn()} />,
  );
}

function viewButtonFor(name: string): HTMLElement {
  const header = screen.getByText(name).closest("div");
  return within(header as HTMLElement).getByRole("button", { name: "View" });
}

describe("Course Review with a configured course folder", () => {
  const fetchMock = vi.fn();
  const blobs: Blob[] = [];

  beforeEach(() => {
    blobs.length = 0;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return `blob:test/${blobs.length}`;
    });
    useCourseStore.setState({
      repoFiles,
      courseInfo,
      syncError: null,
      isSyncing: false,
      syncRepoFiles: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lays out the course's own weeks, an unscheduled column, the course name and config warnings", () => {
    renderPanel();

    expect(screen.getByText("CS 101 (Spring)")).toBeInTheDocument();
    for (const week of [1, 2, 3, 4]) {
      expect(screen.getByText(`Week ${week}`)).toBeInTheDocument();
    }
    expect(screen.queryByText("Week 5")).not.toBeInTheDocument();
    expect(screen.getByText("Unscheduled")).toBeInTheDocument();
    expect(screen.getByText("syllabus")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("courselens.json has invalid settings");
  });

  it("loads HTML previews from the course folder on demand and fixes relative links", async () => {
    fetchMock.mockResolvedValue(
      new Response('<html><head></head><body><img src="images/plot.png"></body></html>', { status: 200 }),
    );
    renderPanel();

    fireEvent.click(viewButtonFor("a1"));

    await waitFor(() => expect(document.querySelector("iframe")).toHaveAttribute("src", "blob:test/1"));
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/course-files/assignments/a1/a1.html`);
    const html = await blobs[0].text();
    expect(html).toContain(`<base href="${API_URL}/api/course-files/assignments/a1/">`);
  });

  it("renders notebooks without an HTML copy through the notebook preview endpoint", async () => {
    fetchMock.mockResolvedValue(new Response("<html><head></head><body>Lecture 3</body></html>", { status: 200 }));
    renderPanel();

    fireEvent.click(viewButtonFor("Lecture 03"));

    await waitFor(() => expect(document.querySelector("iframe")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/notebook-preview/slides/Lecture%2003.ipynb`);
  });

  it("explains why a preview could not be shown", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Could not convert Lecture 03.ipynb to a preview: bad JSON" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }),
    );
    renderPanel();

    fireEvent.click(viewButtonFor("Lecture 03"));

    expect(await screen.findByText(/Could not convert Lecture 03.ipynb/)).toBeInTheDocument();
    expect(document.querySelector("iframe")).not.toBeInTheDocument();
  });
});

describe("course folder sync", () => {
  beforeEach(() => {
    useCourseStore.setState({ syncRepoFiles: realSyncRepoFiles, syncError: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores the file list and course info", async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        new Response(JSON.stringify(url.endsWith("/api/sync-course") ? repoFiles : courseInfo), { status: 200 }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    useCourseStore.setState({
      repoFiles: [],
      courseInfo: null,
    });

    await useCourseStore.getState().syncRepoFiles();

    const state = useCourseStore.getState();
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/sync-course`);
    expect(state.repoFiles).toHaveLength(4);
    expect(state.courseInfo?.name).toBe("CS 101 (Spring)");
    expect(state.syncError).toBeNull();
  });

  it("reports an unreachable backend", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));

    await useCourseStore.getState().syncRepoFiles();

    expect(useCourseStore.getState().syncError).toMatch(/Couldn't reach the CourseLens backend/);
  });
});
