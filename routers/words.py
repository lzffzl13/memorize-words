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
            status=w.progress.status if w.progress else "new",
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
        status=progress.status,
    )


@router.put("/{word_id}", response_model=WordOut)
def update_word(word_id: int, word: WordCreate, db: Session = Depends(get_db)):
    existing = db.get(Word, word_id)
    if not existing:
        return {"error": "Word not found"}

    # 查找或创建分类
    category = db.query(Category).filter(Category.name == word.category_name).first()
    if not category:
        category = Category(name=word.category_name, name_en=word.category_name, icon="")
        db.add(category)
        db.flush()

    # 更新单词
    existing.english = word.english
    existing.chinese = word.chinese
    existing.pronunciation = word.pronunciation
    existing.part_of_speech = word.part_of_speech
    existing.example_sentence = word.example_sentence
    existing.example_sentence_cn = word.example_sentence_cn
    existing.code_snippet = word.code_snippet
    existing.code_answer = word.code_answer
    existing.difficulty = word.difficulty
    existing.category_id = category.id
    db.commit()
    db.refresh(existing)

    return WordOut(
        id=existing.id,
        english=existing.english,
        chinese=existing.chinese,
        pronunciation=existing.pronunciation,
        part_of_speech=existing.part_of_speech,
        example_sentence=existing.example_sentence,
        example_sentence_cn=existing.example_sentence_cn,
        code_snippet=existing.code_snippet,
        difficulty=existing.difficulty,
        category_name=category.name,
        status=existing.progress.status if existing.progress else "new",
    )


@router.delete("/{word_id}")
def delete_word(word_id: int, db: Session = Depends(get_db)):
    word = db.get(Word, word_id)
    if not word:
        return {"error": "Word not found"}

    # 删除相关学习进度
    db.query(UserProgress).filter(UserProgress.word_id == word_id).delete()
    # 删除单词
    db.delete(word)
    db.commit()

    return {"message": "Word deleted", "id": word_id}
