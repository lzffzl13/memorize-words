from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Word, Category, UserProgress
from schemas import WordOut, WordCreate

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


@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    categories = db.query(Category).all()
    return [{"id": c.id, "name": c.name, "name_en": c.name_en, "icon": c.icon} for c in categories]


@router.post("/", response_model=WordOut)
def create_word(word: WordCreate, db: Session = Depends(get_db)):
    # 查找或创建分类
    category = db.query(Category).filter(Category.name == word.category_name).first()
    if not category:
        category = Category(name=word.category_name, name_en=word.category_name, icon="")
        db.add(category)
        db.flush()

    # 创建单词
    new_word = Word(
        english=word.english,
        chinese=word.chinese,
        pronunciation=word.pronunciation,
        part_of_speech=word.part_of_speech,
        example_sentence=word.example_sentence,
        example_sentence_cn=word.example_sentence_cn,
        code_snippet=word.code_snippet,
        code_answer=word.code_answer,
        difficulty=word.difficulty,
        category_id=category.id,
    )
    db.add(new_word)
    db.flush()

    # 创建初始学习进度
    progress = UserProgress(word_id=new_word.id, next_review_date=date.today())
    db.add(progress)
    db.commit()
    db.refresh(new_word)

    return WordOut(
        id=new_word.id,
        english=new_word.english,
        chinese=new_word.chinese,
        pronunciation=new_word.pronunciation,
        part_of_speech=new_word.part_of_speech,
        example_sentence=new_word.example_sentence,
        example_sentence_cn=new_word.example_sentence_cn,
        code_snippet=new_word.code_snippet,
        difficulty=new_word.difficulty,
        category_name=category.name,
    )
