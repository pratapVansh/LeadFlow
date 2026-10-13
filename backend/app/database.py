import os
from collections.abc import Iterator
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, Session


class Base(DeclarativeBase):
    pass


load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False, interpolate=False)


def required(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} is required. Configure the root .env or process environment.")
    return value


def port(name: str) -> int:
    try:
        value = int(required(name))
    except ValueError:
        raise RuntimeError(f"{name} must be an integer between 1 and 65535.") from None
    if not 1 <= value <= 65535:
        raise RuntimeError(f"{name} must be an integer between 1 and 65535.")
    return value


database_url = URL.create(
    "postgresql+psycopg",
    username=required("POSTGRES_USER"),
    password=required("POSTGRES_PASSWORD"),
    host=os.getenv("POSTGRES_HOST", "localhost"),
    port=port("POSTGRES_PORT"),
    database=required("POSTGRES_DB"),
)
test_database_url = database_url.set(database=required("POSTGRES_TEST_DB"))
engine = create_engine(database_url, pool_pre_ping=True)


def get_db() -> Iterator[Session]:
    with Session(engine) as session:
        try:
            yield session
        except Exception:
            session.rollback()
            raise
