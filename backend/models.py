from sqlalchemy import Column, Integer, String, DateTime, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://eventhub:eventhub@db:5432/eventhub"
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, default="")
    location = Column(String, default="")
    category = Column(String, nullable=False)
    date = Column(String, nullable=False)
    time = Column(String, nullable=False)
    participants = Column(String, default="")
    emoji = Column(String, default="📌")


def init_db():
    Base.metadata.create_all(bind=engine)
