import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import FileSection from "../components/changeVisualization/FileSection";

function renderSection() {
  render(
    <FileSection
      filename="lec01"
      fileType="lecture"
      changes={[]}
      fileContent={null}
      matchedFilename={null}
      blobUrl={null}
      reviewStatusMap={{}}
      onReviewStatusChange={vi.fn()}
      toolCallStatus={null}
    />,
  );
}

describe("FileSection", () => {
  it("allows files with no changes to collapse and expand", () => {
    renderSection();

    expect(screen.getByText("No proposed changes for this file.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /lec01/i }));
    expect(screen.queryByText("No proposed changes for this file.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /lec01/i }));
    expect(screen.getByText("No proposed changes for this file.")).toBeInTheDocument();
  });

  it("shows the kind of course item", () => {
    renderSection();

    expect(screen.getByText("lecture")).toBeInTheDocument();
  });
});
