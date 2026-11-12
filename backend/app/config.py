from pathlib import Path

from pydantic_settings import BaseSettings

BACKEND_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    ALLOWED_ORIGINS: str = "http://localhost:5173"
    # Folder containing the course materials CourseLens reads. Relative
    # paths are resolved against the backend folder. A COURSE_REVIEW_ROOT
    # environment variable takes precedence over the value in backend/.env.
    COURSE_REVIEW_ROOT: str | None = None

    # "ignore": older backend/.env files may still list settings that this
    # version no longer uses.
    model_config = {
        "env_file": BACKEND_ENV_FILE,
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]


settings = Settings()
