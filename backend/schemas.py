from pydantic import BaseModel
from typing import Optional


class EventCreate(BaseModel):
    title: str
    description: str = ""
    location: str = ""
    category: str
    date: str
    time: str
    participants: str = ""
    emoji: str = "📌"


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    category: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    participants: Optional[str] = None
    emoji: Optional[str] = None


class EventResponse(BaseModel):
    id: int
    title: str
    description: str
    location: str
    category: str
    date: str
    time: str
    participants: str
    emoji: str

    model_config = {"from_attributes": True}
