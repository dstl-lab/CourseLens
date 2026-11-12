"""Course configuration and course-file discovery for Course Review (CourseLens).

Everything course-specific lives in an optional ``courselens.json`` file at the
root of the instructor's course folder (``COURSE_REVIEW_ROOT``). Without that
file, generic defaults apply: common folder names (``lectures``,
``assignments``, ``exams``, ...) decide each file's type, and files are only
placed in a week when the schedule lists them or their path names a week
(``week03/``). Everything else is reported as unscheduled rather than guessed.

Patterns follow gitignore-style rules, matched case-insensitively against
paths relative to the course root:

* a pattern without ``/`` matches any single path segment (a folder name, a
  file name, or a file name without its extension), e.g. ``lectures`` or
  ``hw*``;
* a pattern with ``/`` matches the whole relative path, e.g.
  ``*-private/homeworks/**/src/**``;
* ``*`` matches within one segment, ``**`` matches across segments, ``?``
  matches one character and ``[0-9]`` matches a character class.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, Field, ValidationError

BACKEND_DIR = Path(__file__).resolve().parents[2]

CONFIG_FILENAME = "courselens.json"

DEFAULT_EXTENSIONS = [".ipynb", ".html", ".htm", ".md", ".pdf", ".tex", ".qmd", ".rmd"]

# Folders that never contain course materials. Hidden folders and files
# (anything starting with ".") are always skipped as well.
BUILTIN_EXCLUDES = [
    "node_modules",
    "__pycache__",
    "venv",
    "site-packages",
    "_site",
]

# Repository housekeeping files, never course materials.
HOUSEKEEPING_STEMS = {
    "readme",
    "license",
    "contributing",
    "changelog",
    "code_of_conduct",
}

# Checked in this order; within a path the innermost segment is checked first,
# so `projects/final_project/...` is a project, not an exam.
DEFAULT_TYPES: dict[str, list[str]] = {
    "project": [
        "projects",
        "project",
        "project[-_0-9]*",
        "proj[-_0-9]*",
        "*_project*",
        "*-project*",
    ],
    "exam": [
        "exams",
        "exam",
        "exam[-_0-9]*",
        "midterm",
        "midterms",
        "midterm[0-9]*",
        "final",
        "finals",
        "final[-_]exam*",
    ],
    "homework": [
        "homeworks",
        "homework",
        "homework[-_0-9]*",
        "hw*",
        "assignments",
        "assignment",
        "assignment[-_0-9]*",
        "psets",
        "pset*",
        "problem-sets",
        "problem_sets",
    ],
    "lab": ["labs", "lab", "lab[-_0-9]*"],
    "quiz": ["quizzes", "quiz*"],
    "discussion": [
        "discussions",
        "discussion*",
        "disc[-_0-9]*",
        "sections",
        "recitations",
        "recitation*",
        "worksheets",
        "worksheet*",
    ],
    "lecture": ["lectures", "lecture*", "lec*", "slides", "notes"],
    "schedule": ["schedule*", "syllabus*", "calendar*"],
}

GENERATED_SEGMENTS = {"build", "_build", "rebuild", "dist", "_site", "generated"}

WEEK_PATTERN = re.compile(
    r"(?:^|[^a-z])(?:week|wk)[-_ ]?0*(\d{1,2})(?![0-9])", re.IGNORECASE
)


class ScheduleEntry(BaseModel):
    week: int = Field(ge=1, le=60)
    files: list[str] = Field(default_factory=list)


class CourseConfig(BaseModel):
    """Contents of ``courselens.json``. Unknown keys are ignored."""

    name: str | None = None
    weeks: int | None = Field(default=None, ge=1, le=60)
    repos: list[str] | None = None
    extensions: list[str] = Field(default_factory=lambda: list(DEFAULT_EXTENSIONS))
    include: list[str] = Field(default_factory=list)
    exclude: list[str] = Field(default_factory=list)
    types: dict[str, list[str]] = Field(default_factory=dict)
    schedule: list[ScheduleEntry] = Field(default_factory=list)
    prefer: list[str] = Field(default_factory=list)
    stable_preview_types: list[str] = Field(default_factory=list)


@dataclass
class LoadedConfig:
    config: CourseConfig
    found: bool
    warnings: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Pattern matching
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1024)
def _compile_glob(pattern: str) -> re.Pattern[str]:
    out: list[str] = []
    i = 0
    while i < len(pattern):
        ch = pattern[i]
        if ch == "*":
            if pattern.startswith("**", i):
                i += 2
                if i < len(pattern) and pattern[i] == "/":
                    out.append("(?:.*/)?")
                    i += 1
                else:
                    out.append(".*")
                continue
            out.append("[^/]*")
        elif ch == "?":
            out.append("[^/]")
        elif ch == "[":
            end = pattern.find("]", i + 1)
            if end == -1:
                out.append(re.escape(ch))
            else:
                out.append("[" + pattern[i + 1 : end].replace("\\", "\\\\") + "]")
                i = end
        else:
            out.append(re.escape(ch))
        i += 1
    return re.compile("".join(out) + r"\Z", re.IGNORECASE)


def _segment_candidates(rel_path: str) -> list[str]:
    parts = [p for p in rel_path.split("/") if p]
    candidates = list(parts)
    if parts:
        candidates.append(Path(parts[-1]).stem)
    return candidates


def matches_pattern(rel_path: str, pattern: str) -> bool:
    """Gitignore-style match of ``pattern`` against a root-relative path.

    Folder paths may be passed with a trailing ``/`` so that patterns such as
    ``**/data/**`` also match the folder itself.
    """
    raw = pattern.strip()
    anchored = raw.startswith("/") or "/" in raw.strip("/")
    pattern = raw.strip("/")
    if not pattern:
        return False
    regex = _compile_glob(pattern)
    if anchored:
        # A folder pattern also matches everything under it.
        return bool(regex.match(rel_path.rstrip("/"))) or bool(
            _compile_glob(pattern + "/**").match(rel_path)
        )
    return any(regex.match(candidate) for candidate in _segment_candidates(rel_path))


def _segment_matches(segment: str, pattern: str, is_file: bool) -> bool:
    if "/" in pattern:
        return False
    regex = _compile_glob(pattern.strip())
    if regex.match(segment):
        return True
    return is_file and bool(regex.match(Path(segment).stem))


# ---------------------------------------------------------------------------
# Config loading
# ---------------------------------------------------------------------------


def configured_course_root() -> Path | None:
    """The course folder from COURSE_REVIEW_ROOT (environment or backend/.env)."""
    from app.config import settings

    value = os.getenv("COURSE_REVIEW_ROOT") or settings.COURSE_REVIEW_ROOT
    if not value or not value.strip():
        return None
    path = Path(value.strip()).expanduser()
    if not path.is_absolute():
        path = BACKEND_DIR / path
    return path.resolve()


def load_course_config(root: Path) -> LoadedConfig:
    config_path = root / CONFIG_FILENAME
    if not config_path.is_file():
        return LoadedConfig(CourseConfig(), found=False)

    try:
        raw = json.loads(config_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return LoadedConfig(
            CourseConfig(),
            found=True,
            warnings=[f"{CONFIG_FILENAME} could not be read ({exc}); using defaults."],
        )

    if not isinstance(raw, dict):
        return LoadedConfig(
            CourseConfig(),
            found=True,
            warnings=[f"{CONFIG_FILENAME} must contain a JSON object; using defaults."],
        )

    try:
        config = CourseConfig.model_validate(raw)
    except ValidationError as exc:
        problems = "; ".join(
            f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}"
            for err in exc.errors()
        )
        return LoadedConfig(
            CourseConfig(),
            found=True,
            warnings=[
                f"{CONFIG_FILENAME} has invalid settings ({problems}); using defaults."
            ],
        )

    config.extensions = [
        ext.lower() if ext.startswith(".") else f".{ext.lower()}"
        for ext in config.extensions
    ]
    return LoadedConfig(config, found=True)


def type_patterns(config: CourseConfig) -> list[tuple[str, list[str]]]:
    """User-defined types first (so they win ties), then the defaults."""
    ordered: list[tuple[str, list[str]]] = [
        (name.lower(), patterns) for name, patterns in config.types.items()
    ]
    seen = {name for name, _ in ordered}
    ordered.extend(
        (name, patterns) for name, patterns in DEFAULT_TYPES.items() if name not in seen
    )
    return ordered


# ---------------------------------------------------------------------------
# Classification, grouping and scheduling
# ---------------------------------------------------------------------------


def classify(rel_path: str, config: CourseConfig) -> tuple[str, int | None]:
    """Return ``(file_type, matched_segment_index)``; innermost segment wins."""
    parts = [p for p in rel_path.split("/") if p]
    types = type_patterns(config)
    for idx in range(len(parts) - 1, -1, -1):
        is_file = idx == len(parts) - 1
        for type_name, patterns in types:
            if any(
                _segment_matches(parts[idx], pattern, is_file) for pattern in patterns
            ):
                return type_name, idx
    return "other", None


def normalize_key(value: str) -> str:
    """`Lec 01.ipynb` / `lec_1` / `LEC-01` all become `lec1`."""
    stem = Path(value).stem if "." in value else value
    key = re.sub(r"[\s_\-]+", "", stem.lower())
    return re.sub(r"(?<![0-9])0+(?=[0-9])", "", key)


def _type_for_segment(segment: str, is_file: bool, config: CourseConfig) -> str | None:
    for type_name, patterns in type_patterns(config):
        if any(_segment_matches(segment, pattern, is_file) for pattern in patterns):
            return type_name
    return None


def artifact_id(rel_path: str, config: CourseConfig) -> str:
    """Identify the course item a file belongs to.

    All copies of one item (notebook + HTML render, student + solution
    versions, copies in several repos) share an id so they appear as one card.
    A collection folder such as ``homeworks/`` names the type and its next
    segment names the item (``homeworks/hw1/src/hw1.ipynb`` -> ``homework/hw1``).
    Nested collections use the innermost one (``exams/quizzes/quiz1/...`` ->
    ``quiz/quiz1``). Otherwise a numbered item folder or file (``hw1/``,
    ``lec03.ipynb``) is used. Anything else is keyed by its own path so
    siblings with the same stem (``a.ipynb`` + ``a.html``) still group.
    """
    parts = [p for p in rel_path.split("/") if p]
    last = len(parts) - 1

    def collection_type(idx: int) -> str | None:
        if idx >= last or re.search(r"\d", parts[idx]):
            return None
        return _type_for_segment(parts[idx], False, config)

    for idx in range(last):
        type_name = collection_type(idx)
        if not type_name:
            continue
        nested = collection_type(idx + 1)
        if nested and nested != type_name:
            # e.g. exams/quizzes/...: the inner collection names the item type
            continue
        return f"{type_name}/{normalize_key(parts[idx + 1])}"

    for idx in range(last, -1, -1):
        segment = parts[idx]
        is_file = idx == last
        name = Path(segment).stem if is_file else segment
        type_name = _type_for_segment(segment, is_file, config)
        if type_name and re.search(r"\d", name):
            return f"{type_name}/{normalize_key(name)}"

    return "path/" + re.sub(r"\.[^./]+$", "", rel_path).lower()


def week_from_path(rel_path: str) -> int | None:
    for segment in reversed(rel_path.split("/")):
        match = WEEK_PATTERN.search(segment)
        if match:
            week = int(match.group(1))
            if week >= 1:
                return week
    return None


def scheduled_week(rel_path: str, item_id: str, config: CourseConfig) -> int | None:
    """Week from the ``schedule`` list.

    Entries can name an item (``hw1``, ``lec03`` — matched to every copy of
    that item), an item id (``homework/hw1``), or a pattern
    (``exams/midterm/**``, ``syllabus``).
    """
    type_name, _, item_key = item_id.partition("/")
    for entry in config.schedule:
        for pattern in entry.files:
            pattern = pattern.strip()
            if not pattern:
                continue
            lowered = pattern.lower().strip("/")
            if lowered == item_id or (
                "/" in lowered
                and lowered.split("/", 1)[0] == type_name
                and normalize_key(lowered.split("/", 1)[1]) == item_key
            ):
                return entry.week
            if (
                "/" not in lowered
                and not any(ch in lowered for ch in "*?[")
                and (normalize_key(lowered) == item_key)
            ):
                return entry.week
            if matches_pattern(rel_path, pattern):
                return entry.week
    return None


def _is_generated(rel_path: str) -> bool:
    return bool({p.lower() for p in rel_path.split("/")} & GENERATED_SEGMENTS)


def prefer_rank(rel_path: str, config: CourseConfig) -> int:
    """Lower is preferred when choosing which copy of an item to show.

    Copies matching an earlier ``prefer`` pattern win; within a group, copies
    inside build/output folders rank after hand-written sources.
    """
    generated = 1 if _is_generated(rel_path) else 0
    for idx, pattern in enumerate(config.prefer):
        if matches_pattern(rel_path, pattern):
            return idx * 2 + generated
    return len(config.prefer) * 2 + generated


# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------


@dataclass
class DiscoveredFile:
    path: str
    filename: str
    stem: str
    extension: str
    file_type: str
    repo: str | None
    artifact_id: str
    week: int | None
    week_source: str | None
    prefer_rank: int
    preview_path: str | None
    size: int


def repo_dirs(root: Path, config: CourseConfig) -> list[str]:
    """Sub-folders that are separate repositories (e.g. public/private/website)."""
    if config.repos is not None:
        return [r.strip("/") for r in config.repos if (root / r).is_dir()]
    if (root / ".git").exists():
        return []
    try:
        return sorted(
            child.name
            for child in root.iterdir()
            if child.is_dir()
            and not child.name.startswith(".")
            and (child / ".git").exists()
        )
    except OSError:
        return []


def _is_excluded(rel_path: str, config: CourseConfig) -> bool:
    parts = rel_path.split("/")
    if any(part.startswith(".") for part in parts):
        return True
    lowered = {part.lower() for part in parts}
    if lowered & set(BUILTIN_EXCLUDES):
        return True
    return any(matches_pattern(rel_path, pattern) for pattern in config.exclude)


def _preview_path(file_path: Path, root: Path) -> str | None:
    suffix = file_path.suffix.lower()
    if suffix in {".html", ".htm"}:
        return file_path.relative_to(root).as_posix()
    if suffix in {".ipynb", ".qmd", ".rmd"}:
        for html_suffix in (".html", ".htm"):
            sibling = file_path.with_suffix(html_suffix)
            if sibling.exists():
                return sibling.relative_to(root).as_posix()
    return None


def discover_files(root: Path, config: CourseConfig) -> list[DiscoveredFile]:
    if not root.is_dir():
        return []

    repos = set(repo_dirs(root, config))
    extensions = set(config.extensions)
    found: list[DiscoveredFile] = []

    for current, dirs, files in os.walk(root):
        current_path = Path(current)
        rel_dir = current_path.relative_to(root).as_posix()
        rel_dir = "" if rel_dir == "." else rel_dir

        # Prune excluded folders so large data/build trees are never walked.
        dirs[:] = sorted(
            d for d in dirs if not _is_excluded(f"{rel_dir}/{d}/".lstrip("/"), config)
        )

        for name in sorted(files):
            rel_path = f"{rel_dir}/{name}".lstrip("/")
            file_path = current_path / name
            extension = file_path.suffix.lower()
            if extension not in extensions or _is_excluded(rel_path, config):
                continue
            if file_path.stem.lower() in HOUSEKEEPING_STEMS:
                continue
            if config.include and not any(
                matches_pattern(rel_path, p) for p in config.include
            ):
                continue

            file_type, _ = classify(rel_path, config)
            item_id = artifact_id(rel_path, config)
            week = scheduled_week(rel_path, item_id, config)
            week_source = "schedule" if week is not None else None
            if week is None:
                week = week_from_path(rel_path)
                week_source = "path" if week is not None else None

            first_segment = rel_path.split("/", 1)[0]
            try:
                size = file_path.stat().st_size
            except OSError:
                size = 0

            found.append(
                DiscoveredFile(
                    path=rel_path,
                    filename=name,
                    stem=file_path.stem,
                    extension=extension,
                    file_type=file_type,
                    repo=first_segment if first_segment in repos else None,
                    artifact_id=item_id,
                    week=week,
                    week_source=week_source,
                    prefer_rank=prefer_rank(rel_path, config),
                    preview_path=_preview_path(file_path, root),
                    size=size,
                )
            )

    return found


def max_week(config: CourseConfig, files: list[DiscoveredFile]) -> int | None:
    weeks = [f.week for f in files if f.week is not None]
    weeks.extend(entry.week for entry in config.schedule)
    if config.weeks:
        weeks.append(config.weeks)
    return max(weeks) if weeks else None
