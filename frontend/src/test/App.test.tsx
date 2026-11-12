import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../App";

describe("App", () => {
  beforeEach(() => {
    // The app syncs the course folder on load; no backend runs in tests.
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens straight into Course Review", async () => {
    render(<App />);

    expect(screen.getByText("CourseLens")).toBeInTheDocument();
    expect(screen.getByText("Course Review")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review changes" })).toBeInTheDocument();
    expect(await screen.findByText(/Couldn't reach the CourseLens backend/)).toBeInTheDocument();
  });

  it("has no knowledge-graph controls", () => {
    render(<App />);

    // The knowledge-graph toolbar had an "Upload" button (Course Review only has "Upload .jsonl").
    expect(screen.queryByRole("button", { name: "Upload" })).not.toBeInTheDocument();
    expect(screen.queryByText(/more views/i)).not.toBeInTheDocument();
  });
});
