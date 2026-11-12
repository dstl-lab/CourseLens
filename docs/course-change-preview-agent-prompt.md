# Course Change Preview Agent Prompt

Use this prompt section when asking an AI agent to generate CourseLens preview overlays for course refactoring work.

```text
Return valid JSON only. Do not include markdown, prose, tables, comments, or code fences.

Generate a CourseLens preview change manifest using this exact shape:

{
  "version": "courselens-preview-changes/v1",
  "changes": [
    {
      "file": "relative/path/to/file.ext",
      "action": "replace | insert_after | insert_before | delete | highlight",
      "summary": "One short sentence describing the change.",
      "target": {
        "text": "Exact text from the current file to locate the change.",
        "before": "Exact nearby text before target.text, or null.",
        "after": "Exact nearby text after target.text, or null."
      },
      "new_text": "New text for replace/insert actions, otherwise null."
    }
  ]
}

Rules:
1. Copy target.text exactly from the provided file content.
2. Include before and after context when available, especially if target.text may appear more than once.
3. For replace, target.text is the old text and new_text is the replacement.
4. For delete, target.text is the text to remove and new_text is null.
5. For insert_after or insert_before, target.text is the nearby existing text that anchors the insertion, and new_text is the text to insert.
6. For highlight, target.text is the text to tag for review and new_text is null.
7. If you cannot find exact target text in the provided content, do not guess; omit that change.
8. Keep summary short. It is shown in the CourseLens review sidebar.
9. Use the most specific relative file path available. Do not use only a basename unless no path is available.

Return valid JSON only.
```
