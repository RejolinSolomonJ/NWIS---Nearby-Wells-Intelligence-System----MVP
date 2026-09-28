"""
NWIS-X Security — JWT token creation/verification + password hashing.
Includes native HMAC-SHA256 JWT fallback to avoid dependency failures.
"""

import base64
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.core.config import settings

# Try importing passlib / bcrypt, or use hashlib pbkdf2 fallback
try:
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    _has_passlib = True
except ImportError:
    _has_passlib = False


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hash."""
    if _has_passlib:
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            pass
    # Fallback SHA256 comparison
    salt, _, hash_val = hashed_password.partition("$")
    if not hash_val:
        return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password
    calc = hashlib.sha256((salt + plain_password).encode()).hexdigest()
    return calc == hash_val


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt or salt+sha256 fallback."""
    if _has_passlib:
        try:
            return pwd_context.hash(password)
        except Exception:
            pass
    salt = "nwis_salt_"
    h = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}${h}"


# Try python-jose or pyjwt, fallback to pure python HMAC-SHA256 JWT
try:
    from jose import JWTError, jwt as _jose_jwt
    _jwt_impl = "jose"
except ImportError:
    try:
        import jwt as _pyjwt
        JWTError = Exception
        _jwt_impl = "pyjwt"
    except ImportError:
        JWTError = Exception
        _jwt_impl = "native"


def _b64_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _b64_decode(data: str) -> bytes:
    padding = 4 - (len(data) % 4)
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data.encode("utf-8"))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": int(expire.timestamp())})

    if _jwt_impl == "jose":
        return _jose_jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    elif _jwt_impl == "pyjwt":
        return _pyjwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    else:
        # Native HMAC-SHA256 JWT implementation
        header = {"alg": "HS256", "typ": "JWT"}
        header_b64 = _b64_encode(json.dumps(header, separators=(",", ":")).encode())
        payload_b64 = _b64_encode(json.dumps(to_encode, separators=(",", ":")).encode())
        signing_input = f"{header_b64}.{payload_b64}".encode()
        signature = hmac.new(settings.SECRET_KEY.encode(), signing_input, hashlib.sha256).digest()
        sig_b64 = _b64_encode(signature)
        return f"{header_b64}.{payload_b64}.{sig_b64}"


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and verify a JWT token. Returns payload or None on failure."""
    if _jwt_impl == "jose":
        try:
            return _jose_jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        except Exception:
            return None
    elif _jwt_impl == "pyjwt":
        try:
            return _pyjwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        except Exception:
            return None
    else:
        try:
            parts = token.split(".")
            if len(parts) != 3:
                return None
            header_b64, payload_b64, sig_b64 = parts
            signing_input = f"{header_b64}.{payload_b64}".encode()
            expected_sig = hmac.new(settings.SECRET_KEY.encode(), signing_input, hashlib.sha256).digest()
            if not hmac.compare_digest(_b64_decode(sig_b64), expected_sig):
                return None
            payload = json.loads(_b64_decode(payload_b64).decode())
            if "exp" in payload and payload["exp"] < datetime.now(timezone.utc).timestamp():
                return None
            return payload
        except Exception:
            return None
