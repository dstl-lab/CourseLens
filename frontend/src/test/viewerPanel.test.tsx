import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import ViewerPanel from "../components/changeVisualization/ViewerPanel";
import type { CourseChange } from "../types/changes";

const change = {
  id: "change-1",
  file: "hw1.html",
  fileType: "homework",
  week: null,
  lectureNumber: null,
  changeType: "clarify",
  priority: "primary",
  summary: "Clarify notebook submission.",
  location: { lineNumber: 10, sectionLabel: "Submission" },
  originalSnippet: "Run notebook.",
  proposedSnippet: "Run all tests.",
} as CourseChange;

describe("ViewerPanel preview clicks", () => {
  it("snaps the preview change list to a clicked highlight without focusing the overview", async () => {
    const onPreviewChangeClick = vi.fn();
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(
      <ViewerPanel
        viewerFilename="hw1.html"
        blobUrls={{}}
        viewerChanges={[change]}
        viewerPanelWidth={null}
        viewerPanelRef={createRef<HTMLDivElement>()}
        onClose={vi.fn()}
        isDraggingAny={false}
        showChangeSidebar={true}
        onToggleChangeSidebar={vi.fn()}
        changesSidebarWidth={320}
        handleChangesSidebarDragStart={vi.fn()}
        handleViewerDragStart={vi.fn()}
      />,
    );

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "courselens-preview-change-click", changeId: "change-1" },
        }),
      );
    });

    expect(onPreviewChangeClick).not.toHaveBeenCalled();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    expect(screen.getByText("Clarify notebook submission.")).toBeInTheDocument();
  });
});
