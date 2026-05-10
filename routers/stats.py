from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Word, UserProgress, PracticeRecord, Category
from schemas import WordOut

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/weak-words")
def get_weak_words(limit: int = 20, db: Session = Depends(get_db)):
    """获取薄弱词汇：正确率低于60%且练习次数>=3的单词"""
    progress_list = (
        db.query(UserProgress)
        .filter(UserProgress.total_attempts >= 3)
        .all()
    )

    weak_words = []
    for p in progress_list:
        if p.total_attempts > 0:
            accuracy = p.correct_attempts / p.total_attempts
            if accuracy < 0.6:
                word = db.query(Word).get(p.word_id)
                if word:
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

    # 按正确率升序排列（最薄弱的在前面）
    weak_words.sort(key=lambda x: x["accuracy"])
    return weak_words[:limit]


@router.get("/overview")
def get_overview(db: Session = Depends(get_db)):
    """获取学习概览统计"""
    total_words = db.query(Word).count()
    progress_list = db.query(UserProgress).all()

    mastered = sum(1 for p in progress_list if p.status == "mastered")
    learning = sum(1 for p in progress_list if p.status == "learning")
    review = sum(1 for p in progress_list if p.status == "review")
    new = sum(1 for p in progress_list if p.status == "new")

    return {
        "total_words": total_words,
        "mastered": mastered,
        "learning": learning,
        "review": review,
        "new": new,
    }
