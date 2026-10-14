from datetime import UTC, datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app import leads
from app.models import Discussion, Lead, LeadStatus, utcnow
from app.seed import seed_data


def create_lead(client, **values):
    response = client.post("/api/leads", json={"name": "Sarah Connor", **values})
    assert response.status_code == 201, response.text
    return response.json()


def test_create_and_read_lead(client):
    lead = create_lead(client, name=" Sarah Connor ", company=" Acme Corp ", phone=" +91 555-0199 ")
    assert lead["name"] == "Sarah Connor"
    assert lead["company"] == "Acme Corp"
    assert lead["phone"] == "+91 555-0199"
    assert lead["status"] == "new"
    assert lead["discussions"] == []
    assert lead["follow_up_at"] is None
    assert datetime.fromisoformat(lead["created_at"]).utcoffset() == timedelta(0)
    assert client.get(f"/api/leads/{lead['id']}").json() == lead
    summary = client.get("/api/leads").json()[0]
    assert summary["last_note"] is None
    assert summary["last_discussion_at"] is None
    assert "discussions" not in summary


@pytest.mark.parametrize("optional", [{}, {"company": None, "phone": None}, {"company": "  ", "phone": ""}])
def test_optional_fields_normalize_to_null(client, optional):
    lead = create_lead(client, **optional)
    assert lead["company"] is None
    assert lead["phone"] is None


@pytest.mark.parametrize("payload", [
    {}, {"name": ""}, {"name": "  "}, {"name": None}, {"name": 123},
    {"name": "x" * 201}, {"name": "Valid", "company": "x" * 201},
    {"name": "Valid", "phone": "x" * 51}, {"name": "Valid", "status": "won"},
    {"name": "Valid", "unexpected": True},
])
def test_invalid_lead_payload_is_rejected(client, payload):
    assert client.post("/api/leads", json=payload).status_code == 422
    assert client.get("/api/leads").json() == []


def test_maximum_field_lengths_are_accepted(client):
    lead = create_lead(client, name="x" * 200, company="x" * 200, phone="x" * 50)
    assert len(lead["name"]) == 200
    response = client.post(f"/api/leads/{lead['id']}/discussions", json={"note": "x" * 5000})
    assert response.status_code == 201


@pytest.mark.parametrize("status", list(LeadStatus))
def test_all_status_updates_persist(client, status):
    lead = create_lead(client)
    response = client.patch(f"/api/leads/{lead['id']}", json={"status": status.value})
    assert response.status_code == 200
    assert response.json()["status"] == status.value
    assert client.get(f"/api/leads/{lead['id']}").json()["status"] == status.value
    assert client.get("/api/leads").json()[0]["status"] == status.value


@pytest.mark.parametrize("payload", [{}, {"status": "unknown"}, {"status": None}, {"status": "won", "name": "Changed"}])
def test_invalid_status_update_keeps_existing_state(client, payload):
    lead = create_lead(client)
    assert client.patch(f"/api/leads/{lead['id']}", json=payload).status_code == 422
    assert client.get(f"/api/leads/{lead['id']}").json()["status"] == "new"


@pytest.mark.parametrize("method,path,payload", [
    ("get", "/api/leads/999999", None),
    ("patch", "/api/leads/999999", {"status": "contacted"}),
    ("post", "/api/leads/999999/discussions", {"note": "A discussion"}),
    ("delete", "/api/leads/999999/follow-up", None),
])
def test_missing_lead_returns_404(client, method, path, payload):
    response = client.request(method, path, json=payload)
    assert response.status_code == 404
    assert response.json() == {"detail": "Lead not found."}


def test_non_integer_lead_id_is_rejected(client):
    assert client.get("/api/leads/not-an-id").status_code == 422
    assert client.delete("/api/leads/not-an-id/follow-up").status_code == 422


def test_discussions_and_dashboard_show_latest_note(client):
    lead = create_lead(client)
    path = f"/api/leads/{lead['id']}/discussions"
    first = client.post(path, json={"note": " Initial discovery call. "})
    assert first.status_code == 201
    second = client.post(path, json={"note": "Sent the proposal."})
    assert second.status_code == 201
    history = second.json()["discussions"]
    assert [item["note"] for item in history] == ["Sent the proposal.", "Initial discovery call."]
    assert len(client.get(f"/api/leads/{lead['id']}").json()["discussions"]) == 2
    summary = client.get("/api/leads").json()[0]
    assert summary["last_note"] == "Sent the proposal."
    assert summary["last_discussion_at"] == history[0]["created_at"]


def test_history_and_dashboard_have_deterministic_tie_breaks(client, db):
    instant = utcnow() - timedelta(days=1)
    first = Lead(name="First", created_at=instant)
    second = Lead(name="Second", created_at=instant)
    db.add_all([first, second])
    db.flush()
    first_id, second_id = first.id, second.id
    db.add_all([
        Discussion(lead_id=first_id, note="Earlier ID", created_at=instant),
        Discussion(lead_id=first_id, note="Later ID", created_at=instant),
    ])
    db.commit()
    history = client.get(f"/api/leads/{first_id}").json()["discussions"]
    assert [item["note"] for item in history] == ["Later ID", "Earlier ID"]
    summaries = client.get("/api/leads").json()
    assert [lead["id"] for lead in summaries] == [second_id, first_id]


def test_dashboard_orders_by_activity_and_keeps_histories_separate(client):
    first = create_lead(client, name="First")
    second = create_lead(client, name="Second")
    assert [lead["id"] for lead in client.get("/api/leads").json()] == [second["id"], first["id"]]
    client.post(f"/api/leads/{first['id']}/discussions", json={"note": "Recent call"})
    summaries = client.get("/api/leads").json()
    assert [lead["id"] for lead in summaries] == [first["id"], second["id"]]
    assert summaries[1]["last_note"] is None
    assert client.get(f"/api/leads/{second['id']}").json()["discussions"] == []


@pytest.mark.parametrize("payload", [
    {}, {"note": ""}, {"note": "  "}, {"note": None}, {"note": 123},
    {"note": "x" * 5001}, {"note": "Valid", "unknown": True},
])
def test_invalid_discussion_does_not_write(client, payload):
    lead = create_lead(client)
    assert client.post(f"/api/leads/{lead['id']}/discussions", json=payload).status_code == 422
    assert client.get(f"/api/leads/{lead['id']}").json()["discussions"] == []


def test_follow_up_replacement_preservation_and_utc_conversion(client):
    lead = create_lead(client)
    path = f"/api/leads/{lead['id']}/discussions"
    original = (utcnow() + timedelta(days=1)).astimezone(timezone(timedelta(hours=5, minutes=30)))
    response = client.post(path, json={"note": "Schedule a call", "follow_up_at": original.isoformat()})
    assert response.status_code == 201
    active = response.json()["follow_up_at"]
    assert datetime.fromisoformat(active) == original
    assert datetime.fromisoformat(active).utcoffset() == timedelta(0)
    for payload in [{"note": "A new update"}, {"note": "Another update", "follow_up_at": None}]:
        response = client.post(path, json=payload)
        assert response.status_code == 201
        assert response.json()["follow_up_at"] == active
        assert response.json()["discussions"][0]["follow_up_at"] is None
    replacement = utcnow() + timedelta(days=2)
    response = client.post(path, json={"note": "Reschedule", "follow_up_at": replacement.isoformat()})
    assert response.status_code == 201
    detail = response.json()
    assert datetime.fromisoformat(detail["follow_up_at"]) == replacement
    assert detail["discussions"][-1]["follow_up_at"] == active
    assert datetime.fromisoformat(client.get("/api/leads").json()[0]["follow_up_at"]) == replacement
    closed = client.patch(f"/api/leads/{lead['id']}", json={"status": "won"})
    assert closed.json()["follow_up_at"] == detail["follow_up_at"]


def test_clear_follow_up_preserves_history_and_status(client):
    lead = create_lead(client)
    path = f"/api/leads/{lead['id']}"
    scheduled = client.post(
        f"{path}/discussions",
        json={"note": "Schedule a call", "follow_up_at": (utcnow() + timedelta(days=1)).isoformat()},
    ).json()
    client.patch(path, json={"status": "qualified"})
    response = client.delete(f"{path}/follow-up")
    assert response.status_code == 200
    cleared = response.json()
    assert cleared["follow_up_at"] is None
    assert cleared["status"] == "qualified"
    assert cleared["discussions"] == scheduled["discussions"]
    assert client.get(path).json() == cleared
    assert client.get("/api/leads").json()[0]["follow_up_at"] is None
    assert client.delete(f"{path}/follow-up").json() == cleared
    client.post(f"{path}/discussions", json={"note": "Call completed"})
    assert client.get(path).json()["follow_up_at"] is None
    rescheduled = client.post(
        f"{path}/discussions",
        json={"note": "Next call", "follow_up_at": (utcnow() + timedelta(days=2)).isoformat()},
    )
    assert rescheduled.status_code == 201
    assert rescheduled.json()["follow_up_at"] is not None


def test_failed_clear_follow_up_rolls_back(client, db, monkeypatch):
    lead = create_lead(client)
    path = f"/api/leads/{lead['id']}"
    scheduled = client.post(
        f"{path}/discussions",
        json={"note": "Schedule a call", "follow_up_at": (utcnow() + timedelta(days=1)).isoformat()},
    ).json()

    def fail_commit():
        db.flush()
        raise SQLAlchemyError("private database details must not escape")

    monkeypatch.setattr(db, "commit", fail_commit)
    response = client.delete(f"{path}/follow-up")
    assert response.status_code == 503
    assert "private" not in response.text
    assert client.get(path).json() == scheduled


@pytest.mark.parametrize("follow_up", [
    "not-a-date", "2099-01-01T12:00:00", "2099-01-01", "2000-01-01T00:00:00Z",
    4070908800, "4070908800", True,
])
def test_invalid_follow_up_does_not_write(client, follow_up):
    lead = create_lead(client)
    response = client.post(
        f"/api/leads/{lead['id']}/discussions",
        json={"note": "A call", "follow_up_at": follow_up},
    )
    assert response.status_code == 422
    detail = client.get(f"/api/leads/{lead['id']}").json()
    assert detail["discussions"] == []
    assert detail["follow_up_at"] is None


def test_failed_commit_rolls_back_note_and_follow_up(client, db, monkeypatch):
    lead = create_lead(client)
    original = utcnow() + timedelta(days=1)
    client.post(
        f"/api/leads/{lead['id']}/discussions",
        json={"note": "Original", "follow_up_at": original.isoformat()},
    )

    def fail_commit():
        db.flush()
        raise SQLAlchemyError("private database details must not escape")

    monkeypatch.setattr(db, "commit", fail_commit)
    response = client.post(
        f"/api/leads/{lead['id']}/discussions",
        json={"note": "Should roll back", "follow_up_at": (original + timedelta(days=1)).isoformat()},
    )
    assert response.status_code == 503
    assert "private" not in response.text
    detail = client.get(f"/api/leads/{lead['id']}").json()
    assert [note["note"] for note in detail["discussions"]] == ["Original"]
    assert datetime.fromisoformat(detail["follow_up_at"]) == original


def test_unexpected_error_is_generic(client, monkeypatch):
    def fail_lookup(*args):
        raise RuntimeError("private server details")

    monkeypatch.setattr(leads, "find_lead", fail_lookup)
    response = client.get("/api/leads/1")
    assert response.status_code == 500
    assert response.json() == {"detail": "Something went wrong. Please try again."}


def test_health_and_database_failure(client, db, monkeypatch):
    assert client.get("/api/health").json() == {"status": "ok"}

    def fail_execute(*args, **kwargs):
        raise SQLAlchemyError("private connection details")

    monkeypatch.setattr(db, "execute", fail_execute)
    response = client.get("/api/health")
    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}


def test_database_enforces_status_constraint_and_discussion_foreign_key(db):
    with pytest.raises(IntegrityError):
        db.execute(text("INSERT INTO leads (name, status, created_at, updated_at) VALUES ('Bad', 'invalid', now(), now())"))
    db.rollback()
    db.add(Discussion(lead_id=999999, note="Missing parent"))
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()


def test_seed_data_is_complete_and_idempotent(client, db):
    before = utcnow()
    assert seed_data(db) is True
    summaries = client.get("/api/leads").json()
    assert len(summaries) == 6
    assert {lead["status"] for lead in summaries} == {status.value for status in LeadStatus}
    due_dates = [datetime.fromisoformat(lead["follow_up_at"]) for lead in summaries if lead["follow_up_at"]]
    assert any(due < before - timedelta(hours=12) for due in due_dates)
    assert any(before <= due <= utcnow() for due in due_dates)
    assert any(due > utcnow() for due in due_dates)
    for lead in summaries:
        assert len(client.get(f"/api/leads/{lead['id']}").json()["discussions"]) == 3
    note_count = db.scalar(select(func.count()).select_from(Discussion))
    assert seed_data(db) is False
    assert client.get("/api/leads").json() == summaries
    assert db.scalar(select(func.count()).select_from(Discussion)) == note_count


def test_seed_data_preserves_existing_user_records(client, db):
    lead = create_lead(client, name="User lead")
    assert seed_data(db) is False
    summaries = client.get("/api/leads").json()
    assert len(summaries) == 1
    assert summaries[0]["id"] == lead["id"]
