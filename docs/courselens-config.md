# Setting up CourseLens for your course (`courselens.json`)

CourseLens reads your course materials from one folder on your computer, the **course folder**. You tell the backend where it is with `COURSE_REVIEW_ROOT` in `backend/.env`:

```env
COURSE_REVIEW_ROOT=/Users/zara/courses/cs101
```

Everything else is optional. To control how your course appears, put a file named **`courselens.json`** in the top level of the course folder. This page explains every setting.

> **The quickest start:** run the starter script. It writes a `courselens.json` with a *guessed* weekly schedule for you to correct:
>
> ```bash
> cd backend
> uv run python -m scripts.init_course_config --weeks 15
> ```
>
> Use `--weeks 10` for a quarter. Add `--dry-run` to print the draft without saving it. The script never overwrites an existing file unless you add `--force`.

---

## What CourseLens does without a settings file

- **Files it shows:** notebooks (`.ipynb`), web pages (`.html`, `.htm`), Markdown (`.md`), Quarto and R Markdown (`.qmd`, `.rmd`), LaTeX (`.tex`) and PDFs. It searches every folder except hidden ones (names starting with `.`) and a few tool folders (`node_modules`, `__pycache__`, `venv`, `_site`). `README` and `LICENSE` files are skipped.
- **Kinds of material:** it recognizes common folder and file names (table below). Anything else is labeled `other`.
- **Weeks:** a file goes in a week only if its path names one (`week03/`, `Week-3`, `wk3`). **Everything else is "Unscheduled".** CourseLens does not guess weeks from file numbers inside the app, because a wrong guess looks just like a right one. Use the `schedule` setting, or the starter script, to place files.
- **Copies of the same item** (a notebook and its HTML version, a student and a solution version, copies in a public and a private repository) are shown together as one card. For example, `homeworks/hw1/src/hw1.ipynb` and `public/homeworks/hw1/hw1.html` are both "hw1".
- **Previews:** HTML files are shown as they are. Notebooks are converted to a web page automatically the first time you open them, and nothing is written into your course folder.

| Kind | Recognized folder and file names (examples) |
|---|---|
| `lecture` | `lectures/`, `slides/`, `notes/`, `lec03.ipynb`, `Lecture 3.pdf` |
| `homework` | `homeworks/`, `assignments/`, `psets/`, `problem-sets/`, `hw1/`, `assignment-2.ipynb` |
| `lab` | `labs/`, `lab1/`, `lab-02.ipynb` |
| `quiz` | `quizzes/`, `quiz3.ipynb` |
| `exam` | `exams/`, `midterm/`, `final/`, `exam-1.tex` |
| `project` | `projects/`, `project2/`, `final_project/` |
| `discussion` | `discussion/`, `sections/`, `recitations/`, `worksheets/`, `disc01/` |
| `schedule` | `syllabus.md`, `schedule.md`, `calendar.md` |

---

## Settings

All settings are optional. A complete example is in [`examples/courselens.example.json`](examples/courselens.example.json).

```json
{
  "name": "Intro to Programming (Spring 2027)",
  "weeks": 15,
  "schedule": [
    { "week": 1, "files": ["lecture01", "lecture02"] },
    { "week": 2, "files": ["lecture03", "hw1"] },
    { "week": 8, "files": ["exams/midterm/**"] }
  ]
}
```

| Setting | What it does | Example |
|---|---|---|
| `name` | Course name shown at the top of Course Review. | `"CS 101 (Fall 2026)"` |
| `weeks` | Length of the term. The timeline shows this many week columns. | `10` for a quarter, `15` for a semester |
| `schedule` | Which week each item is taught or released. See [Schedule](#schedule). | |
| `extensions` | File types to show. Add `".py"` to include autograder tests and scripts. This replaces the default list. | `[".ipynb", ".html", ".md", ".pdf", ".py"]` |
| `exclude` | Folders or files to hide. | `["data", "scratch", "**/old/**"]` |
| `include` | If set, *only* files matching these patterns are shown. | `["lectures", "homeworks", "exams"]` |
| `types` | Add your own kinds of material, or reassign folder names. Yours are checked before the built-in ones. | `{ "studio": ["studios", "studio*"] }` |
| `repos` | Sub-folders that are separate repositories (for example, public and private). Detected automatically when each one is a Git repository. | `["cs101-public", "cs101-private"]` |
| `prefer` | When an item has several copies, which copy to show first. Earlier patterns win. | `["*-private/**/src/**", "*-public/**"]` |
| `stable_preview_types` | For these kinds, always preview the preferred copy, even when a change targets another copy (for example, preview the full solution notebook for every homework change). | `["homework", "lab"]` |

If the file has a mistake (for example, a missing comma), Course Review shows a yellow warning and uses the defaults until you fix it.

### Schedule

Each entry lists the items for one week. An item can be written as:

- **its name**: `"lec03"`, `"hw1"`, `"Lecture 02"`. Matching ignores capital letters, spaces, `-`, `_` and leading zeros, so `"lec3"` also matches `lec03.ipynb`. Every copy of the item is placed in that week.
- **a pattern**: `"exams/midterm/**"` (everything in that folder), `"quiz1*"` (quiz1a, quiz1b, …), or `"syllabus"`.

```json
"schedule": [
  { "week": 1, "files": ["lec01", "lec02", "lab0"] },
  { "week": 3, "files": ["lec05", "lec06", "hw1", "quiz1*"] },
  { "week": 10, "files": ["exams/final/**"] }
]
```

Items not listed anywhere appear in the **Unscheduled** column, so nothing is hidden.

### Patterns

Patterns work like `.gitignore` patterns:

- A pattern **without** `/` matches a folder or file name anywhere: `data`, `hw*`, `lec0[1-5]`.
- A pattern **with** `/` matches from the top of the course folder: `exams/midterm/**`, `*-private/homeworks/**/src/**`.
- `*` matches any characters within a name, `**` matches across folders, and `[0-9]` matches one character from a range.

---

## Pre-building previews (optional)

Notebook previews are created on demand. For very large courses you can create them all ahead of time. This writes an `.html` file next to each notebook that doesn't have one, and never overwrites existing files:

```bash
cd backend
uv run python -m scripts.build_previews
```

## Example: a course kept in several repositories

Some courses keep each item in more than one repository: a private one with solutions (`cs101-private`), a public one students download (`cs101-public`), and a course website (`cs101-website`). Put all three in one course folder and add:

```json
{
  "weeks": 10,
  "exclude": ["data", "images"],
  "prefer": [
    "*-private/homeworks/**/src/**",
    "*-private/labs/**/src/**",
    "*-public/**",
    "*-private/**",
    "*-website/**"
  ],
  "stable_preview_types": ["homework", "lab"]
}
```

Each homework and lab card then opens the private source notebook first, previews stay on that full notebook even when a change targets the public copy, and everything else opens the public copy first.
