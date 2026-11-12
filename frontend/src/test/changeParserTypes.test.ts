import { describe, expect, it } from "vitest";
import { parseLLMOutput } from "../utils/changeParser";

function manifestFor(files: string[]): string {
  return JSON.stringify({
    version: "courselens-preview-changes/v1",
    changes: files.map((file) => ({
      file,
      action: "highlight",
      summary: "Check this file.",
      target: { text: "x", before: null, after: null },
      new_text: null,
    })),
  });
}

describe("parseLLMOutput file types", () => {
  it("infers item types from common folder and file names in any course layout", () => {
    const files = [
      "assignments/a1/a1.ipynb",
      "problem-sets/ps3.tex",
      "slides/Lecture 02.pdf",
      "exams/midterm/midterm.tex",
      "projects/final_project/final_project.ipynb",
      "lectures/projection.ipynb",
      "labs/lab1/tests/q1.py",
      "discussion/disc01/disc01.ipynb",
      "syllabus.md",
      "misc/scratch.md",
    ];

    const types = parseLLMOutput(manifestFor(files)).changes.map((c) => [c.filePath, c.fileType]);

    expect(Object.fromEntries(types)).toEqual({
      "assignments/a1/a1.ipynb": "homework",
      "problem-sets/ps3.tex": "homework",
      "slides/Lecture 02.pdf": "lecture",
      "exams/midterm/midterm.tex": "exam",
      "projects/final_project/final_project.ipynb": "project",
      "lectures/projection.ipynb": "lecture",
      "labs/lab1/tests/q1.py": "lab",
      "discussion/disc01/disc01.ipynb": "discussion",
      "syllabus.md": "schedule",
      "misc/scratch.md": "other",
    });
  });

  it("finds file paths in plain-text suggestions for any folder names", () => {
    const text = [
      "| File | Count | Notes |",
      "| assignments/a2/a2.ipynb | 3 | Update groupby calls |",
      "See https://example.com/docs/page.html for background.",
      "Also check studios/studio04/studio04.ipynb.",
    ].join("\n");

    const files = parseLLMOutput(text).changes.map((c) => c.file);

    expect(files).toContain("a2.ipynb");
    expect(files).toContain("studio04.ipynb");
    expect(files).not.toContain("page.html");
  });
});
