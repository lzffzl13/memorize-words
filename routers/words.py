from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Word, Category
from schemas import WordOut

router = APIRouter(prefix="/api/words", tags=["words"])


@router.get("/", response_model=list[WordOut])
def list_words(db: Session = Depends(get_db)):
    words = db.query(Word).all()
    result = []
    for w in words:
        result.append(WordOut(
            id=w.id,
            english=w.english,
            chinese=w.chinese,
            pronunciation=w.pronunciation,
            part_of_speech=w.part_of_speech,
            example_sentence=w.example_sentence,
            example_sentence_cn=w.example_sentence_cn,
            code_snippet=w.code_snippet,
            difficulty=w.difficulty,
            category_name=w.category.name,
        ))
    return result
