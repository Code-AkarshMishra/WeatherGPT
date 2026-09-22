from typing import Any, Optional

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    status: str = "error"
    error: str
    detail: Optional[Any] = None