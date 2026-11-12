"""Course Review endpoints against synthetic courses (no real course data)."""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.sync import course_info, discover_course_files

NOTEBOOK = {
    "cells": [
        {
            "cell_type": "markdown",
            "source": ["# Loops\n", "![diagram](images/loop.png)"],
        },
        {
            "cell_type": "code",
            "source": "for i in range(3):\n    print(i)",
            "outputs": [
                {"output_type": "stream", "name": "stdout", "text": ["0\n1\n2\n"]}
            ],
        },
    ],
    "metadata": {},
    "nbformat": 4,
    "nbformat_minor": 5,
}


def write(root: Path, rel: str, content: str = "x") -> Path:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path


@pytest.fixture
def semester_course(tmp_path: Path) -> Path:
    """A 15-week course that uses none of the original course's folder names."""
    root = tmp_path / "cs101"
    write(root, "slides/week01-intro.pdf")
    write(root, "slides/Lecture 02.ipynb", json.dumps(NOTEBOOK))
    write(root, "slides/Lecture 02.html", "<h1>Lecture 2</h1>")
    write(root, "assignments/a1/a1.ipynb", json.dumps(NOTEBOOK))
    write(root, "assignments/a1/tests/q1.py", "assert True")
    write(root, "assignments/a1/data/big.csv", "a,b")
    write(root, "exams/midterm/midterm.tex", r"\section{Loops}")
    write(root, "exams/final/final.tex", r"\section{Recursion}")
    write(root, "studios/studio03.md", "# Studio 3")
    write(root, "syllabus.md", "# Syllabus")
    write(root, "README.md", "# Repo readme")
    write(root, ".git/config", "[core]")
    write(
        root,
        "courselens.json",
        json.dumps(
            {
                "name": "CS 101",
                "weeks": 15,
                "extensions": [".ipynb", ".html", ".md", ".pdf", ".tex", ".py"],
                "exclude": ["data"],
                "types": {"discussion": ["studios", "studio*"]},
                "schedule": [
                    {"week": 2, "files": ["Lecture 02", "a1"]},
                    {"week": 8, "files": ["exams/midterm/**"]},
                    {"week": 15, "files": ["final"]},
                ],
            }
        ),
    )
    return root


@pytest.fixture
def client(semester_course: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("COURSE_REVIEW_ROOT", str(semester_course))
    return TestClient(app)


def by_path(files):
    return {f.path: f for f in files}


def test_discovers_any_folder_layout_with_types_weeks_and_previews(
    semester_course: Path,
) -> None:
    files = by_path(discover_course_files(semester_course))

    assert set(files) == {
        "slides/week01-intro.pdf",
        "slides/Lecture 02.ipynb",
        "slides/Lecture 02.html",
        "assignments/a1/a1.ipynb",
        "assignments/a1/tests/q1.py",
        "exams/midterm/midterm.tex",
        "exams/final/final.tex",
        "studios/studio03.md",
        "syllabus.md",
    }

    lecture = files["slides/Lecture 02.ipynb"]
    assert lecture.fileType == "lecture"
    assert lecture.week == 2 and lecture.weekSource == "schedule"
    assert lecture.previewPath == "slides/Lecture 02.html"
    assert lecture.artifactId == files["slides/Lecture 02.html"].artifactId

    assert files["slides/week01-intro.pdf"].week == 1
    assert files["slides/week01-intro.pdf"].weekSource == "path"

    test_file = files["assignments/a1/tests/q1.py"]
    assert test_file.fileType == "homework"
    assert test_file.artifactId == files["assignments/a1/a1.ipynb"].artifactId
    assert test_file.week == 2

    assert files["exams/midterm/midterm.tex"].fileType == "exam"
    assert files["exams/midterm/midterm.tex"].week == 8
    assert files["exams/final/final.tex"].week == 15
    assert files["studios/studio03.md"].fileType == "discussion"
    assert files["syllabus.md"].week is None
    assert all(f.size > 0 for f in files.values())


def test_detects_sibling_repositories(tmp_path: Path) -> None:
    root = tmp_path / "course"
    for repo in ("course-private", "course-public"):
        write(root, f"{repo}/.git/HEAD", "ref")
        write(root, f"{repo}/homeworks/hw1/hw1.ipynb", "{}")

    files = discover_course_files(root)

    assert {f.repo for f in files} == {"course-private", "course-public"}
    assert len({f.artifactId for f in files}) == 1


def test_unconfigured_course_returns_nothing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("COURSE_REVIEW_ROOT", "")
    monkeypatch.setattr("app.config.settings.COURSE_REVIEW_ROOT", None)
    assert discover_course_files() == []
    info = course_info()
    assert info.configured is False
    assert "COURSE_REVIEW_ROOT" in info.warnings[0]


def test_course_info_summarizes_config(semester_course: Path) -> None:
    info = course_info(semester_course)
    assert info.configured and info.rootExists and info.configFound
    assert info.name == "CS 101"
    assert info.weeks == 15
    assert info.hasSchedule is True
    assert info.fileCount == 9
    assert info.unscheduledCount == 2  # syllabus + studio03
    assert info.warnings == []


def test_sync_and_info_endpoints(client: TestClient) -> None:
    response = client.get("/api/sync-course")
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 9
    assert "content" not in payload[0]

    info = client.get("/api/course-info").json()
    assert info["name"] == "CS 101"
    assert info["weeks"] == 15


def test_course_file_endpoint_serves_files_with_spaces(client: TestClient) -> None:
    response = client.get("/api/course-files/slides/Lecture%2002.html")
    assert response.status_code == 200
    assert "Lecture 2" in response.text


@pytest.mark.parametrize(
    "path",
    [
        "../outside.txt",
        "slides/../../outside.txt",
        "%2E%2E/outside.txt",
        ".git/config",
        ".courselens/core_concepts.json",
        "assignments/a1/.hidden",
    ],
)
def test_course_file_endpoint_blocks_hidden_and_outside_paths(
    client: TestClient, semester_course: Path, path: str
) -> None:
    write(semester_course.parent, "outside.txt", "secret")
    response = client.get(f"/api/course-files/{path}")
    assert response.status_code in {403, 404}
    assert "secret" not in response.text


def test_course_file_endpoint_404s_for_missing_file(client: TestClient) -> None:
    assert client.get("/api/course-files/slides/nope.pdf").status_code == 404


def test_notebook_preview_prefers_existing_html(client: TestClient) -> None:
    response = client.get("/api/notebook-preview/slides/Lecture%2002.ipynb")
    assert response.status_code == 200
    assert response.text == "<h1>Lecture 2</h1>"


def test_notebook_preview_renders_notebooks_on_demand(
    client: TestClient, semester_course: Path
) -> None:
    response = client.get("/api/notebook-preview/assignments/a1/a1.ipynb")
    assert response.status_code == 200
    assert "<html" in response.text.lower()
    assert "Loops" in response.text  # markdown heading
    assert "<pre>0\n1\n2\n</pre>" in response.text  # code-cell output
    # Nothing is written into the instructor's course folder.
    assert not (semester_course / "assignments/a1/a1.html").exists()


def test_notebook_preview_reports_unconvertible_notebooks(
    client: TestClient, semester_course: Path
) -> None:
    write(semester_course, "assignments/a2/a2.ipynb", "not a notebook")
    response = client.get("/api/notebook-preview/assignments/a2/a2.ipynb")
    assert response.status_code == 422
    assert "a2.ipynb" in response.json()["detail"]


def test_notebook_preview_rejects_other_file_types(client: TestClient) -> None:
    response = client.get("/api/notebook-preview/syllabus.md")
    assert response.status_code == 400
