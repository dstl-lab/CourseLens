import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SummaryPanel from "../components/changeVisualization/SummaryPanel";

describe("SummaryPanel", () => {
  it("lists tagged files under Tagged files", () => {
    render(
      <SummaryPanel
        summaryData={{ approved: [], removed: [], modified: [], pending: [] }}
        taggedFiles={new Set(["lec21.ipynb"])}
        onClose={vi.fn()}
        onChangeClick={vi.fn()}
        onFileClick={vi.fn()}
      />,
    );

    expect(screen.getByText("Tagged files")).toBeInTheDocument();
    expect(screen.queryByText(/Not in Codex/)).not.toBeInTheDocument();
  });
});
