from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from database import get_db
from models import Word, UserProgress, PracticeRecord, PracticeSession, Category

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/weak-words")
def get_weak_words(limit: int = 20, db: Session = Depends(get_db)):
    """获取薄弱词汇：正确率低于60%且练习次数>=3的单词"""
    rows = (
        db.query(UserProgress, Word)
        .join(Word, Word.id == UserProgress.word_id)
        .filter(UserProgress.total_attempts >= 3)
        .all()
    )

    weak_words = []
    for p, word in rows:
        accuracy = p.correct_attempts / p.total_attempts
        if accuracy < 0.6:
            weak_words.append({
                "id": word.id,
                "english": word.english,
                "chinese": word.chinese,
                "pronunciation": word.pronunciation,
                "part_of_speech": word.part_of_speech,
                "category_name": word.category.name,
                "total_attempts": p.total_attempts,
                "correct_attempts": p.correct_attempts,
                "accuracy": round(accuracy * 100, 1),
                "easiness_factor": round(p.easiness_factor, 2),
                "status": p.status,
            })

    weak_words.sort(key=lambda x: x["accuracy"])
    return weak_words[:limit]


@router.get("/overview")
def get_overview(db: Session = Depends(get_db)):
    """获取学习概览统计"""
    total_words = db.query(Word).count()

    status_counts = dict(
        db.query(UserProgress.status, func.count(UserProgress.id))
        .group_by(UserProgress.status)
        .all()
    )

    return {
        "total_words": total_words,
        "mastered": status_counts.get("mastered", 0),
        "learning": status_counts.get("learning", 0),
        "review": status_counts.get("review", 0),
        "new": status_counts.get("new", 0),
    }


@router.get("/sessions")
def get_sessions(limit: int = 20, db: Session = Depends(get_db)):
    """获取最近的练习记录"""
    sessions = (
        db.query(PracticeSession)
        .order_by(PracticeSession.started_at.desc())
        .limit(limit)
        .all()
    )

    mode_names = {
        "en_to_cn": "英译中",
        "cn_to_en": "中译英",
        "spelling": "拼写练习",
        "code_fill": "代码填空",
    }

    result = []
    for s in sessions:
        accuracy = round(s.correct_answers / s.total_questions * 100, 1) if s.total_questions > 0 else 0
        result.append({
            "id": s.id,
            "mode": s.mode,
            "mode_name": mode_names.get(s.mode, s.mode),
            "started_at": s.started_at.strftime("%m-%d %H:%M") if s.started_at else "",
            "total_questions": s.total_questions,
            "correct_answers": s.correct_answers,
            "accuracy": accuracy,
        })

    return result


@router.get("/sessions/{session_id}")
def get_session_detail(session_id: int, db: Session = Depends(get_db)):
    """获取单次练习的详情"""
    session = db.query(PracticeSession).get(session_id)
    if not session:
        return {"error": "Session not found"}

    records = (
        db.query(PracticeRecord, Word)
        .join(Word, Word.id == PracticeRecord.word_id)
        .filter(PracticeRecord.session_id == session_id)
        .order_by(PracticeRecord.answered_at)
        .all()
    )

    mode_names = {
        "en_to_cn": "英译中",
        "cn_to_en": "中译英",
        "spelling": "拼写练习",
        "code_fill": "代码填空",
    }

    return {
        "id": session.id,
        "mode_name": mode_names.get(session.mode, session.mode),
        "started_at": session.started_at.strftime("%m-%d %H:%M") if session.started_at else "",
        "total_questions": session.total_questions,
        "correct_answers": session.correct_answers,
        "records": [
            {
                "english": word.english,
                "chinese": word.chinese,
                "is_correct": r.is_correct,
                "response_time_ms": r.response_time_ms,
            }
            for r, word in records
        ],
    }


@router.get("/daily")
def get_daily(db: Session = Depends(get_db)):
    """获取最近7天每日统计 + 连续打卡天数"""
    today = date.today()
    start_date = today - timedelta(days=6)

    records = (
        db.query(PracticeRecord)
        .filter(PracticeRecord.answered_at >= start_date)
        .all()
    )

    daily_map = {}
    for r in records:
        day = r.answered_at.date() if r.answered_at else None
        if day is None:
            continue
        if day not in daily_map:
            daily_map[day] = {"total": 0, "correct": 0}
        daily_map[day]["total"] += 1
        if r.is_correct:
            daily_map[day]["correct"] += 1

    # 构建7天数据
    daily = []
    for i in range(7):
        d = start_date + timedelta(days=i)
        stats = daily_map.get(d, {"total": 0, "correct": 0})
        accuracy = round(stats["correct"] / stats["total"] * 100, 1) if stats["total"] > 0 else 0
        daily.append({
            "date": d.strftime("%m-%d"),
            "weekday": ["一", "二", "三", "四", "五", "六", "日"][d.weekday()],
            "total": stats["total"],
            "correct": stats["correct"],
            "accuracy": accuracy,
        })

    # 计算连续打卡天数（从今天往回数）
    streak = 0
    check_date = today
    while True:
        if check_date in daily_map and daily_map[check_date]["total"] > 0:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            break

    # 今日练习数
    today_stats = daily_map.get(today, {"total": 0, "correct": 0})

    return {
        "daily": daily,
        "streak": streak,
        "today_total": today_stats["total"],
        "today_correct": today_stats["correct"],
    }


@router.get("/words-by-status")
def get_words_by_status(status: str, db: Session = Depends(get_db)):
    """按状态获取单词列表"""
    rows = (
        db.query(Word, UserProgress)
        .join(UserProgress, UserProgress.word_id == Word.id)
        .filter(UserProgress.status == status)
        .all()
    )

    return [
        {
            "id": word.id,
            "english": word.english,
            "chinese": word.chinese,
            "pronunciation": word.pronunciation,
            "part_of_speech": word.part_of_speech,
            "category_name": word.category.name,
            "total_attempts": p.total_attempts,
            "correct_attempts": p.correct_attempts,
        }
        for word, p in rows
    ]
