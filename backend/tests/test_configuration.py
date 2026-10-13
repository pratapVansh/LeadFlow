import os
import json
import subprocess
import sys
from pathlib import Path

import pytest


def run_configuration(tmp_path: Path, file_settings=None, process_settings=None):
    app_path = tmp_path / "backend" / "app"
    app_path.mkdir(parents=True)
    source = Path(__file__).resolve().parents[1] / "app" / "database.py"
    module = app_path / "database.py"
    module.write_text(source.read_text(encoding="utf-8"), encoding="utf-8")
    if file_settings is not None:
        (tmp_path / ".env").write_text(
            "\n".join(f"{key}={json.dumps(value)}" for key, value in file_settings.items()), encoding="utf-8",
        )
    environment = os.environ.copy()
    for key in list(environment):
        if key.startswith("POSTGRES_") or key in {"DATABASE_URL", "TEST_DATABASE_URL", "BACKEND_PORT"}:
            del environment[key]
    environment.update(process_settings or {})
    return subprocess.run(
        [sys.executable, "-c", "import json,runpy,sys; m=runpy.run_path(sys.argv[1]); u=m['engine'].url; print(json.dumps(dict(host=u.host,port=u.port,user=u.username,password=u.password,database=u.database,test_database=m['test_database_url'].database,backend_port=m['port']('BACKEND_PORT'))))", str(module)],
        env=environment, cwd=tmp_path, text=True, capture_output=True, check=False,
    )


@pytest.fixture
def settings():
    return {"POSTGRES_USER": "local", "POSTGRES_PASSWORD": "p@ss:/$#%${literal}",
            "POSTGRES_DB": "leads", "POSTGRES_TEST_DB": "leads_test",
            "POSTGRES_PORT": "5533", "BACKEND_PORT": "8300"}


@pytest.mark.parametrize("overrides,host,port,user", [
    ({}, "localhost", 5533, "local"),
    ({"POSTGRES_HOST": "db", "POSTGRES_PORT": "5432"}, "db", 5432, "local"),
    ({"POSTGRES_USER": "process"}, "localhost", 5533, "process"),
])
def test_shared_settings_and_runtime_mapping(tmp_path, settings, overrides, host, port, user):
    result = run_configuration(tmp_path, settings, overrides)
    assert result.returncode == 0, result.stderr
    actual = json.loads(result.stdout)
    assert actual == {"host": host, "port": port, "user": user,
                      "password": settings["POSTGRES_PASSWORD"], "database": "leads",
                      "test_database": "leads_test", "backend_port": 8300}


def test_missing_root_configuration_fails(tmp_path):
    result = run_configuration(tmp_path)
    assert result.returncode != 0
    assert "POSTGRES_USER is required" in result.stderr


@pytest.mark.parametrize("key", ["POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB", "POSTGRES_TEST_DB", "POSTGRES_PORT", "BACKEND_PORT"])
def test_empty_process_setting_does_not_fall_back(tmp_path, settings, key):
    result = run_configuration(tmp_path, settings, {key: ""})
    assert result.returncode != 0
    assert f"{key} is required" in result.stderr


@pytest.mark.parametrize("value", ["invalid", "0", "65536"])
def test_invalid_port_rejected(tmp_path, settings, value):
    result = run_configuration(tmp_path, settings, {"POSTGRES_PORT": value})
    assert result.returncode != 0
    assert "POSTGRES_PORT must be an integer between 1 and 65535" in result.stderr
