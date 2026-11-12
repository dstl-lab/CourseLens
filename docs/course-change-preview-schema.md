# Course Change Preview Schema

CourseLens accepts a structured JSON manifest for professor-facing course refactoring previews.
The manifest is designed for deterministic overlay rendering, not for applying edits directly.

## Top-Level Shape

```json
{
  "version": "courselens-preview-changes/v1",
  "changes": []
}
```

## Change Item

```json
{
  "file": "lectures/lec06/lec06.ipynb",
  "action": "replace",
  "summary": "Rename the section title to match the new course terminology.",
  "target": {
    "text": "Old section title",
    "before": "Text immediately before the target",
    "after": "Text immediately after the target"
  },
  "new_text": "New section title"
}
```

## Fields

| Field | Required | Description |
|-------|----------|-------------|
| `file` | Yes | Relative path to the course file. Use the most specific path available. |
| `action` | Yes | One of `replace`, `insert_after`, `insert_before`, `delete`, or `highlight`. |
| `summary` | Yes | One short sentence shown in the review sidebar. |
| `target.text` | Yes | Exact text copied from the current file. Used as the primary preview anchor. |
| `target.before` | Yes | Exact nearby text before `target.text`, or `null`. Used to disambiguate repeated text. |
| `target.after` | Yes | Exact nearby text after `target.text`, or `null`. Used to disambiguate repeated text. |
| `new_text` | Yes | Replacement or inserted text for `replace` and insert actions; `null` for `delete` and `highlight`. |

## Matching Behavior

The frontend parses `courselens-preview-changes/v1` JSON before falling back to the legacy markdown/table parser.
Manifests made with older prompts, which named the same v1 format differently (`<name>-preview-changes/v1`), are
also accepted. A manifest wrapped in a ```` ```json ```` fence or surrounded by a sentence of prose is still read. Pasted
JSON with any other `version` produces no changes instead of being read line by line.
For previews, it first searches for `target.text`. If the text appears more than once, `target.before`
and `target.after` are used to choose the best occurrence. If no target can be found, the change still
appears in the sidebar but no inline highlight is created.

## Legacy Compatibility

The previous markdown-link and path/table parsers remain supported. This schema is the preferred format
for reliable professor-facing overlays.
