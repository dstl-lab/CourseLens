import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ToolCallSection from "../components/changeVisualization/ToolCallSection";

describe("ToolCallSection", () => {
  it("lets a file be tagged from tool call analysis", () => {
    const onToggleFileTag = vi.fn();
    render(
      <ToolCallSection
        label="Suggested Changes"
        count={1}
        files={[
          {
            path: "repo/homeworks/hw1/hw1.ipynb",
            basename: "hw1.ipynb",
            classification: "read_and_changed",
          },
        ]}
        open
        onToggle={vi.fn()}
        color="green"
        taggedFiles={new Set()}
        onToggleFileTag={onToggleFileTag}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /tag file/i }));
    expect(onToggleFileTag).toHaveBeenCalledWith("repo/homeworks/hw1/hw1.ipynb");
  });
});
