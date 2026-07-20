import argparse
import json
from datetime import date
from pathlib import Path

from database import Base, SessionLocal, engine
from models import Category, DailyStats, PracticeRecord, PracticeSession, UserProgress, Word

DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_FILES = (
    DATA_DIR / "vocabulary.json",
    *sorted(DATA_DIR.glob("*_vocabulary.json")),
)


def reset_database(db):
    db.query(PracticeRecord).delete()
    db.query(PracticeSession).delete()
    db.query(DailyStats).delete()
    db.query(UserProgress).delete()
    db.query(Word).delete()
    db.query(Category).delete()
    db.commit()


def load_seed_data():
    merged = {"categories": [], "words": []}
    category_names = set()

    for data_file in DATA_FILES:
        if not data_file.exists():
            continue

        with data_file.open("r", encoding="utf-8") as f:
            data = json.load(f)

        for category in data.get("categories", []):
            if category["name"] in category_names:
                continue
            merged["categories"].append(category)
            category_names.add(category["name"])

        merged["words"].extend(data.get("words", []))

    return merged


def seed(reset=False, skip_if_has_words=True):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        existing_words = db.query(Word).count()
        if reset:
            reset_database(db)
        elif skip_if_has_words and existing_words > 0:
            print(f"Skip seed: database already has {existing_words} words.")
            return

        data = load_seed_data()

        cat_map = {}
        for cat in data["categories"]:
            existing = db.query(Category).filter(Category.name == cat["name"]).first()
            if existing:
                cat_map[cat["name"]] = existing.id
                continue

            category = Category(name=cat["name"], name_en=cat["name_en"], icon=cat["icon"])
            db.add(category)
            db.flush()
            cat_map[cat["name"]] = category.id

        inserted = 0
        for w in data["words"]:
            category_id = cat_map[w["category"]]
            existing = (
                db.query(Word)
                .filter(
                    Word.english == w["english"],
                    Word.chinese == w["chinese"],
                    Word.category_id == category_id,
                )
                .first()
            )
            if existing:
                continue

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
                category_id=category_id,
            )
            db.add(word)
            db.flush()

            progress = UserProgress(word_id=word.id, next_review_date=date.today())
            db.add(progress)
            inserted += 1

        db.commit()
        print(f"Done! Seeded {inserted} words in {len(data['categories'])} categories.")
    finally:
        db.close()


def initialize_database():
    # Keep existing progress intact while syncing newly shipped vocabulary.
    seed(reset=False, skip_if_has_words=False)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Initialize vocabulary data.")
    parser.add_argument("--reset", action="store_true", help="Clear existing data before seeding.")
    args = parser.parse_args()
    seed(reset=args.reset, skip_if_has_words=not args.reset)
