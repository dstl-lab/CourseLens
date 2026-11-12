"""Draft a courselens.json for a course folder, with guessed weeks to review.

CourseLens never guesses weeks on its own: files only appear in a week when
courselens.json lists them (or their path names a week, like ``week03/``).
This script writes a starting schedule by spreading numbered items evenly
across the term (lecture 1 early, the last lecture in the final week, and so
on). The guesses are only a first draft — open the file and fix the weeks.

Usage (from the backend folder):
    uv run python -m scripts.init_course_config --weeks 10
    uv run python -m scripts.init_course_config --weeks 15 --root /path/to/course
    uv run python -m scripts.init_course_config --weeks 15 --dry-run
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from collections import defaultdict
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.course_config import (  # noqa: E402
    CONFIG_FILENAME,
    DiscoveredFile,
    configured_course_root,
    discover_files,
    load_course_config,
    normalize_key,
)

UNSPREAD_TYPES = {"exam", "schedule", "other", "path"}
NUMBER = re.compile(r"^[a-z]*?(\d+)")


def _natural(value: str) -> list[object]:
    return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", value.lower())]


def _readable_name(item_id: str, files: list[DiscoveredFile]) -> str:
    """A name the instructor will recognize, e.g. `lec05` for `lecture/lec5`."""
    type_name, _, key = item_id.partition("/")
    if type_name == "path":
        return min(files, key=lambda f: f.path).path
    for found in sorted(files, key=lambda f: f.path):
        for segment in reversed(Path(found.path).with_suffix("").parts):
            if normalize_key(segment) == key:
                return segment
    return key


def guess_schedule(
    files: list[DiscoveredFile], weeks: int
) -> tuple[dict[int, list[str]], list[str]]:
    """Return ``({week: [item names]}, [unscheduled item names])``."""
    items: dict[str, list[DiscoveredFile]] = defaultdict(list)
    for found in files:
        items[found.artifact_id].append(found)

    schedule: dict[int, list[str]] = defaultdict(list)
    unscheduled: list[str] = []
    numbered: dict[str, list[tuple[int, str]]] = defaultdict(list)

    for item_id, item_files in items.items():
        name = _readable_name(item_id, item_files)
        path_weeks = [f.week for f in item_files if f.week_source == "path"]
        if path_weeks:
            schedule[min(path_weeks)].append(name)
            continue

        type_name, _, key = item_id.partition("/")
        if type_name == "exam" and "midterm" in key:
            schedule[max(1, math.ceil(weeks / 2))].append(name)
            continue
        if type_name == "exam" and "final" in key:
            schedule[weeks].append(name)
            continue

        match = NUMBER.match(key)
        if type_name in UNSPREAD_TYPES or not match:
            unscheduled.append(name)
            continue
        numbered[type_name].append((int(match.group(1)), name))

    # Spread each type's numbered items evenly over the term. Items that
    # share a number (quiz1a, quiz1b) land in the same week.
    for entries in numbered.values():
        numbers = sorted({number for number, _ in entries})
        rank = {number: idx + 1 for idx, number in enumerate(numbers)}
        for number, name in entries:
            # The last item lands in the final week; a lone item in week 1.
            if len(numbers) == 1:
                week = 1
            else:
                week = max(1, math.ceil(rank[number] * weeks / len(numbers)))
            schedule[week].append(name)

    return (
        {week: sorted(names, key=_natural) for week, names in sorted(schedule.items())},
        sorted(unscheduled, key=_natural),
    )


def build_config(root: Path, weeks: int) -> dict:
    config = load_course_config(root).config
    files = discover_files(root, config)
    schedule, unscheduled = guess_schedule(files, weeks)
    return {
        "_help": (
            "CourseLens settings for this course. The weeks below are GUESSES "
            "made from file numbers: check every week and move items as needed. "
            "Items in _unscheduled are not placed in any week until you add "
            "them to the schedule. See docs/courselens-config.md."
        ),
        "name": root.name,
        "weeks": weeks,
        "schedule": [
            {"week": week, "files": names} for week, names in schedule.items()
        ],
        "_unscheduled": unscheduled,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--weeks",
        type=int,
        required=True,
        help="Length of the term in weeks (e.g. 10 for a quarter, 15 for a semester)",
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=None,
        help="Course folder (default: COURSE_REVIEW_ROOT from the environment "
        "or backend/.env)",
    )
    parser.add_argument(
        "--force", action="store_true", help=f"Overwrite an existing {CONFIG_FILENAME}"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Print the draft instead of writing it"
    )
    args = parser.parse_args()

    if not 1 <= args.weeks <= 60:
        raise SystemExit("--weeks must be between 1 and 60.")

    root = args.root.expanduser().resolve() if args.root else configured_course_root()
    if root is None or not root.is_dir():
        raise SystemExit(
            "No course folder found. Pass --root /path/to/course or set "
            "COURSE_REVIEW_ROOT in backend/.env."
        )

    draft = build_config(root, args.weeks)
    text = json.dumps(draft, indent=2) + "\n"
    if args.dry_run:
        print(text)
        return

    target = root / CONFIG_FILENAME
    if target.exists() and not args.force:
        raise SystemExit(f"{target} already exists. Use --force to replace it.")
    target.write_text(text, encoding="utf-8")

    placed = sum(len(entry["files"]) for entry in draft["schedule"])
    print(f"Wrote {target}")
    print(
        f"  {placed} item(s) placed across {args.weeks} weeks (guessed), "
        f"{len(draft['_unscheduled'])} left unscheduled."
    )
    print("  Open the file and check every week before relying on the timeline.")


if __name__ == "__main__":
    main()
