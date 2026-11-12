import { describe, expect, it } from "vitest";
import {
  buildCourseArtifacts,
  findArtifactForChange,
  previewPathForChanges,
} from "../utils/courseArtifacts";
import type { CourseChange } from "../types/changes";
import type { RepoFile } from "../store/courseStore";

/**
 * The rank the backend computes from the "prefer" list in the multi-repository
 * example in docs/courselens-config.md: private homework/lab sources, then
 * public, private, and website copies; build output ranks last within each
 * group.
 */
function multiRepoPreferRank(path: string): number {
  const generated = /\/(build|rebuild)\//.test(path) ? 1 : 0;
  const rules = [
    /^[^/]*-private\/homeworks\/.*\/src\//,
    /^[^/]*-private\/labs\/.*\/src\//,
    /^[^/]*-public\//,
    /^[^/]*-private\//,
    /^[^/]*-website\//,
  ];
  const idx = rules.findIndex((rule) => rule.test(path));
  return (idx === -1 ? rules.length : idx) * 2 + generated;
}

const STABLE_PREVIEW_TYPES = ["homework", "lab"];

function repoFile(path: string, repo: string, fileType = "homework"): RepoFile {
  const filename = path.split("/").pop() ?? path;
  return {
    filename,
    path,
    repo,
    stem: filename.replace(/\.[^.]+$/, ""),
    fileType,
    content: null,
    preferRank: multiRepoPreferRank(path),
    previewPath: path.endsWith(".ipynb") ? path.replace(/\.ipynb$/, ".html") : null,
  };
}

const repoFiles: RepoFile[] = [
  {
    filename: "lec01.ipynb",
    path: "course-private/lectures/lec01/lec01.ipynb",
    repo: "course-private",
    stem: "lec01",
    fileType: "lecture",
    content: "{}",
    previewPath: "course-private/lectures/lec01/lec01.html",
  },
  {
    filename: "lec01.html",
    path: "course-private/lectures/lec01/lec01.html",
    repo: "course-private",
    stem: "lec01",
    fileType: "lecture",
    content: "<h1>Lecture 1</h1>",
  },
  {
    filename: "lec01.md",
    path: "course-website/resources/lectures/lec01.md",
    repo: "course-website",
    stem: "lec01",
    fileType: "lecture",
    content: "# Lecture 1",
  },
];

describe("courseArtifacts", () => {
  it("groups ipynb/html variants into one displayed artifact and prefers html preview", () => {
    const artifacts = buildCourseArtifacts(repoFiles);

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({
      id: "lectures/lec01",
      displayName: "lec01",
      primaryPath: "course-private/lectures/lec01/lec01.ipynb",
      previewPath: "course-private/lectures/lec01/lec01.html",
      fileType: "lecture",
    });
    expect(artifacts[0].variants.map((v) => v.path)).toEqual([
      "course-private/lectures/lec01/lec01.ipynb",
      "course-private/lectures/lec01/lec01.html",
      "course-website/resources/lectures/lec01.md",
    ]);
  });

  it("matches a change that references an ipynb path to the html-preview artifact", () => {
    const artifacts = buildCourseArtifacts(repoFiles);
    const change = {
      file: "lec01.ipynb",
      filePath: "course-private/lectures/lec01/lec01.ipynb",
    } as CourseChange;

    const artifact = findArtifactForChange(change, artifacts);

    expect(artifact?.displayName).toBe("lec01");
    expect(artifact?.previewPath).toBe("course-private/lectures/lec01/lec01.html");
  });

  it("collapses public, source, build, and rebuild homework variants into the private source artifact", () => {
    const files = [
      repoFile(
        "course-private/homeworks/hw1/build/autograder/hw1.ipynb",
        "course-private",
      ),
      repoFile(
        "course-private/homeworks/hw1/build/autograder/hw1.html",
        "course-private",
      ),
      repoFile(
        "course-private/homeworks/hw1/build/student/hw1.ipynb",
        "course-private",
      ),
      repoFile(
        "course-private/homeworks/hw1/build/student/hw1.html",
        "course-private",
      ),
      repoFile(
        "course-private/homeworks/hw1/rebuild/autograder/hw1.ipynb",
        "course-private",
      ),
      repoFile(
        "course-private/homeworks/hw1/rebuild/autograder/hw1.html",
        "course-private",
      ),
      repoFile(
        "course-private/homeworks/hw1/rebuild/student/hw1.ipynb",
        "course-private",
      ),
      repoFile(
        "course-private/homeworks/hw1/rebuild/student/hw1.html",
        "course-private",
      ),
      repoFile("course-private/homeworks/hw1/src/hw1.ipynb", "course-private"),
      repoFile("course-private/homeworks/hw1/src/hw1.html", "course-private"),
      repoFile("course-public/homeworks/hw1/hw1.ipynb", "course-public"),
      repoFile("course-public/homeworks/hw1/hw1.html", "course-public"),
    ];

    const artifacts = buildCourseArtifacts(files);

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({
      id: "homeworks/hw1",
      displayName: "hw1",
      primaryPath: "course-private/homeworks/hw1/src/hw1.ipynb",
      previewPath: "course-private/homeworks/hw1/src/hw1.html",
      repo: "course-private",
    });
    expect(artifacts[0].variants).toHaveLength(12);
  });

  it("falls back to private source files when no public artifact exists", () => {
    const files = [
      repoFile(
        "course-private/homeworks/hw1/build/student/hw1.ipynb",
        "course-private",
      ),
      repoFile(
        "course-private/homeworks/hw1/build/student/hw1.html",
        "course-private",
      ),
      repoFile("course-private/homeworks/hw1/src/hw1.ipynb", "course-private"),
      repoFile("course-private/homeworks/hw1/src/hw1.html", "course-private"),
    ];

    const [artifact] = buildCourseArtifacts(files);

    expect(artifact).toMatchObject({
      id: "homeworks/hw1",
      primaryPath: "course-private/homeworks/hw1/src/hw1.ipynb",
      previewPath: "course-private/homeworks/hw1/src/hw1.html",
      repo: "course-private",
    });
  });

  it("maps changes that target build paths to the stable private homework preview", () => {
    const files = [
      repoFile(
        "course-private/homeworks/hw1/build/autograder/hw1.ipynb",
        "course-private",
      ),
      repoFile("course-private/homeworks/hw1/src/hw1.ipynb", "course-private"),
      repoFile("course-private/homeworks/hw1/src/hw1.html", "course-private"),
      repoFile("course-public/homeworks/hw1/hw1.ipynb", "course-public"),
      repoFile("course-public/homeworks/hw1/hw1.html", "course-public"),
    ];
    const artifacts = buildCourseArtifacts(files);
    const change = {
      file: "hw1.ipynb",
      filePath: "course-private/homeworks/hw1/build/autograder/hw1.ipynb",
    } as CourseChange;

    const artifact = findArtifactForChange(change, artifacts);

    expect(artifact?.primaryPath).toBe("course-private/homeworks/hw1/src/hw1.ipynb");
    expect(artifact?.previewPath).toBe("course-private/homeworks/hw1/src/hw1.html");
  });

  it("uses private source homework previews even when public previews exist", () => {
    const files = [
      repoFile("course-public/homeworks/hw1/hw1.ipynb", "course-public"),
      repoFile("course-public/homeworks/hw1/hw1.html", "course-public"),
      repoFile("course-private/homeworks/hw1/src/hw1.ipynb", "course-private"),
      repoFile("course-private/homeworks/hw1/src/hw1.html", "course-private"),
    ];

    const [artifact] = buildCourseArtifacts(files);

    expect(artifact.primaryPath).toBe("course-private/homeworks/hw1/src/hw1.ipynb");
    expect(artifact.previewPath).toBe("course-private/homeworks/hw1/src/hw1.html");
  });

  it("keeps homework preview stable on the private source html even when a change references build output", () => {
    const files = [
      repoFile("course-public/homeworks/hw2/hw2.ipynb", "course-public"),
      repoFile("course-public/homeworks/hw2/hw2.html", "course-public"),
      repoFile("course-private/homeworks/hw2/src/hw2.ipynb", "course-private"),
      repoFile("course-private/homeworks/hw2/src/hw2.html", "course-private"),
      repoFile("course-private/homeworks/hw2/build/autograder/hw2.ipynb", "course-private"),
      repoFile("course-private/homeworks/hw2/build/autograder/hw2.html", "course-private"),
    ];
    const [artifact] = buildCourseArtifacts(files);
    const change = {
      file: "hw2.ipynb",
      filePath: "course-private/homeworks/hw2/build/autograder/hw2.ipynb",
    } as CourseChange;

    expect(previewPathForChanges(artifact, [change], STABLE_PREVIEW_TYPES)).toBe(
      "course-private/homeworks/hw2/src/hw2.html",
    );
    // Without stable_preview_types the preview follows the copy the change targets.
    expect(previewPathForChanges(artifact, [change])).toBe(
      "course-private/homeworks/hw2/build/autograder/hw2.html",
    );
  });

  it("collapses public, source, and build lab variants into the private source artifact", () => {
    const files = [
      repoFile("course-public/labs/lab1/lab1.ipynb", "course-public", "lab"),
      repoFile("course-public/labs/lab1/lab1.html", "course-public", "lab"),
      repoFile("course-private/labs/lab1/src/lab1.ipynb", "course-private", "lab"),
      repoFile("course-private/labs/lab1/src/lab1.html", "course-private", "lab"),
      repoFile("course-private/labs/lab1/build/autograder/lab1.ipynb", "course-private", "lab"),
      repoFile("course-private/labs/lab1/build/autograder/lab1.html", "course-private", "lab"),
    ];

    const [artifact] = buildCourseArtifacts(files);

    expect(artifact).toMatchObject({
      id: "labs/lab1",
      displayName: "lab1",
      primaryPath: "course-private/labs/lab1/src/lab1.ipynb",
      previewPath: "course-private/labs/lab1/src/lab1.html",
      repo: "course-private",
    });
  });

  it("keeps lab preview stable on the private source html even when a change references build output", () => {
    const files = [
      repoFile("course-public/labs/lab2/lab2.ipynb", "course-public", "lab"),
      repoFile("course-public/labs/lab2/lab2.html", "course-public", "lab"),
      repoFile("course-private/labs/lab2/src/lab2.ipynb", "course-private", "lab"),
      repoFile("course-private/labs/lab2/src/lab2.html", "course-private", "lab"),
      repoFile("course-private/labs/lab2/build/autograder/lab2.ipynb", "course-private", "lab"),
      repoFile("course-private/labs/lab2/build/autograder/lab2.html", "course-private", "lab"),
    ];
    const [artifact] = buildCourseArtifacts(files);
    const change = {
      file: "lab2.ipynb",
      filePath: "course-private/labs/lab2/build/autograder/lab2.ipynb",
    } as CourseChange;

    expect(previewPathForChanges(artifact, [change], STABLE_PREVIEW_TYPES)).toBe(
      "course-private/labs/lab2/src/lab2.html",
    );
  });

  it("groups by the backend's artifact id across differently named folders", () => {
    const files: RepoFile[] = [
      { filename: "a1.ipynb", path: "assignments/a1/a1.ipynb", fileType: "homework", artifactId: "homework/a1", week: 3 },
      { filename: "a1.html", path: "assignments/a1/a1.html", fileType: "homework", artifactId: "homework/a1", week: 3 },
      { filename: "q1.py", path: "assignments/a1/tests/q1.py", fileType: "homework", artifactId: "homework/a1", week: 3 },
      { filename: "Lecture 02.pdf", path: "slides/Lecture 02.pdf", fileType: "lecture", artifactId: "lecture/lecture2", week: null },
    ];

    const artifacts = buildCourseArtifacts(files);

    expect(artifacts.map((a) => a.id)).toEqual(["homework/a1", "lecture/lecture2"]);
    expect(artifacts[0]).toMatchObject({
      primaryPath: "assignments/a1/a1.ipynb",
      previewPath: "assignments/a1/a1.html",
      week: 3,
    });
    expect(artifacts[0].variants).toHaveLength(3);
    expect(artifacts[1].week).toBeNull();
  });

  it("prefers the copy named after the item over helper notebooks in the same folder", () => {
    const files: RepoFile[] = [
      { filename: "world_population.ipynb", path: "labs/lab1/data_prep/world_population.ipynb", fileType: "lab", artifactId: "lab/lab1" },
      { filename: "lab1.ipynb", path: "labs/lab1/lab1.ipynb", fileType: "lab", artifactId: "lab/lab1" },
    ];

    const [artifact] = buildCourseArtifacts(files);

    expect(artifact.primaryPath).toBe("labs/lab1/lab1.ipynb");
    expect(artifact.displayName).toBe("lab1");
  });

  it("prefers hand-written sources over build output when no ranks are configured", () => {
    const files: RepoFile[] = [
      { filename: "hw1.ipynb", path: "hw1/_build/hw1.ipynb", fileType: "homework" },
      { filename: "hw1.ipynb", path: "hw1/hw1.ipynb", fileType: "homework" },
    ].map((file) => ({ ...file, artifactId: "homework/hw1" }));

    expect(buildCourseArtifacts(files)[0].primaryPath).toBe("hw1/hw1.ipynb");
  });

  it("matches changes whose paths are relative to one repository inside the course folder", () => {
    const artifacts = buildCourseArtifacts([
      { filename: "lec05.ipynb", path: "course-public/lectures/lec05/lec05.ipynb", fileType: "lecture", artifactId: "lecture/lec5" },
    ]);
    const change = { file: "lec05.ipynb", filePath: "lectures/lec05/lec05.ipynb" } as CourseChange;

    expect(findArtifactForChange(change, artifacts)?.id).toBe("lecture/lec5");
  });
});
