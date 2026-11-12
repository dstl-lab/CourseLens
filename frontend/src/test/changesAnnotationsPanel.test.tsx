import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ChangesAnnotationsPanel from "../components/changeVisualization/ChangesAnnotationsPanel";
import type { CourseChange } from "../types/changes";

const change = {
  id: "",
  file: "hw1.html",
  fileType: "homework",
  week: null,
  lectureNumber: null,
  changeType: "clarify",
  priority: "primary",
  summary: "Clarify tests.",
  originalSnippet: "Run notebook.",
  proposedSnippet: "Run all tests.",
  location: { sectionLabel: "Submission", lineNumber: 12 },
} as CourseChange;

describe("ChangesAnnotationsPanel", () => {
  it("updates review status from the preview panel", () => {
    const onReviewStatusChange = vi.fn();
    render(
      <ChangesAnnotationsPanel
        changes={[change]}
        reviewStatusMap={{}}
        onReviewStatusChange={onReviewStatusChange}
      />,
    );

    fireEvent.change(screen.getByLabelText(/review status/i), {
      target: { value: "approved" },
    });

    expect(onReviewStatusChange).toHaveBeenCalledWith(expect.any(String), "approved");
  });

  it("offers Needs review, Approved and Removed", () => {
    render(<ChangesAnnotationsPanel changes={[change]} onReviewStatusChange={vi.fn()} />);

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Not reviewed",
      "Needs review",
      "Approved",
      "Removed",
    ]);
  });

  it("shows old and new text without raw diff markers", () => {
    render(<ChangesAnnotationsPanel changes={[change]} />);

    expect(screen.getByText("Before")).toBeInTheDocument();
    expect(screen.getByText("After")).toBeInTheDocument();
    expect(screen.getByText("Run notebook.")).toBeInTheDocument();
    expect(screen.getByText("Run all tests.")).toBeInTheDocument();
    expect(screen.queryByText(/----/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\+\+\+\+/)).not.toBeInTheDocument();
  });
});
