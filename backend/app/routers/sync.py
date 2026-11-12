"""Course Review (CourseLens) endpoints for the instructor's local course folder.

The course folder is set with COURSE_REVIEW_ROOT; an optional
``courselens.json`` inside it describes the schedule and folder layout (see
docs/courselens-config.md). These endpoints read the instructor's files, so
the backend must only listen on localhost.
"""

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, HTMLResponse

from app.models.course import CourseInfo, LocalFile
from app.services.course_config import (
    CourseConfig,
    configured_course_root,
    discover_files,
    load_course_config,
    max_week,
)
from app.services.notebook_preview import (
    NotebookPreviewUnavailable,
    cached_notebook_html,
)

router = APIRouter()


def discover_course_files(
    root: Path | None = None,
    config: CourseConfig | None = None,
) -> list[LocalFile]:
    course_root = root or configured_course_root()
    if course_root is None or not course_root.is_dir():
        return []
    if config is None:
        config = load_course_config(course_root).config

    return [
        LocalFile(
            filename=found.filename,
            fileType=found.file_type,
            path=found.path,
            repo=found.repo,
            stem=found.stem,
            previewPath=found.preview_path,
            artifactId=found.artifact_id,
            week=found.week,
            weekSource=found.week_source,
            preferRank=found.prefer_rank,
            size=found.size,
        )
        for found in discover_files(course_root, config)
    ]


def course_info(root: Path | None = None) -> CourseInfo:
    course_root = root or configured_course_root()
    if course_root is None:
        return CourseInfo(
            configured=False,
            rootExists=False,
            warnings=[
                "No course folder is set. Add COURSE_REVIEW_ROOT=/path/to/your/course "
                "to backend/.env and restart the backend."
            ],
        )
    if not course_root.is_dir():
        return CourseInfo(
            configured=True,
            rootExists=False,
            rootName=course_root.name,
            warnings=[f"The course folder {course_root} does not exist."],
        )

    loaded = load_course_config(course_root)
    config = loaded.config
    files = discover_files(course_root, config)
    unscheduled_items = {f.artifact_id for f in files if f.week is None}
    return CourseInfo(
        configured=True,
        rootExists=True,
        rootName=course_root.name,
        name=config.name,
        weeks=max_week(config, files),
        configFound=loaded.found,
        hasSchedule=bool(config.schedule),
        stablePreviewTypes=[t.lower() for t in config.stable_preview_types],
        fileCount=len(files),
        unscheduledCount=len(unscheduled_items),
        warnings=loaded.warnings,
    )


def resolve_course_path(rel_path: str, root: Path | None = None) -> Path:
    """Map a root-relative path to a file inside the course folder, safely."""
    course_root = root or configured_course_root()
    if course_root is None or not course_root.is_dir():
        raise HTTPException(status_code=404, detail="No course folder is configured.")

    parts = [p for p in rel_path.replace("\\", "/").split("/") if p]
    if not parts or any(p in {".", ".."} or p.startswith(".") for p in parts):
        raise HTTPException(status_code=403, detail="That path is not allowed.")

    resolved_root = course_root.resolve()
    candidate = resolved_root.joinpath(*parts).resolve()
    if not candidate.is_relative_to(resolved_root):
        raise HTTPException(
            status_code=403, detail="That path is outside the course folder."
        )
    if not candidate.is_file():
        raise HTTPException(status_code=404, detail=f"{rel_path} was not found.")
    return candidate


@router.get("/api/sync-course", response_model=list[LocalFile])
def sync_local_course_files() -> list[LocalFile]:
    return discover_course_files()


@router.get("/api/course-info", response_model=CourseInfo)
def get_course_info() -> CourseInfo:
    return course_info()


@router.get("/api/course-files/{rel_path:path}")
def get_course_file(rel_path: str) -> FileResponse:
    """Serve one course file (also used for images referenced by previews)."""
    return FileResponse(resolve_course_path(rel_path))


@router.get("/api/notebook-preview/{rel_path:path}", response_class=HTMLResponse)
def get_notebook_preview(rel_path: str) -> HTMLResponse:
    """Render a notebook as HTML, preferring a same-name .html file if one exists."""
    notebook = resolve_course_path(rel_path)
    if notebook.suffix.lower() != ".ipynb":
        raise HTTPException(
            status_code=400, detail="Only .ipynb files can be rendered."
        )

    for suffix in (".html", ".htm"):
        sibling = notebook.with_suffix(suffix)
        if sibling.is_file():
            return HTMLResponse(sibling.read_text(encoding="utf-8", errors="replace"))

    try:
        return HTMLResponse(cached_notebook_html(notebook))
    except NotebookPreviewUnavailable as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
