"""Models for the Course Review (CourseLens) course-folder endpoints."""

from pydantic import BaseModel, Field


class LocalFile(BaseModel):
    """A course file discovered in the configured course folder.

    File contents are not included; the frontend fetches a file from
    ``/api/course-files/{path}`` only when it needs to show it.
    """

    filename: str
    fileType: str
    path: str
    repo: str | None = None
    stem: str | None = None
    previewPath: str | None = None
    artifactId: str
    week: int | None = None
    weekSource: str | None = None  # "schedule" | "path" | None
    preferRank: int = 0
    size: int = 0


class CourseInfo(BaseModel):
    """What the frontend needs to know about the configured course."""

    configured: bool
    rootExists: bool
    rootName: str | None = None
    name: str | None = None
    weeks: int | None = None
    configFound: bool = False
    hasSchedule: bool = False
    stablePreviewTypes: list[str] = Field(default_factory=list)
    fileCount: int = 0
    unscheduledCount: int = 0
    warnings: list[str] = Field(default_factory=list)
