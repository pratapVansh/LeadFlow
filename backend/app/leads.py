from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .database import get_db
from .models import Discussion, Lead, utcnow
from .schemas import DiscussionCreate, LeadCreate, LeadDetail, LeadRead, LeadSummary, StatusUpdate

router = APIRouter(prefix="/api/leads", tags=["leads"])
Database = Annotated[Session, Depends(get_db)]


def find_lead(db: Session, lead_id: int) -> Lead:
    lead = db.scalar(
        select(Lead).where(Lead.id == lead_id).options(selectinload(Lead.discussions))
    )
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead not found.")
    return lead


@router.get("", response_model=list[LeadSummary])
def list_leads(db: Database) -> list[LeadSummary]:
    # shortcut: eagerly load histories for a small assessment dataset; query latest notes when adding pagination.
    leads = db.scalars(select(Lead).options(selectinload(Lead.discussions))).all()
    summaries = []
    for lead in leads:
        latest = lead.discussions[0] if lead.discussions else None
        summaries.append(
            LeadSummary(
                **LeadRead.model_validate(lead).model_dump(),
                last_note=latest.note if latest else None,
                last_discussion_at=latest.created_at if latest else None,
            )
        )
    return sorted(
        summaries,
        key=lambda lead: (lead.last_discussion_at or lead.created_at, lead.id),
        reverse=True,
    )


@router.post("", response_model=LeadDetail, status_code=201)
def create_lead(body: LeadCreate, db: Database) -> Lead:
    lead = Lead(**body.model_dump())
    db.add(lead)
    db.commit()
    return find_lead(db, lead.id)


@router.get("/{lead_id}", response_model=LeadDetail)
def get_lead(lead_id: int, db: Database) -> Lead:
    return find_lead(db, lead_id)


@router.patch("/{lead_id}", response_model=LeadDetail)
def update_status(lead_id: int, body: StatusUpdate, db: Database) -> Lead:
    lead = find_lead(db, lead_id)
    lead.status = body.status
    db.commit()
    return find_lead(db, lead_id)


@router.post("/{lead_id}/discussions", response_model=LeadDetail, status_code=201)
def add_discussion(lead_id: int, body: DiscussionCreate, db: Database) -> Lead:
    lead = find_lead(db, lead_id)
    db.add(Discussion(lead_id=lead.id, **body.model_dump()))
    if body.follow_up_at is not None:
        lead.follow_up_at = body.follow_up_at
    lead.updated_at = utcnow()
    db.commit()
    return find_lead(db, lead_id)
