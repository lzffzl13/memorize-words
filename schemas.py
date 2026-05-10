from pydantic import BaseModel
from typing import Optional

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

    class Config:
        from_attributes = True
