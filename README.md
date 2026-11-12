# CourseLens

**Review AI-proposed changes to your course materials before students see them.**

CourseLens is for instructors who use an AI coding agent (such as Claude Code or OpenAI Codex) to update a programming or data science course. It lays out the agent's suggested edits in the order your course is taught, shows each edit in the student-facing material, and shows which files the agent changed, checked, or never opened. It accompanies the paper *"The Edit Is Not the End: CourseLens for Reviewing AI-Proposed Course Updates."*

## What it does

- **Course-order timeline:** files are grouped by the week they're taught.
- **Side-by-side preview:** see each proposed change highlighted in the rendered lecture or assignment.
- **File review analysis:** upload the agent's activity log to see files it **suggested changes** to, **checked** without changing, or **never checked**.
- **Review and follow up:** mark each change **Needs review**, **Approved**, or **Removed**, tag files to revisit, and see everything in a **Summary**.

CourseLens never edits your files and doesn't judge whether a change is correct; you do.

## Setup

You need [Python 3.11+](https://www.python.org/downloads/), [uv](https://docs.astral.sh/uv/getting-started/installation/), [Node.js 20.19+](https://nodejs.org/), [Git](https://git-scm.com/downloads), and your course materials in a folder on your computer. No AI service or API key is needed.

**1. Download**

```bash
git clone https://github.com/dstl-lab/CourseLens.git
cd CourseLens
```

**2. Install the backend**

```bash
cd backend
cp .env.example .env
uv sync
```

Open `backend/.env` and set your course folder:

```env
COURSE_REVIEW_ROOT=/Users/zara/courses/my-course
```

**3. Install the frontend** (in a second terminal, from the CourseLens folder)

```bash
cd frontend
npm install
```

**4. Add your schedule** (recommended; from the `backend` folder)

```bash
uv run python -m scripts.init_course_config --weeks 15
```

This creates `courselens.json` in your course folder with guessed weeks. Open it and fix the weeks, for example `{ "week": 3, "files": ["lec05", "hw1"] }`. Files without a week appear under **Unscheduled**. See [docs/courselens-config.md](docs/courselens-config.md) for all settings.

**5. Start CourseLens** (keep both running)

```bash
uv run uvicorn app.main:app
```

```bash
npm run dev
```

Run the first in the `backend` folder and the second in the `frontend` folder, then open **http://localhost:5173**.

## How to use it

1. **Get suggestions from your AI agent.** Run your agent in your course folder and add the instructions from [docs/course-change-preview-agent-prompt.md](docs/course-change-preview-agent-prompt.md) to your request, so it returns its suggestions in CourseLens format.
2. **Paste them** into **Paste generated suggestions** and click **Review changes**.
3. **Upload the activity log** (optional) with **Upload .jsonl**:
   - Claude Code: `~/.claude/projects/<course-folder-name>/<session-id>.jsonl`
   - Codex: `~/.codex/sessions/<year>/<month>/<day>/rollout-….jsonl`
4. **Review:** click **View** on a file to see its changes in context, set each change's status, and **⚐ Tag** files that need follow-up, especially those under **Not checked**.
5. **Finish** with **Summary**.

## Try the demo

Set `COURSE_REVIEW_ROOT=../examples/demo-course` in `backend/.env`, start CourseLens, paste [examples/demo-course-suggestions.json](examples/demo-course-suggestions.json), and upload [examples/demo-course-agent-log.jsonl](examples/demo-course-agent-log.jsonl). Under **Not checked**, notice **studio03**: the agent missed it.

## Good to know

- Everything runs on your computer and nothing is uploaded. Don't run CourseLens on a public server: it serves your whole course folder.
- Review decisions are saved only in your browser.
- Activity logs from Claude Code and Codex are supported.
- Changes inside PDFs can't be highlighted.

| Problem | Fix |
|---|---|
| "No course folder is set" | Set `COURSE_REVIEW_ROOT` in `backend/.env` and restart the backend. |
| "Couldn't reach the CourseLens backend" | Start the backend (step 5). |
| Files in the wrong week or missing | Edit `courselens.json` ([settings](docs/courselens-config.md)) and reload. |

## How to cite

Andrew Hudson Yang, Susana Haing, Thaarak Sriram, Chengyun Xu, Zhiqing Wang, and Sam Lau. 2027. [The Edit Is Not the End: CourseLens for Reviewing AI-Proposed Course Updates](https://doi.org/10.1145/3857222.3860230). In *Proceedings of the 58th ACM Technical Symposium on Computer Science Education V.1* (SIGCSE TS 2027).

## Authors and acknowledgments

CourseLens was created by researchers at the University of California, San Diego:

| Name | Email |
|---|---|
| Andrew Hudson Yang | any012@ucsd.edu |
| Susana Haing | shaing@ucsd.edu |
| Thaarak Sriram | tsriram@ucsd.edu |
| Chengyun Xu | chx023@ucsd.edu |
| Zhiqing Wang | zhw131@ucsd.edu |
| Sam Lau | lau@ucsd.edu |

## License

[MIT](LICENSE). Everything in [`examples/`](examples/) is made up and covered by the same license.
