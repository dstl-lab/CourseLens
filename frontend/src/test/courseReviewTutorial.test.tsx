import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ChangeVisualizationPanel from "../components/ChangeVisualizationPanel";
import { useCourseStore } from "../store/courseStore";

describe("Course Review tutorial", () => {
  beforeEach(() => {
    useCourseStore.setState({
      repoFiles: [],
      isSyncing: false,
      syncRepoFiles: vi.fn(),
    });
  });

  it("opens a compact tutorial from the help button", () => {
    render(
      <ChangeVisualizationPanel
        rawText=""
        onRawTextChange={vi.fn()}
        parsedData={null}
        onParsedDataChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /course review help/i }));

    expect(screen.getByText("Review changes:")).toBeInTheDocument();
    expect(screen.getByText("File review analysis:")).toBeInTheDocument();
    expect(screen.getByText("Timeline:")).toBeInTheDocument();
    expect(screen.queryByText(/core concepts/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/more views/i)).not.toBeInTheDocument();
  });

  it("uses professor-facing Course Review labels in the sidebar", () => {
    render(
      <ChangeVisualizationPanel
        rawText="suggestions"
        onRawTextChange={vi.fn()}
        parsedData={null}
        onParsedDataChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/paste generated suggestions/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /review changes/i })).toBeInTheDocument();
    expect(screen.getByText(/file review analysis/i)).toBeInTheDocument();
    expect(screen.queryByText(/paste codex \/ llm suggestions/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/overlay changes/i)).not.toBeInTheDocument();
  });

  it("can collapse and restore the generated suggestions and file review analysis panel without a header show/hide button", () => {
    render(
      <ChangeVisualizationPanel
        rawText="suggestions"
        onRawTextChange={vi.fn()}
        parsedData={null}
        onParsedDataChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /hide review input panel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /show review input panel/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /collapse review input panel/i }));

    expect(screen.queryByText(/paste generated suggestions/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/file review analysis/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /expand review input panel/i }));

    expect(screen.getByText(/paste generated suggestions/i)).toBeInTheDocument();
    expect(screen.getByText(/file review analysis/i)).toBeInTheDocument();
  });

  it("uses the shared dark-mode scrollbar treatment for Course Review scrolling regions", () => {
    const { container } = render(
      <ChangeVisualizationPanel
        rawText="suggestions"
        onRawTextChange={vi.fn()}
        parsedData={null}
        onParsedDataChange={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText(/paste generated suggestions/i)).toHaveClass("cl-scrollbar");
    expect(container.querySelector(".cl-review-overview-scroll")).toHaveClass("cl-scrollbar");
  });

  it("shows suggested-change files from tool-call manifests even when repo files are not synced", async () => {
    const manifestToolCalls = [
      {
        type: "response_item",
        payload: {
          type: "function_call",
          name: "exec_command",
          call_id: "call_manifest",
          arguments: JSON.stringify({
            cmd: "cat groupby_courselens_preview_changes.md",
            workdir: "/course",
          }),
        },
      },
      {
        type: "response_item",
        payload: {
          type: "function_call_output",
          call_id: "call_manifest",
          output: [
            "Output:",
            JSON.stringify({
              version: "courselens-preview-changes/v1",
              changes: [
                {
                  file: "lectures/lec05/lec05.ipynb",
                  action: "replace",
                  summary: "Update groupby example.",
                  target: { text: "old", before: null, after: null },
                  new_text: "new",
                },
              ],
            }),
          ].join("\n"),
        },
      },
    ].map((event) => JSON.stringify(event)).join("\n");

    const { container } = render(
      <ChangeVisualizationPanel
        rawText=""
        onRawTextChange={vi.fn()}
        parsedData={null}
        onParsedDataChange={vi.fn()}
      />,
    );

    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();

    fireEvent.change(fileInput!, {
      target: {
        files: [
          new File([manifestToolCalls], "tool-calls.jsonl", { type: "application/jsonl" }),
        ],
      },
    });

    await waitFor(() => {
      expect(screen.getByTitle("/course/lectures/lec05/lec05.ipynb")).toBeInTheDocument();
    });
  });

  it("counts not checked files from grouped synced course artifacts", async () => {
    useCourseStore.setState({
      repoFiles: [
        {
          filename: "lec01.ipynb",
          path: "course-private/lectures/lec01/lec01.ipynb",
          repo: "course-private",
          stem: "lec01",
          fileType: "lecture",
          content: "{}",
          previewPath: "course-private/lectures/lec01/lec01.html",
        },
        {
          filename: "lec01.html",
          path: "course-private/lectures/lec01/lec01.html",
          repo: "course-private",
          stem: "lec01",
          fileType: "lecture",
          content: "<h1>Lecture 1</h1>",
        },
        {
          filename: "lec02.ipynb",
          path: "course-private/lectures/lec02/lec02.ipynb",
          repo: "course-private",
          stem: "lec02",
          fileType: "lecture",
          content: "{}",
          previewPath: "course-private/lectures/lec02/lec02.html",
        },
        {
          filename: "lec02.html",
          path: "course-private/lectures/lec02/lec02.html",
          repo: "course-private",
          stem: "lec02",
          fileType: "lecture",
          content: "<h1>Lecture 2</h1>",
        },
        {
          filename: "hw1.ipynb",
          path: "course-private/homeworks/hw1/src/hw1.ipynb",
          repo: "course-private",
          stem: "hw1",
          fileType: "homework",
          content: "{}",
          previewPath: "course-private/homeworks/hw1/src/hw1.html",
        },
        {
          filename: "hw1.html",
          path: "course-private/homeworks/hw1/src/hw1.html",
          repo: "course-private",
          stem: "hw1",
          fileType: "homework",
          content: "<h1>Homework 1</h1>",
        },
      ],
    });

    const toolCalls = [
      {
        type: "response_item",
        payload: {
          type: "function_call",
          name: "exec_command",
          call_id: "call_manifest",
          arguments: JSON.stringify({
            cmd: "cat groupby_courselens_preview_changes.md",
            workdir: "/course/course-private",
          }),
        },
      },
      {
        type: "response_item",
        payload: {
          type: "function_call_output",
          call_id: "call_manifest",
          output: JSON.stringify({
            version: "courselens-preview-changes/v1",
            changes: [
              {
                file: "lectures/lec01/lec01.ipynb",
                action: "replace",
                summary: "Update lecture 1.",
                target: { text: "old", before: null, after: null },
                new_text: "new",
              },
            ],
          }),
        },
      },
      {
        type: "response_item",
        payload: {
          type: "function_call",
          name: "read_file",
          arguments: JSON.stringify({
            path: "lectures/lec02/lec02.ipynb",
            workdir: "/course/course-private",
          }),
        },
      },
    ].map((event) => JSON.stringify(event)).join("\n");

    const { container } = render(
      <ChangeVisualizationPanel
        rawText=""
        onRawTextChange={vi.fn()}
        parsedData={null}
        onParsedDataChange={vi.fn()}
      />,
    );

    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(fileInput!, {
      target: {
        files: [
          new File([toolCalls], "tool-calls.jsonl", { type: "application/jsonl" }),
        ],
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/3 files/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Suggested changes/i })).toHaveTextContent("1");
      expect(screen.getByRole("button", { name: /Checked, no changes/i })).toHaveTextContent("1");
      expect(screen.getByRole("button", { name: /Not checked/i })).toHaveTextContent("1");
    });
  });
});
