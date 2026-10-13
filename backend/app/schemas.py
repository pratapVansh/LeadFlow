from datetime import UTC, datetime
from typing import Annotated

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints, field_validator

from .models import LeadStatus


Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Note = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]


class RequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class LeadCreate(RequestModel):
    name: Name
    company: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=50)

    @field_validator("company", "phone")
    @classmethod
    def empty_to_none(cls, value: str | None) -> str | None:
        return value or None


class StatusUpdate(RequestModel):
    status: LeadStatus


class DiscussionCreate(RequestModel):
    note: Note
    follow_up_at: AwareDatetime | None = None

    @field_validator("follow_up_at", mode="before")
    @classmethod
    def require_timestamp(cls, value):
        if value is None or isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value)
            except ValueError:
                pass
        raise ValueError("Follow-up must be an ISO 8601 timestamp with a time-zone offset.")

    @field_validator("follow_up_at")
    @classmethod
    def future_follow_up(cls, value: datetime | None) -> datetime | None:
        if value is not None:
            if value <= datetime.now(UTC):
                raise ValueError("Follow-up must be in the future.")
            return value.astimezone(UTC)
        return None


class LeadRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    company: str | None
    phone: str | None
    status: LeadStatus
    follow_up_at: datetime | None
    created_at: datetime
    updated_at: datetime


class DiscussionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    note: str
    follow_up_at: datetime | None
    created_at: datetime


class LeadSummary(LeadRead):
    last_note: str | None
    last_discussion_at: datetime | None


class LeadDetail(LeadRead):
    discussions: list[DiscussionRead]
