"""
Copilot API Router — RAG-based Q&A with LLM narration + mandatory citations.
LLM NEVER generates facts — only narrates. All data comes from rule engines + DB.
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas import CopilotQuery, CopilotResponse

router = APIRouter(prefix="/copilot")


@router.post("/ask", response_model=CopilotResponse)
async def ask_copilot(
    query: CopilotQuery,
    db: AsyncSession = Depends(get_db),
):
    """Ask the AI copilot a question about wells, risks, or drilling events.

    IMPORTANT:
    - LLM only narrates / explains — it NEVER generates factual data
    - All risk scores, similarity scores come from deterministic engines
    - Every response must include citations: well, document, page, excerpt
    - Response clearly labeled as narration of existing data
    """
    # TODO: Implement RAG copilot in Phase 2
    raise HTTPException(
        status_code=501,
        detail="RAG Copilot will be implemented in Phase 2. "
               "LLM will narrate + cite sources — never generate facts.",
    )


@router.get("/history")
async def copilot_history(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """Get copilot conversation history for admin review."""
    # TODO: Implement in Phase 2
    raise HTTPException(status_code=501, detail="Coming in Phase 2.")
