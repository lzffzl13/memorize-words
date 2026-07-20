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


def generate_en_to_cn(
    db: Session,
    word: Word,
    count: int = 4,
    excluded_choices: list[str] | None = None,
):
    """英译中：给英文，选中文。返回 {word, choices, answer_index}"""
    answer = word.chinese
    excluded = {choice for choice in (excluded_choices or []) if choice and choice != answer}
    distractor_count = max(0, count - 1)

    def load_distractors(exclude_previous: bool):
        query = db.query(Word).filter(Word.id != word.id, Word.chinese != answer)
        if exclude_previous and excluded:
            query = query.filter(~Word.chinese.in_(excluded))
        return query.order_by(func.random()).limit(max(distractor_count * 4, distractor_count)).all()

    choices = []
    for candidate in load_distractors(exclude_previous=True):
        if candidate.chinese and candidate.chinese not in choices:
            choices.append(candidate.chinese)
        if len(choices) >= distractor_count:
            break

    # 小词库中排除旧选项后可能不足，允许用其他未重复释义补齐。
    if len(choices) < distractor_count:
        for candidate in load_distractors(exclude_previous=False):
            if candidate.chinese and candidate.chinese not in choices:
                choices.append(candidate.chinese)
            if len(choices) >= distractor_count:
                break

    choices = choices[:distractor_count]
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


def get_quiz(
    mode: str,
    db: Session,
    word: Word,
    excluded_choices: list[str] | None = None,
):
    if mode == "en_to_cn":
        return generate_en_to_cn(db, word, excluded_choices=excluded_choices)

    dispatch = {
        "cn_to_en": generate_cn_to_en,
        "spelling": generate_spelling,
        "code_fill": generate_code_fill,
    }
    fn = dispatch.get(mode, generate_en_to_cn)
    return fn(db, word)
