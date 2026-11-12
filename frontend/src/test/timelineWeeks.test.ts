import { describe, expect, it } from "vitest";
import { groupByWeek, timelineWeek } from "../utils/timelineWeeks";
import type { FileEntry } from "../components/changeVisualization/constants";

function entry(filename: string, fileType: string, week?: number | null, primaryPath?: string): FileEntry {
  return { filename, fileType, week, primaryPath, changes: [] };
}

describe("timelineWeek", () => {
  it("uses the week from the course schedule", () => {
    expect(timelineWeek(entry("lec05", "lecture", 2))).toBe(2);
  });

  it("falls back to a week named in the path for files outside the course folder", () => {
    expect(timelineWeek(entry("intro.ipynb", "other", null, "week03/intro.ipynb"))).toBe(3);
    expect(timelineWeek(entry("Week-12 review.md", "other"))).toBe(12);
  });

  it("does not guess weeks from item numbers", () => {
    // An old hard-coded week table put lec05 in week 2 and hw1 in week 3 for every course.
    expect(timelineWeek(entry("lec05", "lecture"))).toBeNull();
    expect(timelineWeek(entry("hw1", "homework"))).toBeNull();
    expect(timelineWeek(entry("weekly-notes.md", "other"))).toBeNull();
  });
});

describe("groupByWeek", () => {
  it("creates a column for every week of the term, plus later weeks in use", () => {
    const { weeks, unscheduled } = groupByWeek(
      [entry("lec01", "lecture", 1), entry("final", "exam", 17)],
      15,
    );

    expect(weeks.map((w) => w.week)).toEqual(Array.from({ length: 17 }, (_, i) => i + 1));
    expect(weeks[0].files.map((f) => f.filename)).toEqual(["lec01"]);
    expect(weeks[16].files.map((f) => f.filename)).toEqual(["final"]);
    expect(unscheduled).toEqual([]);
  });

  it("puts files without a week in the unscheduled list and sorts within each column", () => {
    const { weeks, unscheduled } = groupByWeek(
      [
        entry("hw1", "homework", 2),
        entry("lec10", "lecture", 2),
        entry("lec2", "lecture", 2),
        entry("syllabus", "schedule"),
        entry("a-notes", "other"),
      ],
      null,
    );

    expect(weeks.map((w) => w.week)).toEqual([1, 2]);
    // Lectures first, then by natural name order (lec2 before lec10).
    expect(weeks[1].files.map((f) => f.filename)).toEqual(["lec2", "lec10", "hw1"]);
    expect(unscheduled.map((f) => f.filename)).toEqual(["syllabus", "a-notes"]);
  });

  it("returns no week columns when nothing is scheduled", () => {
    const { weeks, unscheduled } = groupByWeek([entry("lec01", "lecture")], undefined);
    expect(weeks).toEqual([]);
    expect(unscheduled).toHaveLength(1);
  });
});
