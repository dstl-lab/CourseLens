import json
from pathlib import Path

from app.services.course_config import discover_files, load_course_config
from scripts.build_previews import convert_notebooks_to_html
from scripts.init_course_config import build_config, guess_schedule


def write(root: Path, rel: str, content: str = "{}") -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def make_course(root: Path) -> None:
    for n in range(1, 21):
        write(root, f"lectures/lec{n:02d}/lec{n:02d}.ipynb")
    for n in range(1, 6):
        write(root, f"homeworks/hw{n}/hw{n}.ipynb")
    write(root, "labs/lab1/lab1.ipynb")
    write(root, "week07/guest-talk.md", "# Guest talk")
    write(root, "exams/midterm/midterm.tex", "x")
    write(root, "exams/final/final.tex", "x")
    write(root, "exams/practice/questions.tex", "x")
    write(root, "notes.md", "# loose notes")


def test_guess_schedule_spreads_items_and_keeps_unknowns_unscheduled(
    tmp_path: Path,
) -> None:
    make_course(tmp_path)
    files = discover_files(tmp_path, load_course_config(tmp_path).config)

    schedule, unscheduled = guess_schedule(files, weeks=10)
    week_of = {name: week for week, names in schedule.items() for name in names}

    assert week_of["lec01"] == 1
    assert week_of["lec20"] == 10
    assert week_of["hw5"] == 10
    assert week_of["lab1"] == 1  # a single numbered item starts the term
    # A week named in the path wins; loose files are listed by their path.
    assert week_of["week07/guest-talk.md"] == 7
    assert week_of["midterm"] == 5
    assert week_of["final"] == 10
    assert "practice" in unscheduled
    assert all(1 <= week <= 10 for week in schedule)


def test_build_config_output_is_a_valid_courselens_config(tmp_path: Path) -> None:
    make_course(tmp_path)
    draft = build_config(tmp_path, weeks=10)

    (tmp_path / "courselens.json").write_text(json.dumps(draft), encoding="utf-8")
    loaded = load_course_config(tmp_path)
    assert loaded.warnings == []
    assert loaded.config.weeks == 10

    files = discover_files(tmp_path, loaded.config)
    weeks = {f.path: f.week for f in files}
    assert weeks["lectures/lec01/lec01.ipynb"] == 1
    assert weeks["lectures/lec20/lec20.ipynb"] == 10
    assert weeks["exams/practice/questions.tex"] is None


def test_build_previews_only_fills_in_missing_html(tmp_path: Path) -> None:
    notebook = {
        "cells": [{"cell_type": "code", "source": "print('hi')", "outputs": []}],
        "metadata": {},
        "nbformat": 4,
        "nbformat_minor": 5,
    }
    write(tmp_path, "lectures/lec01/lec01.ipynb", json.dumps(notebook))
    write(tmp_path, "lectures/lec02/lec02.ipynb", json.dumps(notebook))
    write(tmp_path, "lectures/lec02/lec02.html", "<p>hand-made</p>")

    assert convert_notebooks_to_html(tmp_path) == 1
    assert "print" in (tmp_path / "lectures/lec01/lec01.html").read_text()
    assert (tmp_path / "lectures/lec02/lec02.html").read_text() == "<p>hand-made</p>"
