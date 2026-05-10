from datetime import date
from fastapi import APIRouter, Depends
from pydantic import BaseModel
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


class AnswerRequest(BaseModel):
    session_id: int
    word_id: int
    mode: str
    answer: str
    response_time_ms: int = 0


@router.post("/start")
def start_practice(req: StartRequest, db: Session = Depends(get_db)):
    # 按分类过滤
    word_query = db.query(Word)
    if req.category:
        cat = db.query(Category).filter(Category.name == req.category).first()
        if cat:
            word_query = word_query.filter(Word.category_id == cat.id)

    # 优先取到期复习词，其次新词
    due = (
        db.query(UserProgress)
        .join(Word, Word.id == UserProgress.word_id)
        .filter(UserProgress.next_review_date <= date.today())
    )
    if req.category:
        cat = db.query(Category).filter(Category.name == req.category).first()
        if cat:
            due = due.filter(Word.category_id == cat.id)
    due = due.order_by(UserProgress.next_review_date).limit(req.count).all()
    word_ids = [p.word_id for p in due]

    # 不够则补新词
    if len(word_ids) < req.count:
        seen = set(word_ids)
        new_words = word_query.filter(Word.id.notin_(seen)).limit(req.count - len(word_ids)).all()
        word_ids.extend(w.id for w in new_words)

    # 生成题目
    questions = []
    for wid in word_ids:
        word = db.query(Word).get(wid)
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
    word = db.query(Word).get(req.word_id)
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
        progress.last_practiced = date.today()
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
