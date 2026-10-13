from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app import database
from app.database import Base
from app.main import app
from app.models import Lead


@pytest.fixture(scope="session")
def test_engine() -> Iterator[Engine]:
    url = database.test_database_url
    if (
        url.get_backend_name() != "postgresql"
        or not (url.database or "").endswith("_test")
        or url.database == database.engine.url.database
    ):
        raise pytest.UsageError("Tests require a separate PostgreSQL database ending in _test.")
    engine = create_engine(url, pool_pre_ping=True)
    Base.metadata.create_all(engine)
    with engine.connect() as connection:
        if connection.scalar(select(func.count()).select_from(Lead)):
            raise pytest.UsageError("The test database must not contain leads. Existing data was preserved.")
    yield engine
    engine.dispose()


@pytest.fixture
def db(test_engine: Engine, monkeypatch) -> Iterator[Session]:
    with test_engine.connect() as connection:
        transaction = connection.begin()
        session = Session(bind=connection, join_transaction_mode="create_savepoint")
        # Keep the real request dependency's close/rollback behavior within a test-owned transaction.
        monkeypatch.setattr(database, "Session", lambda _engine: session)
        try:
            yield session
        finally:
            session.close()
            transaction.rollback()


@pytest.fixture
def client(db: Session) -> Iterator[TestClient]:
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client
