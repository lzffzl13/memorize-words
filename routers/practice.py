import random
from datetime import date, datetime
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from database import get_db
from models import Word, UserProgress, PracticeSession, PracticeRecord, Category
from services.quiz_generator import get_quiz
from services.spaced_repetition import get_next_review_date

router = APIRouter(prefix="/api/practice", tags=["practice"])


class StartRequest(BaseModel):
    mode: str = "en_to_cn"
    count: int = 10
    category: str = ""
    scope: str = "all"
    word_ids: list[int] = []


class AnswerRequest(BaseModel):
    session_id: int
    word_id: int
    mode: str
    answer: str
    response_time_ms: int = 0


@router.post("/start")
def start_practice(req: StartRequest, db: Session = Depends(get_db)):
    count = max(1, min(req.count, 50))

    # 按分类过滤
    word_query = db.query(Word)
    category_id = None
    if req.category:
        cat = db.query(Category).filter(Category.name == req.category).first()
        if cat:
            category_id = cat.id
            word_query = word_query.filter(Word.category_id == category_id)

    if req.word_ids:
        requested_ids = list(dict.fromkeys(req.word_ids))
        word_rows = word_query.filter(Word.id.in_(requested_ids)).all()
        word_ids = [word.id for word in word_rows][:count]
    elif req.scope == "due":
        word_rows = (
            db.query(Word.id)
            .join(UserProgress, UserProgress.word_id == Word.id)
            .filter(UserProgress.next_review_date <= date.today())
        )
        if category_id is not None:
            word_rows = word_rows.filter(Word.category_id == category_id)
        word_ids = [row.id for row in word_rows.order_by(func.random()).limit(count).all()]
    elif req.scope == "wrong":
        wrong_rows = (
            db.query(Word.id)
            .join(PracticeRecord, PracticeRecord.word_id == Word.id)
            .filter(PracticeRecord.is_correct == False)
            .distinct()
        )
        if category_id is not None:
            wrong_rows = wrong_rows.filter(Word.category_id == category_id)
        word_ids = [row.id for row in wrong_rows.order_by(func.random()).limit(count).all()]
    else:
        word_ids = [row.id for row in word_query.order_by(func.random()).limit(count).all()]

    random.shuffle(word_ids)

    # 生成题目
    questions = []
    for wid in word_ids:
        word = db.get(Word, wid)
        if word:
            questions.append(get_quiz(req.mode, db, word))

    # 创建会话
    session = PracticeSession(mode=req.mode, total_questions=len(questions))
    db.add(session)
    db.commit()
    db.refresh(session)

    return {"session_id": session.id, "questions": questions}


@router.post("/answer")
def submit_answer(req: AnswerRequest, db: Session = Depends(get_db)):
    word = db.get(Word, req.word_id)
    if not word:
        return {"error": "Word not found"}

    # 判断正误
    if req.mode == "en_to_cn":
        is_correct = req.answer.strip() == word.chinese
    elif req.mode in ("cn_to_en", "spelling"):
        is_correct = req.answer.strip().lower() == word.english.lower()
    elif req.mode == "code_fill":
        is_correct = req.answer.strip() == word.code_answer
    else:
        is_correct = False

    # 更新间隔重复
    progress = db.query(UserProgress).filter(UserProgress.word_id == req.word_id).first()
    if progress:
        quality = 5 if is_correct else 1
        next_date, new_reps, new_ef, new_interval = get_next_review_date(
            quality, progress.repetitions, progress.easiness_factor, progress.interval_days
        )
        progress.next_review_date = next_date
        progress.repetitions = new_reps
        progress.easiness_factor = new_ef
        progress.interval_days = new_interval
        progress.last_practiced = datetime.now()
        progress.total_attempts += 1
        if is_correct:
            progress.correct_attempts += 1
        # 状态流转
        if progress.correct_attempts >= 10 and progress.repetitions >= 5:
            progress.status = "mastered"
        elif progress.repetitions >= 2:
            progress.status = "review"
        elif progress.total_attempts >= 1:
            progress.status = "learning"

    # 更新练习会话正确数
    session = db.get(PracticeSession, req.session_id)
    if session and is_correct:
        session.correct_answers += 1

    # 记录答题
    record = PracticeRecord(
        session_id=req.session_id,
        word_id=req.word_id,
        mode=req.mode,
        is_correct=is_correct,
        response_time_ms=req.response_time_ms,
    )
    db.add(record)
    db.commit()

    return {
        "is_correct": is_correct,
        "correct_answer": word.english if req.mode != "en_to_cn" else word.chinese,
    }
