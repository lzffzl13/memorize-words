import json
from datetime import date
from database import engine, SessionLocal, Base
from models import Category, Word, UserProgress

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # 清空旧数据
    db.query(UserProgress).delete()
    db.query(Word).delete()
    db.query(Category).delete()
    db.commit()

    # 读取词汇数据
    with open("data/vocabulary.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    # 创建分类
    cat_map = {}
    for cat in data["categories"]:
        c = Category(name=cat["name"], name_en=cat["name_en"], icon=cat["icon"])
        db.add(c)
        db.flush()
        cat_map[cat["name"]] = c.id

    # 创建单词 + 初始进度
    for w in data["words"]:
        word = Word(
            english=w["english"],
            chinese=w["chinese"],
            pronunciation=w.get("pronunciation", ""),
            part_of_speech=w.get("part_of_speech", "noun"),
            example_sentence=w.get("example_sentence", ""),
            example_sentence_cn=w.get("example_sentence_cn", ""),
            code_snippet=w.get("code_snippet"),
            code_answer=w.get("code_answer"),
            difficulty=w.get("difficulty", 1),
            category_id=cat_map[w["category"]],
        )
        db.add(word)
        db.flush()

        progress = UserProgress(word_id=word.id, next_review_date=date.today())
        db.add(progress)

    db.commit()
    db.close()
    print(f"Done! Seeded {len(data['words'])} words in {len(data['categories'])} categories.")

if __name__ == "__main__":
    seed()
