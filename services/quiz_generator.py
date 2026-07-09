import random
from sqlalchemy.orm import Session
from sqlalchemy import func
from models import Word


def get_word_context(word: Word):
    return {
        "english": word.english,
        "chinese": word.chinese,
        "pronunciation": word.pronunciation,
        "part_of_speech": word.part_of_speech,
        "example_sentence": word.example_sentence or "",
        "example_sentence_cn": word.example_sentence_cn or "",
        "code_snippet": word.code_snippet or "",
    }


def generate_en_to_cn(db: Session, word: Word, count: int = 4):
    """英译中：给英文，选中文。返回 {word, choices, answer_index}"""
    others = db.query(Word).filter(Word.id != word.id).order_by(func.random()).limit(count - 1).all()
    choices = [w.chinese for w in others]
    answer = word.chinese
    if answer not in choices:
        choices.append(answer)
    random.shuffle(choices)
    return {
        **get_word_context(word),
        "word_id": word.id,
        "choices": choices[:count],
        "answer": answer,
    }


def generate_cn_to_en(db: Session, word: Word):
    """中译英：给中文，拼写英文"""
    return {
        **get_word_context(word),
        "word_id": word.id,
        "answer": word.english,
    }


def generate_spelling(db: Session, word: Word):
    """拼写练习：给中文+释义，拼完整单词"""
    return {
        **get_word_context(word),
        "word_id": word.id,
        "answer": word.english,
    }


def generate_code_fill(db: Session, word: Word):
    """代码填空：在代码片段中填关键字"""
    if not word.code_snippet or not word.code_answer:
        return generate_en_to_cn(db, word)
    return {
        **get_word_context(word),
        "word_id": word.id,
        "code_answer": word.code_answer,
        "hint": word.chinese,
    }


def get_quiz(mode: str, db: Session, word: Word):
    dispatch = {
        "en_to_cn": generate_en_to_cn,
        "cn_to_en": generate_cn_to_en,
        "spelling": generate_spelling,
        "code_fill": generate_code_fill,
    }
    fn = dispatch.get(mode, generate_en_to_cn)
    return fn(db, word)
