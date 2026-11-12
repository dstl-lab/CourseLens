import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ChangeVisualizationPanel from "../components/ChangeVisualizationPanel";
import { useCourseStore } from "../store/courseStore";
import type { CourseChange, CourseChangeset } from "../types/changes";

function duplicateChange(overrides: Partial<CourseChange>): CourseChange {
  return {
    id: "",
    file: "hw1.ipynb",
    filePath: "course-private/homeworks/hw1/src/hw1.ipynb",
    fileType: "homework",
    week: null,
    lectureNumber: null,
    changeType: "clarify",
    priority: "primary",
    summary: "Clarify test instructions.",
    originalSnippet: "Run the notebook.",
    proposedSnippet: "Run all tests before submitting.",
    location: { sectionLabel: "Submission", lineNumber: 12 },
    ...overrides,
  };
}

const parsedData: CourseChangeset = {
  totalFilesTouched: 1,
  changes: [
    duplicateChange({ file: "hw1.ipynb" }),
    duplicateChange({
      file: "hw1.html",
      filePath: "course-public/homeworks/hw1/hw1.html",
    }),
  ],
};

describe("Course Review duplicate changes", () => {
  beforeEach(() => {
    useCourseStore.setState({
      repoFiles: [
        {
          filename: "hw1.ipynb",
          path: "course-private/homeworks/hw1/src/hw1.ipynb",
          repo: "course-private",
          stem: "hw1",
          fileType: "homework",
          content: "{}",
          previewPath: "course-public/homeworks/hw1/hw1.html",
        },
        {
          filename: "hw1.html",
          path: "course-public/homeworks/hw1/hw1.html",
          repo: "course-public",
          stem: "hw1",
          fileType: "homework",
          content: "<p>Run the notebook.</p>",
        },
      ],
      isSyncing: false,
      syncRepoFiles: vi.fn(),
    });
  });

  it("renders duplicate ipynb/html changes as one proposed change", () => {
    render(
      <ChangeVisualizationPanel
        rawText=""
        onRawTextChange={vi.fn()}
        parsedData={parsedData}
        onParsedDataChange={vi.fn()}
      />,
    );

    expect(screen.getByText("1 proposed change")).toBeInTheDocument();
    expect(screen.getByText("1 updates")).toBeInTheDocument();
  });

  it("opens the stable private homework preview when grouped changes reference source content", () => {
    useCourseStore.setState({
      repoFiles: [
        {
          filename: "hw2.ipynb",
          path: "course-public/homeworks/hw2/hw2.ipynb",
          repo: "course-public",
          stem: "hw2",
          fileType: "homework",
          content: "{}",
          previewPath: "course-public/homeworks/hw2/hw2.html",
        },
        {
          filename: "hw2.html",
          path: "course-public/homeworks/hw2/hw2.html",
          repo: "course-public",
          stem: "hw2",
          fileType: "homework",
          content: "<p>Released homework.</p>",
        },
        {
          filename: "hw2.ipynb",
          path: "course-private/homeworks/hw2/src/hw2.ipynb",
          repo: "course-private",
          stem: "hw2",
          fileType: "homework",
          content: "{}",
          previewPath: "course-private/homeworks/hw2/src/hw2.html",
        },
        {
          filename: "hw2.html",
          path: "course-private/homeworks/hw2/src/hw2.html",
          repo: "course-private",
          stem: "hw2",
          fileType: "homework",
          content: "<p>Solution-only content.</p>",
        },
      ],
      isSyncing: false,
      syncRepoFiles: vi.fn(),
    });

    render(
      <ChangeVisualizationPanel
        rawText=""
        onRawTextChange={vi.fn()}
        parsedData={{
          totalFilesTouched: 1,
          changes: [
            duplicateChange({
              file: "hw2.ipynb",
              filePath: "course-private/homeworks/hw2/src/hw2.ipynb",
              summary: "Clarify solution-only instructions.",
            }),
          ],
        }}
        onParsedDataChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));

    expect(screen.getByText("course-private/homeworks/hw2/src/hw2.html")).toBeInTheDocument();
    expect(screen.queryByText("course-public/homeworks/hw2/hw2.html")).not.toBeInTheDocument();
  });
});
