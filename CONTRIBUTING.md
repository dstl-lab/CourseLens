# Contributing to CourseLens

Thanks for your interest in CourseLens! Bug reports, ideas and pull requests are all welcome.

## Reporting a problem or idea

Open an issue and include:

- what you were trying to do, and what happened instead;
- your operating system, Python version (`python --version`) and Node.js version (`node --version`);
- any error message from the backend terminal or the browser.

**Never attach real course materials, solutions, or student information to an issue.** If a problem only happens with your course, describe the folder layout and your `courselens.json` instead, or reproduce it with the demo course in `examples/demo-course/`.

## Setting up for development

Follow the setup steps in the [README](README.md), then install the developer tools:

```bash
cd backend
uv sync --extra dev
```

```bash
cd frontend
npm install
```

## Running the checks

Run these before opening a pull request.

Backend tests and lint (from `backend/`):

```bash
uv run pytest
```

```bash
uv run ruff check app scripts tests
```

Frontend tests, type check, build and lint (from `frontend/`):

```bash
npm test
```

```bash
npm run build
```

```bash
npm run lint
```

## Guidelines

- **No course data in the repository.** Tests and examples must use made-up content, like `examples/demo-course/`. Never commit solutions, autograder tests, exams, rosters or student work.
- **Keep CourseLens course-agnostic.** Anything specific to one course (folder names, schedule, which copy of a file to preview) belongs in that course's `courselens.json`, not in the code. If a new kind of course layout needs a new setting, add it to `backend/app/services/course_config.py` and document it in `docs/courselens-config.md`.
- **Instructors stay in charge.** CourseLens shows what an AI agent proposed and did; it does not apply edits or decide whether they are correct. Please keep new features in that spirit.
- **Styling:** use Tailwind CSS classes rather than inline styles.
- **Dependencies:** open an issue before adding a new package, so we can keep setup simple for instructors.
- **Tests:** add or update tests for the behavior you change.
