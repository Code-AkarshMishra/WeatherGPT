"""Chat service encapsulating conversational agent operations."""
from app.agent.orchestrator import AgentOrchestrator
from app.schemas.chat import ChatRequest, ChatResponse


class ChatService:
    """Chat service facade."""

    def __init__(self):
        self.orchestrator = AgentOrchestrator()

    async def handle_chat_request(self, request: ChatRequest) -> ChatResponse:
        """Handle incoming conversation and intelligence generation."""
        return await self.orchestrator.process_chat(request)
