/// <reference types="node" />

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseToolCallJsonl } from "../utils/toolCallParser";

const jsonl = (events: unknown[]) => events.map((event) => JSON.stringify(event)).join("\n");

const manifest = {
  version: "courselens-preview-changes/v1",
  changes: [
    {
      file: "homeworks/hw1/src/hw1.ipynb",
      action: "replace",
      summary: "Select columns before grouping.",
      target: { text: "df.groupby('a').mean()", before: null, after: null },
      new_text: "df.get(['a', 'b']).groupby('a').mean()",
    },
    {
      file: "lectures/lec05/lec05.ipynb",
      action: "highlight",
      summary: "Check the groupby explanation.",
      target: { text: "groupby", before: null, after: null },
      new_text: null,
    },
  ],
};

const paths = (entries: { path: string }[]) => entries.map((entry) => entry.path);

describe("parseToolCallJsonl — Codex CLI rollouts", () => {
  it("marks files named in a generated CourseLens manifest as suggested changes", () => {
    const result = parseToolCallJsonl(
      jsonl([
        { type: "turn_context", payload: { cwd: "/course" } },
        {
          type: "response_item",
          payload: {
            type: "function_call",
            name: "exec_command",
            call_id: "c1",
            arguments: JSON.stringify({ cmd: "sed -n '1,80p' homeworks/hw1/src/hw1.ipynb", workdir: "/course" }),
          },
        },
        {
          type: "response_item",
          payload: {
            type: "function_call",
            name: "exec_command",
            call_id: "c2",
            arguments: JSON.stringify({ cmd: "cat changes.json", workdir: "/course" }),
          },
        },
        { type: "response_item", payload: { type: "function_call_output", call_id: "c2", output: JSON.stringify(manifest) } },
      ]),
    );

    expect(result.parseErrors).toBe(0);
    expect(paths(result.readAndChanged)).toEqual([
      "/course/homeworks/hw1/src/hw1.ipynb",
      "/course/lectures/lec05/lec05.ipynb",
    ]);
    // A file that was both read and changed is only listed as changed.
    expect(paths(result.readOnly)).not.toContain("/course/homeworks/hw1/src/hw1.ipynb");
    expect(paths(result.readOnly)).toContain("/course/changes.json");
  });

  it("treats apply_patch edits as changes, including patches sent through the shell", () => {
    const patch = [
      "*** Begin Patch",
      "*** Update File: labs/lab2/lab2.ipynb",
      "@@",
      "-old",
      "+new",
      "*** Add File: notes/new.md",
      "+hello",
      "*** End Patch",
    ].join("\n");

    const result = parseToolCallJsonl(
      jsonl([
        { type: "turn_context", payload: { cwd: "/course" } },
        { type: "response_item", payload: { type: "custom_tool_call", name: "apply_patch", call_id: "p1", input: patch } },
        {
          type: "response_item",
          payload: {
            type: "function_call",
            name: "shell",
            call_id: "p2",
            arguments: JSON.stringify({
              command: ["bash", "-lc", `apply_patch <<'EOF'\n*** Begin Patch\n*** Update File: exams/midterm.tex\n@@\n-x\n+y\n*** End Patch\nEOF`],
              workdir: "/course",
            }),
          },
        },
      ]),
    );

    expect(paths(result.readAndChanged)).toEqual([
      "/course/labs/lab2/lab2.ipynb",
      "/course/exams/midterm.tex",
      "/course/notes/new.md",
    ].sort((a, b) => a.split("/").pop()!.localeCompare(b.split("/").pop()!)));
    expect(paths(result.readOnly)).toEqual([]);
  });
});

describe("parseToolCallJsonl — Claude Code session logs", () => {
  const assistant = (cwd: string, ...content: unknown[]) => ({
    type: "assistant",
    cwd,
    message: { role: "assistant", content },
  });
  const toolUse = (id: string, name: string, input: unknown) => ({ type: "tool_use", id, name, input });

  it("classifies reads, edits, notebook edits and shell commands", () => {
    const result = parseToolCallJsonl(
      jsonl([
        { type: "user", cwd: "/course", message: { role: "user", content: "Update groupby usage" } },
        assistant("/course", toolUse("t1", "Read", { file_path: "/course/lectures/lec05/lec05.ipynb" })),
        assistant("/course", toolUse("t2", "Edit", { file_path: "/course/homeworks/hw1/hw1.ipynb", old_string: "a", new_string: "b" })),
        assistant("/course", toolUse("t3", "NotebookEdit", { notebook_path: "labs/lab3/lab3.ipynb", new_source: "x" })),
        assistant("/course", toolUse("t4", "Bash", { command: "grep -n groupby quizzes/quiz2.md" })),
        assistant("/course", toolUse("t5", "Grep", { pattern: "groupby", path: "/course/lectures" })),
        assistant("/course", toolUse("t6", "Grep", { pattern: "groupby", path: "exams/final.tex" })),
        assistant("/course", toolUse("t7", "Glob", { pattern: "**/*.ipynb" })),
      ]),
    );

    expect(paths(result.readAndChanged)).toEqual([
      "/course/homeworks/hw1/hw1.ipynb",
      "/course/labs/lab3/lab3.ipynb",
    ]);
    expect(paths(result.readOnly)).toEqual([
      "/course/exams/final.tex",
      "/course/lectures/lec05/lec05.ipynb",
      "/course/quizzes/quiz2.md",
    ]);
  });

  it("reads manifests from tool results and from the agent's final answer", () => {
    const result = parseToolCallJsonl(
      jsonl([
        assistant("/course", toolUse("t1", "Bash", { command: "cat suggestions.json" })),
        {
          type: "user",
          cwd: "/course",
          message: {
            role: "user",
            content: [{ type: "tool_result", tool_use_id: "t1", content: [{ type: "text", text: JSON.stringify(manifest) }] }],
          },
        },
        assistant("/course", {
          type: "text",
          text: JSON.stringify({ ...manifest, changes: [{ ...manifest.changes[0], file: "projects/p1/p1.ipynb" }] }),
        }),
      ]),
    );

    expect(paths(result.readAndChanged)).toEqual([
      "/course/homeworks/hw1/src/hw1.ipynb",
      "/course/lectures/lec05/lec05.ipynb",
      "/course/projects/p1/p1.ipynb",
    ]);
  });

  it("ignores session metadata lines and counts malformed lines", () => {
    const content = [
      JSON.stringify({ type: "summary", summary: "Session" }),
      JSON.stringify({ type: "file-history-snapshot", snapshot: {} }),
      "{ not json",
      JSON.stringify(assistant("/course", toolUse("t1", "Read", { file_path: "syllabus.md" }))),
    ].join("\n");

    const result = parseToolCallJsonl(content);

    expect(result.totalLines).toBe(4);
    expect(result.parseErrors).toBe(1);
    expect(paths(result.readOnly)).toEqual(["/course/syllabus.md"]);
  });
});

describe("parseToolCallJsonl — demo course activity log", () => {
  // examples/demo-course-agent-log.jsonl: the made-up Claude Code session the
  // README's "Try the demo" section uploads.
  const content = readFileSync(resolve(process.cwd(), "../examples/demo-course-agent-log.jsonl"), "utf8");

  it("yields the demo's file review analysis", () => {
    const result = parseToolCallJsonl(content);

    expect(result.parseErrors).toBe(0);
    expect(paths(result.readAndChanged).sort()).toEqual([
      "/home/instructor/demo-course/assignments/a1/a1.ipynb",
      "/home/instructor/demo-course/exams/midterm/midterm.tex",
      "/home/instructor/demo-course/slides/Lecture 02.ipynb",
    ]);
    expect(paths(result.readOnly)).toEqual(["/home/instructor/demo-course/slides/Lecture 01.ipynb"]);
  });

  it("never marks studio03 as checked, so the demo can show a missed file", () => {
    const result = parseToolCallJsonl(content);
    const seen = [...paths(result.readAndChanged), ...paths(result.readOnly)];

    expect(seen.some((path) => path.includes("studio03"))).toBe(false);
  });
});

describe("parseToolCallJsonl — manifests generated before the format was renamed", () => {
  it("still marks their files as suggested changes", () => {
    const result = parseToolCallJsonl(
      jsonl([
        { type: "turn_context", payload: { cwd: "/course" } },
        {
          type: "response_item",
          payload: {
            type: "function_call",
            name: "exec_command",
            call_id: "c1",
            arguments: JSON.stringify({ cmd: "cat changes.json", workdir: "/course" }),
          },
        },
        {
          type: "response_item",
          payload: {
            type: "function_call_output",
            call_id: "c1",
            output: JSON.stringify({ ...manifest, version: "oldname-preview-changes/v1" }),
          },
        },
      ]),
    );

    expect(paths(result.readAndChanged)).toEqual([
      "/course/homeworks/hw1/src/hw1.ipynb",
      "/course/lectures/lec05/lec05.ipynb",
    ]);
  });
});
