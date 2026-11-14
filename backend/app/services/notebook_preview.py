"""Render Jupyter notebooks as HTML for the Course Review preview pane."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path


class NotebookPreviewUnavailable(RuntimeError):
    """Raised when nbconvert is missing or a notebook cannot be converted."""


def deep_scrub_notebook(raw_nb: dict) -> dict:
    """Fill in metadata that hand-edited or tool-generated notebooks often omit.

    nbformat validation rejects notebooks without cell metadata, execution
    counts on code cells/execute_result outputs, or with list-valued output
    data, so normalize those before conversion.
    """
    raw_nb.setdefault("metadata", {})
    raw_nb.setdefault("nbformat", 4)
    raw_nb.setdefault("nbformat_minor", 2)
    # Format 4.5+ requires a unique id on every cell; older tools omit them.
    needs_ids = raw_nb["nbformat"] == 4 and raw_nb["nbformat_minor"] >= 5

    for idx, cell in enumerate(raw_nb.get("cells", [])):
        cell.setdefault("metadata", {})
        if needs_ids and not cell.get("id"):
            cell["id"] = f"cell-{idx}"
        if cell.get("cell_type") == "code":
            cell.setdefault("execution_count", None)
        if isinstance(cell.get("source"), list):
            cell["source"] = "".join(cell["source"])

        for output in cell.get("outputs", []):
            output.setdefault("metadata", {})
            if output.get("output_type") == "execute_result":
                output.setdefault("execution_count", None)
            for key, val in output.get("data", {}).items():
                if isinstance(val, list):
                    output["data"][key] = "".join(val)
            if isinstance(output.get("text"), list):
                output["text"] = "".join(output["text"])

    return raw_nb


def notebook_to_html(notebook_path: Path) -> str:
    """Convert a notebook file to standalone HTML (output images are embedded)."""
    try:
        import nbformat
        from nbconvert import HTMLExporter
    except ImportError as exc:  # pragma: no cover - dependency is declared
        raise NotebookPreviewUnavailable(
            "Notebook previews need the 'nbformat' and 'nbconvert' packages. "
            "Run `uv sync` in the backend folder."
        ) from exc

    try:
        raw_nb = json.loads(notebook_path.read_text(encoding="utf-8"))
        notebook = nbformat.from_dict(deep_scrub_notebook(raw_nb))
        exporter = HTMLExporter()
        exporter.template_name = "classic"
        body, _ = exporter.from_notebook_node(notebook)
    except Exception as exc:
        raise NotebookPreviewUnavailable(
            f"Could not convert {notebook_path.name} to a preview: {exc}"
        ) from exc
    return body


# Modification time and size distinguish cached previews of the same path.
@lru_cache(maxsize=32)
def _cached_notebook_html(path: str, mtime_ns: int, size: int) -> str:
    return notebook_to_html(Path(path))


def cached_notebook_html(notebook_path: Path) -> str:
    """Convert once per file version; edits to the notebook invalidate the cache."""
    stat = notebook_path.stat()
    return _cached_notebook_html(str(notebook_path), stat.st_mtime_ns, stat.st_size)
