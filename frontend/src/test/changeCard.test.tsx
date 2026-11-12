import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ChangeCard from "../components/changeVisualization/ChangeCard";
import type { CourseChange } from "../types/changes";

const change: CourseChange = {
  id: "change-1",
  file: "lec01.ipynb",
  fileType: "lecture",
  week: null,
  lectureNumber: 1,
  changeType: "clarify",
  priority: "primary",
  summary: "Clarify the lecture goal.",
  location: { sectionLabel: "Intro", lineNumber: 3 },
  originalSnippet: "Old goal",
  proposedSnippet: "Clear goal",
};

describe("ChangeCard", () => {
  it("uses professor-facing review status labels", () => {
    render(
      <ChangeCard
        change={change}
        fileContent={null}
        reviewStatus={null}
        onReviewStatusChange={vi.fn()}
        changeId="change-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /clarify/i }));

    expect(screen.getByText("Review status")).toBeInTheDocument();
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Not reviewed",
      "Needs review",
      "Approved",
      "Removed",
    ]);
    expect(screen.queryByText("Select status...")).not.toBeInTheDocument();
  });

  it("labels a chosen status with the same name as the dropdown", () => {
    render(
      <ChangeCard
        change={change}
        fileContent={null}
        reviewStatus="modified"
        onReviewStatusChange={vi.fn()}
        changeId="change-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /clarify/i }));

    expect(screen.getAllByText("Needs review")).toHaveLength(2);
  });
});
