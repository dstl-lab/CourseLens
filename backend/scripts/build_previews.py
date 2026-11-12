"""Pre-render notebook previews as .html files next to each notebook (optional).

Course Review renders notebooks on demand, so this step is not required. It
is useful for very large courses (rendering happens once instead of on first
view) or when you want the .html files for other purposes. Existing .html
files are never overwritten.

Usage (from the backend folder):
    uv run python -m scripts.build_previews            # uses COURSE_REVIEW_ROOT
    uv run python -m scripts.build_previews --root /path/to/course
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.course_config import (  # noqa: E402
    configured_course_root,
    discover_files,
    load_course_config,
)
from app.services.notebook_preview import (  # noqa: E402
    NotebookPreviewUnavailable,
    notebook_to_html,
)


def convert_notebooks_to_html(root: Path) -> int:
    config = load_course_config(root).config
    count = 0
    for found in discover_files(root, config):
        if found.extension != ".ipynb" or found.preview_path:
            continue
        notebook = root / found.path
        html_path = notebook.with_suffix(".html")
        print(f"Rendering {found.path} ...")
        try:
            html_path.write_text(notebook_to_html(notebook), encoding="utf-8")
            count += 1
        except NotebookPreviewUnavailable as exc:
            print(f"  skipped: {exc}")
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--root",
        type=Path,
        default=None,
        help="Course folder (default: COURSE_REVIEW_ROOT from the environment "
        "or backend/.env)",
    )
    args = parser.parse_args()

    root = args.root.expanduser().resolve() if args.root else configured_course_root()
    if root is None or not root.is_dir():
        raise SystemExit(
            "No course folder found. Pass --root /path/to/course or set "
            "COURSE_REVIEW_ROOT in backend/.env."
        )

    print(f"Scanning {root} for notebooks without an .html preview...")
    count = convert_notebooks_to_html(root)
    print(f"\nDone. Created {count} .html preview file(s).")


if __name__ == "__main__":
    main()
