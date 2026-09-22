"""Structured schemas for Gemini LLM responses."""
from typing import List, Optional
from pydantic import BaseModel, Field


class LLMGroundedAnswer(BaseModel):
    """Schema for LLM synthesized weather response."""
    answer: str = Field(description="Direct, concise, and grounded response answering the user query")
    confidence: float = Field(default=0.95, ge=0.0, le=1.0, description="Confidence in the response based solely on provided facts")
    missing_data_notes: Optional[str] = Field(default=None, description="Notes on requested meteorological parameters not present in context")
    follow_up_questions: List[str] = Field(default_factory=list, description="2-3 relevant follow up query suggestions")
    key_points: List[str] = Field(default_factory=list, description="Key actionable takeaways")
    tts_friendly_text: Optional[str] = Field(default=None, description="Clean conversational string without markdown for voice TTS")
