import { describe, expect, it } from "vitest";
import { parseLLMOutput } from "../utils/changeParser";
import { injectHighlights } from "../utils/highlightInjection";
import { getStableChangeId } from "../utils/changeIdentity";
import type { CourseChange } from "../types/changes";

describe("parseLLMOutput", () => {
  it("parses courselens-preview-changes/v1 JSON manifests", () => {
    const manifest = {
      version: "courselens-preview-changes/v1",
      changes: [
        {
          file: "lectures/lec06/lec06.ipynb",
          action: "replace",
          summary: "Rename the section title to match the new terminology.",
          target: {
            text: "Old section title",
            before: "## ",
            after: "\n\nThis lecture",
          },
          new_text: "New section title",
        },
      ],
    };

    const parsed = parseLLMOutput(JSON.stringify(manifest));

    expect(parsed.totalFilesTouched).toBe(1);
    expect(parsed.changes).toHaveLength(1);
    expect(parsed.changes[0]).toMatchObject({
      file: "lec06.ipynb",
      filePath: "lectures/lec06/lec06.ipynb",
      fileType: "lecture",
      changeType: "reword",
      action: "replace",
      summary: "Rename the section title to match the new terminology.",
      originalSnippet: "Old section title",
      proposedSnippet: "New section title",
      target: {
        text: "Old section title",
        before: "## ",
        after: "\n\nThis lecture",
      },
      newText: "New section title",
    });
  });

  it("keeps parsing legacy markdown-link suggestions", () => {
    const parsed = parseLLMOutput(
      '[lec06.ipynb](lectures/lec06/lec06.ipynb:42): rename "Old title" to "New title" in Introduction.'
    );

    expect(parsed.totalFilesTouched).toBe(1);
    expect(parsed.changes[0]).toMatchObject({
      file: "lec06.ipynb",
      changeType: "rename",
      location: {
        lineNumber: 42,
      },
    });
  });

  it("injects stable change ids on preview highlights", () => {
    const doc = new DOMParser().parseFromString(
      "<main><p>Run the notebook before submitting.</p></main>",
      "text/html"
    );
    const change = {
      id: "",
      file: "hw1.html",
      fileType: "homework",
      week: null,
      lectureNumber: null,
      changeType: "clarify",
      priority: "primary",
      summary: "Clarify notebook submission.",
      location: { lineNumber: null, sectionLabel: null },
      originalSnippet: "Run the notebook",
      proposedSnippet: "Run all tests",
      action: "replace",
      target: { text: "Run the notebook", before: null, after: "before submitting" },
      newText: "Run all tests",
    } as CourseChange;

    injectHighlights(doc, [change]);

    const highlight = doc.querySelector<HTMLElement>(".cl-hl");
    expect(highlight?.dataset.changeId).toBe(getStableChangeId(change));
  });
});

describe("injectHighlights", () => {
  it("uses target before/after context to disambiguate repeated text", () => {
    const doc = new DOMParser().parseFromString(
      "<main><p>First unit: Rename me today.</p><p>Second unit: Rename me today.</p></main>",
      "text/html"
    );
    const change = {
      id: "c1",
      file: "lec06.html",
      fileType: "lecture",
      week: null,
      lectureNumber: 6,
      changeType: "reword",
      priority: "primary",
      summary: "Replace the repeated phrase in the second unit.",
      location: { lineNumber: null, sectionLabel: null },
      originalSnippet: "Rename me",
      proposedSnippet: "Rename you",
      action: "replace",
      target: {
        text: "Rename me",
        before: "Second unit: ",
        after: " today.",
      },
      newText: "Rename you",
    } as CourseChange;

    const first = injectHighlights(doc, [change]);

    expect(first).not.toBeNull();
    expect(first?.tagName).toBe("P");
    expect(first?.textContent).toContain("Second unit");
    expect(first?.querySelector(".cl-hl")?.textContent).toBe("Rename me");
  });

  it("highlights the containing change location, not just the matched keyword", () => {
    const doc = new DOMParser().parseFromString(
      "<main><p>Students should run all notebook checks before submitting.</p></main>",
      "text/html"
    );
    const change = {
      id: "c2",
      file: "hw1.html",
      fileType: "homework",
      week: null,
      lectureNumber: null,
      changeType: "clarify",
      priority: "primary",
      summary: "Clarify the checks instruction.",
      location: { lineNumber: null, sectionLabel: null },
      originalSnippet: "checks",
      proposedSnippet: "tests",
      action: "replace",
      target: { text: "checks", before: "run all notebook ", after: " before submitting" },
      newText: "tests",
    } as CourseChange;

    const first = injectHighlights(doc, [change]);

    expect(first?.tagName).toBe("P");
    expect(first?.classList.contains("cl-section-hl")).toBe(true);
    expect(first?.textContent).toContain("Students should run all notebook checks before submitting.");
    expect(first?.querySelector(".cl-hl")?.textContent).toBe("checks");
  });

  it("locates changes whose target text is copied from rendered HTML markup", () => {
    const doc = new DOMParser().parseFromString(
      `<main>
        <div class="highlight hl-ipython3"><pre><span></span><span class="n">states</span><span class="o">.</span><span class="n">groupby</span><span class="p">(</span><span class="s1">&#39;Region&#39;</span><span class="p">)</span><span class="o">.</span><span class="n">sum</span><span class="p">()</span></pre></div>
      </main>`,
      "text/html"
    );
    const change = {
      id: "c3",
      file: "lec05.html",
      fileType: "lecture",
      week: null,
      lectureNumber: 5,
      changeType: "reword",
      priority: "primary",
      summary: "Reword the groupby example.",
      location: { lineNumber: null, sectionLabel: null },
      originalSnippet: null,
      proposedSnippet: null,
      action: "replace",
      target: {
        text: `<div class=" highlight hl-ipython3"><pre><span></span><span class="n">states</span><span class="o">.</span><span class="n">groupby</span><span class="p">(</span><span class="s1">&#39;Region&#39;</span><span class="p">)</span><span class="o">.</span><span class="n">sum</span><span class="p">()</span></pre></div>`,
        before: "jupyter\">\n",
        after: "\n</pre></div>",
      },
      newText: "states.groupby('Region').mean()",
    } as CourseChange;

    const first = injectHighlights(doc, [change]);

    expect(first?.tagName).toBe("PRE");
    expect(first?.classList.contains("cl-section-hl")).toBe(true);
    expect(first?.textContent).toContain("states.groupby('Region').sum()");
    expect(first?.querySelector<HTMLElement>(".cl-hl")?.dataset.changeId).toBe(getStableChangeId(change));
  });

  it("opens closed preview dropdowns before locating hidden details content", () => {
    const doc = new DOMParser().parseFromString(
      `<main>
        <details>
          <summary>Click here to see the answer.</summary>
          <pre>hidden_answer = imdb.groupby('Year').mean()</pre>
        </details>
      </main>`,
      "text/html"
    );
    const dropdown = doc.querySelector("details");
    const change = {
      id: "c4",
      file: "lec05.html",
      fileType: "lecture",
      week: null,
      lectureNumber: 5,
      changeType: "clarify",
      priority: "primary",
      summary: "Clarify the hidden answer.",
      location: { lineNumber: null, sectionLabel: null },
      originalSnippet: "hidden_answer = imdb.groupby('Year').mean()",
      proposedSnippet: "visible_answer = imdb.groupby('Year').mean()",
      action: "replace",
      target: {
        text: "hidden_answer = imdb.groupby('Year').mean()",
        before: null,
        after: null,
      },
      newText: "visible_answer = imdb.groupby('Year').mean()",
    } as CourseChange;

    expect(dropdown?.open).toBe(false);

    const first = injectHighlights(doc, [change]);

    expect(dropdown?.open).toBe(true);
    expect(first?.tagName).toBe("PRE");
    expect(first?.textContent).toContain("hidden_answer = imdb.groupby('Year').mean()");
  });

  it("does not leave repeated change-type badge text when section highlights are reapplied", () => {
    const doc = new DOMParser().parseFromString(
      "<main><h2>Regression models</h2><p>Fit the model and inspect residuals.</p></main>",
      "text/html"
    );
    const change = {
      id: "c3",
      file: "lec07.html",
      fileType: "lecture",
      week: null,
      lectureNumber: 7,
      changeType: "reword",
      priority: "primary",
      summary: "Reword the Regression models section.",
      location: { lineNumber: null, sectionLabel: "Regression models" },
      originalSnippet: null,
      proposedSnippet: null,
    } as CourseChange;

    injectHighlights(doc, [change]);
    injectHighlights(doc, [change]);
    injectHighlights(doc, [change]);

    const paragraph = doc.querySelector("p");
    const staleBadgeTextNodes = Array.from(paragraph?.childNodes ?? []).filter(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.includes("reword")
    );

    expect(staleBadgeTextNodes).toHaveLength(0);
    expect(paragraph?.querySelectorAll(".cl-hl")).toHaveLength(1);
  });
});

describe("parseLLMOutput — manifests as instructors paste them", () => {
  const change = {
    file: "lectures/lec05/lec05.ipynb",
    action: "replace",
    summary: "Select columns before grouping.",
    target: { text: "df.groupby('a').mean()", before: null, after: null },
    new_text: "df.get(['a', 'b']).groupby('a').mean()",
  };

  it("accepts manifests generated before the format was renamed", () => {
    // Older prompts produced the same v1 format under a different name.
    const parsed = parseLLMOutput(JSON.stringify({ version: "oldname-preview-changes/v1", changes: [change] }));

    expect(parsed.changes).toHaveLength(1);
    expect(parsed.changes[0]).toMatchObject({ filePath: "lectures/lec05/lec05.ipynb", action: "replace" });
  });

  it("accepts a manifest wrapped in a code fence or surrounded by prose", () => {
    const manifest = JSON.stringify({ version: "courselens-preview-changes/v1", changes: [change] }, null, 2);
    const pasted = `Here are the proposed changes:\n\n\`\`\`json\n${manifest}\n\`\`\`\n`;

    const parsed = parseLLMOutput(pasted);

    expect(parsed.changes).toHaveLength(1);
    expect(parsed.changes[0].summary).toBe("Select columns before grouping.");
  });

  it("does not turn a JSON manifest's lines into changes when the version is not recognized", () => {
    const parsed = parseLLMOutput(JSON.stringify({ version: "something-else/v2", changes: [change] }, null, 2));

    expect(parsed.changes).toHaveLength(0);
  });
});
