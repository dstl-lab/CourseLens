import { describe, expect, it } from "vitest";
import {
  API_URL,
  courseFileUrl,
  courseFolderUrl,
  encodeCoursePath,
  notebookPreviewUrl,
  withBaseHref,
} from "../utils/api";

describe("api helpers", () => {
  it("encodes each path segment but keeps folder separators", () => {
    expect(encodeCoursePath("slides/Lecture 02 #1.html")).toBe("slides/Lecture%2002%20%231.html");
    expect(encodeCoursePath("a\\b/c.ipynb")).toBe("a/b/c.ipynb");
  });

  it("builds course file, folder and notebook URLs from the configured API base", () => {
    expect(courseFileUrl("hw/hw 1.ipynb")).toBe(`${API_URL}/api/course-files/hw/hw%201.ipynb`);
    expect(courseFolderUrl("lectures/lec01/lec01.html")).toBe(`${API_URL}/api/course-files/lectures/lec01/`);
    expect(courseFolderUrl("syllabus.md")).toBe(`${API_URL}/api/course-files/`);
    expect(notebookPreviewUrl("labs/lab1.ipynb")).toBe(`${API_URL}/api/notebook-preview/labs/lab1.ipynb`);
  });

  it("adds a <base> tag so relative images load from the course folder", () => {
    const html = withBaseHref('<html><head><title>x</title></head><body><img src="images/a.png"></body></html>', "http://api/x/");
    expect(html).toContain('<head><base href="http://api/x/"><title>');
  });

  it("handles documents without a head and keeps an existing base tag", () => {
    expect(withBaseHref("<p>hi</p>", "http://api/")).toBe('<base href="http://api/"><p>hi</p>');
    const withBase = '<head><base href="http://elsewhere/"></head>';
    expect(withBaseHref(withBase, "http://api/")).toBe(withBase);
  });
});
