"""
Auth API Router — JWT login, role management, and audit log inspection.
"""

from datetime import timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings
from app.models import User
from app.schemas import UserCreate, UserLogin, UserResponse, Token
from app.core.auth_deps import get_current_user, require_role, log_audit_event, get_audit_logs

router = APIRouter()

# Demo predefined accounts
DEMO_ACCOUNTS = {
    "admin": {
        "password": "admin123",
        "role": "admin",
        "full_name": "Chief Drilling Operations Lead (Admin)",
    },
    "engineer": {
        "password": "engineer123",
        "role": "engineer",
        "full_name": "Senior Well Planning Engineer",
    },
    "viewer": {
        "password": "viewer123",
        "role": "read_only",
        "full_name": "Executive Observer (Read-Only)",
    },
}


@router.post("/auth/login")
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    """
    Authenticate user and return JWT access token with role claim.
    Supports predefined demo accounts (admin, engineer, viewer) plus DB users.
    """
    username = credentials.username.strip()
    password = credentials.password

    user_role = None
    full_name = username

    # 1. Check demo accounts first for fail-safe live demo reliability
    if username in DEMO_ACCOUNTS and DEMO_ACCOUNTS[username]["password"] == password:
        user_role = DEMO_ACCOUNTS[username]["role"]
        full_name = DEMO_ACCOUNTS[username]["full_name"]
    else:
        # 2. Check DB users
        try:
            result = await db.execute(select(User).where(User.username == username))
            db_user = result.scalar_one_or_none()
            if db_user and verify_password(password, db_user.hashed_password):
                user_role = db_user.role or "read_only"
                full_name = getattr(db_user, "full_name", username)
        except Exception:
            pass

    if not user_role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"sub": username, "role": user_role},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    # Log login action
    log_audit_event(
        username=username,
        role=user_role,
        action="USER_LOGIN",
        entity="AUTH",
        details=f"Successful JWT session login as {user_role}",
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user_role,
        "username": username,
        "full_name": full_name,
    }


@router.get("/auth/me")
async def get_me(user: Dict[str, Any] = Depends(get_current_user)):
    """Get current authenticated user profile and active role."""
    return user


@router.get("/audit-logs", response_model=List[Dict[str, Any]])
async def list_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Retrieve security & operational audit logs.
    Restricted to authenticated users.
    """
    return get_audit_logs(limit=limit)
