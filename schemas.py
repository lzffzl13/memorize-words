from pydantic import BaseModel
from typing import Optional

class WordCreate(BaseModel):
    english: str
    chinese: str
    category_name: str
    pronunciation: str = ""
    part_of_speech: str = "noun"
    example_sentence: str = ""
    example_sentence_cn: str = ""
    code_snippet: Optional[str] = None
    code_answer: Optional[str] = None
    difficulty: int = 1

class WordOut(BaseModel):
    id: int
    english: str
    chinese: str
    pronunciation: str
    part_of_speech: str
    example_sentence: str
    example_sentence_cn: str = ""
    code_snippet: Optional[str] = None
    difficulty: int
    category_name: str
    status: str = "new"

    class Config:
        from_attributes = True
