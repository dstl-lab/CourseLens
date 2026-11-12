import json
from pathlib import Path

import pytest

from app.services.course_config import (
    CourseConfig,
    artifact_id,
    classify,
    load_course_config,
    matches_pattern,
    normalize_key,
    prefer_rank,
    scheduled_week,
    week_from_path,
)

DEFAULT = CourseConfig()


@pytest.mark.parametrize(
    ("path", "pattern", "expected"),
    [
        ("course/lectures/lec01/lec01.ipynb", "lectures", True),
        ("course/lectures/lec01/lec01.ipynb", "lec01", True),
        ("course/lectures/lec01/lec01.ipynb", "lec0[0-9]", True),
        ("course/lectures/lec01/lec01.ipynb", "lectures/**", False),
        ("lectures/lec01/lec01.ipynb", "lectures/**", True),
        ("course/lectures/lec01/lec01.ipynb", "**/lectures/**", True),
        ("course/lectures/lec01/lec01.ipynb", "*/lectures/*/lec01.ipynb", True),
        ("course/lectures/lec01/lec01.ipynb", "*/lectures/lec01.ipynb", False),
        ("Exams/Midterm/midterm.TEX", "exams/midterm", True),
        ("exams/midterm/midterm.tex", "/exams", True),
        ("data/", "**/data/**", True),
    ],
)
def test_matches_pattern(path: str, pattern: str, expected: bool) -> None:
    assert matches_pattern(path, pattern) is expected


@pytest.mark.parametrize(
    ("path", "expected_type"),
    [
        ("lectures/lec01/lec01.ipynb", "lecture"),
        ("slides/Week 2 - Loops.pdf", "lecture"),
        ("assignments/a1/a1.ipynb", "homework"),
        ("problem-sets/ps3.tex", "homework"),
        ("labs/lab1/tests/q1.py", "lab"),
        ("exams/midterm/midterm.tex", "exam"),
        ("projects/final_project/src/final_project.ipynb", "project"),
        ("lectures/projection.ipynb", "lecture"),
        ("lectures/example.ipynb", "lecture"),
        ("discussion/disc01/disc01.ipynb", "discussion"),
        ("quizzes/quiz2.md", "quiz"),
        ("syllabus.md", "schedule"),
        ("misc/notebook.ipynb", "other"),
    ],
)
def test_classify_with_default_types(path: str, expected_type: str) -> None:
    assert classify(path, DEFAULT)[0] == expected_type


def test_custom_types_take_precedence_over_defaults() -> None:
    config = CourseConfig(types={"lab": ["assignments"], "studio": ["studio*"]})
    assert classify("assignments/a1/a1.ipynb", config)[0] == "lab"
    assert classify("studios/studio03.ipynb", config)[0] == "studio"


@pytest.mark.parametrize(
    ("path", "expected_id"),
    [
        ("homeworks/hw1/src/hw1.ipynb", "homework/hw1"),
        ("course-public/homeworks/hw1/hw1.html", "homework/hw1"),
        ("homeworks/hw01/build/autograder/hw01.ipynb", "homework/hw1"),
        ("resources/lectures/lec01.md", "lecture/lec1"),
        ("lectures/lec11/lec11_secA.pdf", "lecture/lec11"),
        ("exams/quizzes/quiz1/quiz1.ipynb", "quiz/quiz1"),
        (
            "projects/final_project/build/student/FinalProject.ipynb",
            "project/finalproject",
        ),
        ("hw1/notebook.ipynb", "homework/hw1"),
        ("slides/Lec 07.pdf", "lecture/lec7"),
        ("week03/lecture.ipynb", "path/week03/lecture"),
        ("week03/lecture.html", "path/week03/lecture"),
    ],
)
def test_artifact_id_groups_copies_of_one_item(path: str, expected_id: str) -> None:
    assert artifact_id(path, DEFAULT) == expected_id


def test_normalize_key_ignores_case_separators_and_leading_zeros() -> None:
    assert normalize_key("Lec 01.ipynb") == normalize_key("lec_1") == "lec1"
    assert normalize_key("HW-010") == "hw10"


def test_week_from_path() -> None:
    assert week_from_path("week03/intro.ipynb") == 3
    assert week_from_path("modules/Week-12/notes.md") == 12
    assert week_from_path("wk5/lab.ipynb") == 5
    assert week_from_path("lectures/lec05.ipynb") is None
    assert week_from_path("weekly-review.md") is None


def test_scheduled_week_matches_names_ids_and_patterns() -> None:
    config = CourseConfig.model_validate(
        {
            "schedule": [
                {"week": 2, "files": ["lec03", "homework/hw1"]},
                {"week": 8, "files": ["exams/midterm/**"]},
                {"week": 15, "files": ["syllabus"]},
            ]
        }
    )
    path = "lectures/lec03/lec03.ipynb"
    assert scheduled_week(path, artifact_id(path, config), config) == 2
    path = "homeworks/hw01/hw01.ipynb"
    assert scheduled_week(path, artifact_id(path, config), config) == 2
    path = "exams/midterm/questions.tex"
    assert scheduled_week(path, artifact_id(path, config), config) == 8
    path = "syllabus.md"
    assert scheduled_week(path, artifact_id(path, config), config) == 15
    path = "lectures/lec04/lec04.ipynb"
    assert scheduled_week(path, artifact_id(path, config), config) is None


def test_prefer_rank_orders_preferred_and_generated_copies() -> None:
    config = CourseConfig(prefer=["*-private/**/src/**", "*-public/**"])
    src = prefer_rank("c-private/homeworks/hw1/src/hw1.ipynb", config)
    public = prefer_rank("c-public/homeworks/hw1/hw1.ipynb", config)
    build = prefer_rank("c-private/homeworks/hw1/build/hw1.ipynb", config)
    assert src < public < build
    assert prefer_rank("hw1/hw1.ipynb", DEFAULT) < prefer_rank(
        "hw1/build/hw1.ipynb", DEFAULT
    )


def test_load_course_config_defaults_when_missing(tmp_path: Path) -> None:
    loaded = load_course_config(tmp_path)
    assert loaded.found is False
    assert loaded.warnings == []
    assert ".ipynb" in loaded.config.extensions


def test_load_course_config_reports_invalid_json(tmp_path: Path) -> None:
    (tmp_path / "courselens.json").write_text("{ not json", encoding="utf-8")
    loaded = load_course_config(tmp_path)
    assert loaded.found is True
    assert loaded.warnings and "could not be read" in loaded.warnings[0]


def test_load_course_config_reports_invalid_settings(tmp_path: Path) -> None:
    (tmp_path / "courselens.json").write_text(
        json.dumps({"schedule": [{"week": 0, "files": ["lec01"]}]}), encoding="utf-8"
    )
    loaded = load_course_config(tmp_path)
    assert loaded.warnings and "schedule.0.week" in loaded.warnings[0]


def test_load_course_config_normalizes_extensions_and_ignores_unknown_keys(
    tmp_path: Path,
) -> None:
    (tmp_path / "courselens.json").write_text(
        json.dumps({"_help": "notes", "extensions": ["PY", ".Tex"], "weeks": 15}),
        encoding="utf-8",
    )
    loaded = load_course_config(tmp_path)
    assert loaded.warnings == []
    assert loaded.config.extensions == [".py", ".tex"]
    assert loaded.config.weeks == 15
