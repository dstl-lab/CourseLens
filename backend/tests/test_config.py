from pathlib import Path

from app.config import BACKEND_ENV_FILE, Settings


class TestConfig:
    def test_defaults(self):
        s = Settings(_env_file=None)
        assert s.ALLOWED_ORIGINS == "http://localhost:5173"
        assert s.COURSE_REVIEW_ROOT is None

    def test_allowed_origins_split(self):
        s = Settings(
            ALLOWED_ORIGINS="http://localhost:5173, https://app.example.org",
            _env_file=None,
        )
        assert s.allowed_origins == [
            "http://localhost:5173",
            "https://app.example.org",
        ]

    def test_loads_from_env_vars(self, monkeypatch):
        monkeypatch.setenv("COURSE_REVIEW_ROOT", "/courses/cs101")
        s = Settings(_env_file=None)
        assert s.COURSE_REVIEW_ROOT == "/courses/cs101"

    def test_ignores_settings_from_older_env_files(self, tmp_path: Path):
        env_file = tmp_path / ".env"
        env_file.write_text(
            "COURSE_REVIEW_ROOT=my-course\nRETIRED_SETTING=old-value\nANOTHER_OLD_SETTING=x\n",
            encoding="utf-8",
        )
        s = Settings(_env_file=env_file)
        assert s.COURSE_REVIEW_ROOT == "my-course"

    def test_env_file_path_is_backend_local(self):
        assert BACKEND_ENV_FILE.is_absolute()
        assert BACKEND_ENV_FILE.name == ".env"
        assert BACKEND_ENV_FILE.parent.name == "backend"
