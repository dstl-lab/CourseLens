import { describe, expect, it } from "vitest";
import type { CourseChange } from "../types/changes";
import type { CourseArtifact } from "../utils/courseArtifacts";
import {
  dedupeChangesForArtifacts,
  getStableChangeId,
} from "../utils/changeIdentity";

function change(overrides: Partial<CourseChange>): CourseChange {
  return {
    id: "",
    file: "hw1.ipynb",
    filePath: "course-private/homeworks/hw1/src/hw1.ipynb",
    fileType: "homework",
    week: null,
    lectureNumber: null,
    changeType: "clarify",
    priority: "primary",
    summary: "Clarify test instructions.",
    originalSnippet: "Run the notebook.",
    proposedSnippet: "Run all tests before submitting.",
    location: { sectionLabel: "Submission", lineNumber: 12 },
    ...overrides,
  };
}

const hw1Artifact = {
  id: "homeworks/hw1",
  displayName: "hw1",
  primaryPath: "course-public/homeworks/hw1/hw1.ipynb",
  previewPath: "course-public/homeworks/hw1/hw1.html",
  repo: "course-public",
  fileType: "homework",
  variants: [
    {
      filename: "hw1.ipynb",
      path: "course-private/homeworks/hw1/src/hw1.ipynb",
      extension: ".ipynb",
      fileType: "homework",
      repo: "course-private",
    },
    {
      filename: "hw1.html",
      path: "course-public/homeworks/hw1/hw1.html",
      extension: ".html",
      fileType: "homework",
      repo: "course-public",
    },
  ],
} satisfies CourseArtifact;

describe("changeIdentity", () => {
  it("gives duplicate ipynb/html changes in the same artifact the same stable id", () => {
    const notebookChange = change({});
    const htmlChange = change({
      file: "hw1.html",
      filePath: "course-public/homeworks/hw1/hw1.html",
    });

    expect(getStableChangeId(notebookChange, [hw1Artifact])).toBe(
      getStableChangeId(htmlChange, [hw1Artifact]),
    );
  });

  it("dedupes equivalent changes within the same canonical file", () => {
    const deduped = dedupeChangesForArtifacts(
      [
        change({ file: "hw1.ipynb" }),
        change({
          file: "hw1.html",
          filePath: "course-public/homeworks/hw1/hw1.html",
        }),
      ],
      [hw1Artifact],
    );

    expect(deduped).toHaveLength(1);
    expect(deduped[0].file).toBe("hw1.ipynb");
  });

  it("does not dedupe distinct proposed edits in the same file", () => {
    const deduped = dedupeChangesForArtifacts(
      [
        change({ proposedSnippet: "Run all tests before submitting." }),
        change({ proposedSnippet: "Restart the kernel before submitting." }),
      ],
      [hw1Artifact],
    );

    expect(deduped).toHaveLength(2);
  });

  it("keeps the richer duplicate when fields differ", () => {
    const sparse = change({
      target: undefined,
      originalSnippet: null,
      proposedSnippet: null,
      summary: "Clarify tests.",
    });
    const rich = change({
      target: {
        text: "Run the notebook.",
        before: "Before submitting",
        after: "Save your work",
      },
      summary: "Clarify that students should run all tests before submitting.",
    });

    const deduped = dedupeChangesForArtifacts([sparse, rich], [hw1Artifact]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].target?.text).toBe("Run the notebook.");
    expect(deduped[0].summary).toContain("all tests");
  });
});
