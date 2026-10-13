from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import Base, engine
from .models import Discussion, Lead, LeadStatus, utcnow


def seed_data(db: Session) -> bool:
    if db.scalar(select(Lead.id).limit(1)) is not None:
        return False

    now = utcnow()
    records = [
        ("Hank Scorpio", "Globex", "555-0101", LeadStatus.NEW,
         "Inbound lead from website contact form.", now - timedelta(hours=2), None),
        ("Bill Lumbergh", "Initech", "555-0102", LeadStatus.CONTACTED,
         "Left a voicemail with his assistant.", now - timedelta(days=7), now - timedelta(days=1)),
        ("Diana Prince", "Themyscira", "555-0103", LeadStatus.QUALIFIED,
         "Confirmed budget and requirements. Preparing a tailored demo.", now - timedelta(days=1), now + timedelta(days=2)),
        ("Sarah Connor", "Acme Corp", "555-0199", LeadStatus.PROPOSAL_SENT,
         "Sent pricing tier PDF. Said she would review with her boss.", now - timedelta(days=2), now),
        ("Bruce Wayne", "Wayne Ent", "555-0105", LeadStatus.WON,
         "Contract signed! Sending welcome package.", now - timedelta(weeks=3), None),
        ("Tony Stark", "Stark Industries", "555-0106", LeadStatus.LOST,
         "Chose another provider. Thanked us for the proposal.", now - timedelta(days=5), None),
    ]
    for name, company, phone, status, note, discussed_at, follow_up_at in records:
        lead = Lead(
            name=name, company=company, phone=phone, status=status,
            follow_up_at=follow_up_at,
            created_at=discussed_at - timedelta(days=6), updated_at=discussed_at,
        )
        lead.discussions = [
            Discussion(note="Lead created via web form.", created_at=lead.created_at),
            Discussion(
                note="Initial discovery call. Discussed their needs and next steps.",
                created_at=discussed_at - timedelta(days=3),
            ),
            Discussion(note=note, created_at=discussed_at, follow_up_at=follow_up_at),
        ]
        db.add(lead)
    db.commit()
    return True


if __name__ == "__main__":
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        print("Seeded six leads." if seed_data(session) else "Existing leads preserved; seeding skipped.")
