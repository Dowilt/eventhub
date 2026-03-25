from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from models import SessionLocal, init_db, Event
from schemas import EventCreate, EventUpdate, EventResponse
from typing import List
import time
from sqlalchemy import text

app = FastAPI(title="EventHub API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def wait_for_db(retries=30, delay=2):
    for i in range(retries):
        try:
            db = SessionLocal()
            db.execute(text("SELECT 1"))
            db.close()
            return
        except Exception:
            if i < retries - 1:
                time.sleep(delay)
    raise Exception("Database not available")


@app.on_event("startup")
def startup():
    wait_for_db()
    init_db()
    db = SessionLocal()
    if db.query(Event).count() == 0:
        seed_data = [
            Event(
                title="Лекция по Flutter",
                description="Лабораторная работа №4. Создание приложения EventHub с использованием GridView, BottomSheet и других виджетов.",
                location="Аудитория 305",
                category="Учёба",
                date="2026-03-25",
                time="09:00",
                participants="Иванов А.,Петрова Б.,Сидоров В.",
                emoji="📚",
            ),
            Event(
                title="Футбол с друзьями",
                description="Товарищеский матч 5 на 5. Не забудь форму и воду!",
                location='Стадион «Спартак»',
                category="Спорт",
                date="2026-03-26",
                time="18:30",
                participants="Команда А,Команда Б",
                emoji="⚽",
            ),
            Event(
                title="Кинопремьера",
                description="Новый фильм в IMAX. Билеты уже куплены, ряд 7.",
                location='Кинотеатр «Синема Парк»',
                category="Развлечения",
                date="2026-03-27",
                time="20:00",
                participants="Аня,Максим,Даша",
                emoji="🎬",
            ),
            Event(
                title="Митап по мобильной разработке",
                description="Доклады: Compose vs Flutter, архитектура чистого кода, CI/CD для мобильных приложений.",
                location='Коворкинг «Точка кипения»',
                category="Работа",
                date="2026-03-28",
                time="19:00",
                participants="Спикер 1,Спикер 2,~50 участников",
                emoji="💻",
            ),
            Event(
                title="День рождения Маши",
                description="Собираемся у Маши дома. Подарок: книга по Dart.",
                location="ул. Ленина, 42",
                category="Личное",
                date="2026-03-30",
                time="17:00",
                participants="Маша,Ваня,Катя,Олег,Лиза",
                emoji="🎂",
            ),
            Event(
                title="Защита курсовой",
                description="Финальная защита курсовой работы по дисциплине «Мобильная разработка».",
                location="Аудитория 112",
                category="Учёба",
                date="2026-04-01",
                time="10:00",
                participants="Группа ИСТ-21,Преподаватель",
                emoji="🎓",
            ),
        ]
        db.add_all(seed_data)
        db.commit()
    db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/api/events", response_model=List[EventResponse])
def get_events(db: Session = Depends(get_db)):
    return db.query(Event).order_by(Event.id).all()


@app.get("/api/events/{event_id}", response_model=EventResponse)
def get_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@app.post("/api/events", response_model=EventResponse)
def create_event(data: EventCreate, db: Session = Depends(get_db)):
    event = Event(**data.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@app.put("/api/events/{event_id}", response_model=EventResponse)
def update_event(event_id: int, data: EventUpdate, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(event, key, value)
    db.commit()
    db.refresh(event)
    return event


@app.delete("/api/events/{event_id}")
def delete_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(event)
    db.commit()
    return {"detail": "Deleted"}


@app.get("/api/categories")
def get_categories():
    return [
        {"name": "Учёба", "icon": "school", "color": "#2196F3"},
        {"name": "Спорт", "icon": "sports_soccer", "color": "#4CAF50"},
        {"name": "Развлечения", "icon": "celebration", "color": "#FF9800"},
        {"name": "Работа", "icon": "work", "color": "#F44336"},
        {"name": "Личное", "icon": "favorite", "color": "#E91E63"},
    ]


@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    events = db.query(Event).all()
    total = len(events)
    by_category = {}
    for e in events:
        by_category[e.category] = by_category.get(e.category, 0) + 1

    nearest = None
    if events:
        sorted_events = sorted(events, key=lambda x: (x.date, x.time))
        nearest = EventResponse.model_validate(sorted_events[0])

    upcoming = []
    sorted_all = sorted(events, key=lambda x: (x.date, x.time))[:3]
    for e in sorted_all:
        upcoming.append(EventResponse.model_validate(e))

    return {
        "total": total,
        "by_category": by_category,
        "nearest": nearest,
        "upcoming": upcoming,
    }
