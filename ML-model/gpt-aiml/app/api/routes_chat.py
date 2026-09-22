"""Chat endpoint for grounded conversational intelligence."""
from fastapi import APIRouter, Depends, status
from app.core.security import verify_internal_secret
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chat_service import ChatService

router = APIRouter(prefix="/chat", tags=["Grounded Chat Intelligence"])
_chat_service = ChatService()


@router.post(
    "",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Process grounded chat request with tool orchestration",
    dependencies=[Depends(verify_internal_secret)],
)
async def chat_endpoint(request: ChatRequest) -> ChatResponse:
    """Execute end-to-end grounded weather intelligence query."""
    return await _chat_service.handle_chat_request(request)
