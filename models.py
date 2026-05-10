from datetime import date, datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False)
    name_en = Column(String(50), nullable=False)
    icon = Column(String(10), default="")

    words = relationship("Word", back_populates="category")


class Word(Base):
    __tablename__ = "words"

    id = Column(Integer, primary_key=True, autoincrement=True)
    english = Column(String(100), nullable=False)
    chinese = Column(String(100), nullable=False)
    pronunciation = Column(String(100), default="")
    part_of_speech = Column(String(20), default="noun")
    example_sentence = Column(Text, default="")
    example_sentence_cn = Column(Text, default="")
    code_snippet = Column(Text, nullable=True)
    code_answer = Column(String(100), nullable=True)
    difficulty = Column(Integer, default=1)  # 1=easy, 2=medium, 3=hard
    category_id = Column(Integer, ForeignKey("categories.id"))

    category = relationship("Category", back_populates="words")
    progress = relationship("UserProgress", back_populates="word", uselist=False)


class UserProgress(Base):
    __tablename__ = "user_progress"

    id = Column(Integer, primary_key=True, autoincrement=True)
    word_id = Column(Integer, ForeignKey("words.id"), unique=True, nullable=False)
    easiness_factor = Column(Float, default=2.5)
    interval_days = Column(Integer, default=0)
    repetitions = Column(Integer, default=0)
    next_review_date = Column(Date, default=date.today)
    last_practiced = Column(DateTime, nullable=True)
    total_attempts = Column(Integer, default=0)
    correct_attempts = Column(Integer, default=0)
    status = Column(String(20), default="new")  # new, learning, review, mastered

    word = relationship("Word", back_populates="progress")


class PracticeSession(Base):
    __tablename__ = "practice_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    mode = Column(String(30), nullable=False)
    started_at = Column(DateTime, default=datetime.now)
    finished_at = Column(DateTime, nullable=True)
    total_questions = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)

    records = relationship("PracticeRecord", back_populates="session")


class PracticeRecord(Base):
    __tablename__ = "practice_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("practice_sessions.id"), nullable=False)
    word_id = Column(Integer, ForeignKey("words.id"), nullable=False)
    mode = Column(String(30), nullable=False)
    is_correct = Column(Boolean, default=False)
    response_time_ms = Column(Integer, default=0)
    answered_at = Column(DateTime, default=datetime.now)

    session = relationship("PracticeSession", back_populates="records")
    word = relationship("Word")


class DailyStats(Base):
    __tablename__ = "daily_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, unique=True, nullable=False)
    words_practiced = Column(Integer, default=0)
    words_correct = Column(Integer, default=0)
    new_words_seen = Column(Integer, default=0)
    time_spent_seconds = Column(Integer, default=0)
    streak_days = Column(Integer, default=0)
