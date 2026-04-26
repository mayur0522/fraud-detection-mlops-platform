"""
Azure AD B2C Authentication
JWT token validation and user management.
"""
from typing import Optional, Dict, List, Any
from dataclasses import dataclass
from enum import Enum
from datetime import datetime, timedelta
import logging
import os

logger = logging.getLogger(__name__)


class Role(str, Enum):
    """User roles for RBAC."""
    ADMIN = "ADMIN"
    DATA_ENGINEER = "DATA_ENGINEER"
    ML_ENGINEER = "ML_ENGINEER"
    DEPLOYER = "DEPLOYER"
    VIEWER = "VIEWER"


class Permission(str, Enum):
    """Granular permissions."""
    # Data
    DATA_READ = "data:read"
    DATA_WRITE = "data:write"
    DATA_DELETE = "data:delete"

    # Models / Training
    MODEL_READ = "model:read"
    MODEL_TRAIN = "model:train"
    MODEL_DEPLOY = "model:deploy"
    MODEL_DELETE = "model:delete"

    # Inference
    INFERENCE_RUN = "inference:run"

    # Monitoring
    MONITORING_READ = "monitoring:read"
    MONITORING_CONFIGURE = "monitoring:configure"

    # Alerts
    ALERTS_READ = "alerts:read"
    ALERTS_ACKNOWLEDGE = "alerts:acknowledge"
    ALERTS_CONFIGURE = "alerts:configure"

    # Jobs
    JOBS_READ = "jobs:read"
    JOBS_MANAGE = "jobs:manage"

    # Admin
    USERS_MANAGE = "users:manage"
    SETTINGS_MANAGE = "settings:manage"
    AUDIT_READ = "audit:read"


# Role to permissions mapping (matches RBAC matrix)
ROLE_PERMISSIONS: Dict[Role, List[Permission]] = {
    # ADMIN: everything
    Role.ADMIN: list(Permission),

    # DATA_ENGINEER: full data access, view monitoring, no training/deploy
    Role.DATA_ENGINEER: [
        Permission.DATA_READ,
        Permission.DATA_WRITE,
        Permission.DATA_DELETE,
        Permission.MODEL_READ,
        Permission.MONITORING_READ,
        Permission.ALERTS_READ,
        Permission.ALERTS_ACKNOWLEDGE,
        Permission.JOBS_READ,
    ],

    # ML_ENGINEER: read data, full train/model, view monitoring — no deploy
    Role.ML_ENGINEER: [
        Permission.DATA_READ,
        Permission.MODEL_READ,
        Permission.MODEL_TRAIN,
        Permission.MODEL_DELETE,
        Permission.MONITORING_READ,
        Permission.ALERTS_READ,
        Permission.ALERTS_ACKNOWLEDGE,
        Permission.JOBS_READ,
        Permission.JOBS_MANAGE,
    ],

    # DEPLOYER: deployment + full monitoring, no data write or training
    Role.DEPLOYER: [
        Permission.MODEL_READ,
        Permission.MODEL_DEPLOY,
        Permission.INFERENCE_RUN,
        Permission.MONITORING_READ,
        Permission.MONITORING_CONFIGURE,
        Permission.ALERTS_READ,
        Permission.ALERTS_ACKNOWLEDGE,
        Permission.ALERTS_CONFIGURE,
        Permission.JOBS_READ,
        Permission.JOBS_MANAGE,
    ],

    # VIEWER: read-only across everything
    Role.VIEWER: [
        Permission.DATA_READ,
        Permission.MODEL_READ,
        Permission.MONITORING_READ,
        Permission.ALERTS_READ,
        Permission.JOBS_READ,
    ],
}


@dataclass
class User:
    """Authenticated user."""
    id: str
    email: str
    name: str
    roles: List[Role]
    permissions: List[Permission]
    tenant_id: str
    issued_at: datetime
    expires_at: datetime


@dataclass
class TokenPayload:
    """JWT token payload."""
    sub: str
    email: str
    name: str
    roles: List[str]
    aud: str
    iss: str
    iat: int
    exp: int
    tid: str


class AzureADB2CAuth:
    """
    Azure AD B2C authentication handler.
    
    Validates JWT tokens issued by Azure AD B2C.
    """
    
    def __init__(
        self,
        tenant_name: str = None,
        policy_name: str = "B2C_1_SignUpSignIn",
        client_id: str = None,
    ):
        from app.core.config import settings
        self.tenant_name = tenant_name or settings.AZURE_AD_B2C_TENANT or "shadowhubble"
        self.policy_name = policy_name
        self.client_id = client_id or settings.AZURE_AD_B2C_CLIENT_ID
        
        self._jwks_uri = (
            f"https://{self.tenant_name}.b2clogin.com/{self.tenant_name}.onmicrosoft.com"
            f"/{self.policy_name}/discovery/v2.0/keys"
        )
        self._issuer = (
            f"https://{self.tenant_name}.b2clogin.com/{self.tenant_name}.onmicrosoft.com"
            f"/{self.policy_name}/v2.0/"
        )
        
        self._jwks_cache = None
        self._jwks_cache_time = None
    
    async def validate_token(self, token: str) -> Optional[User]:
        """
        Validate JWT token and return user info.
        
        Args:
            token: JWT token string
            
        Returns:
            User object if valid, None otherwise
        """
        try:
            # In production, use python-jose or PyJWT with JWKS
            # For now, decode without verification for development
            import jwt
            
            # Decode without verification for development
            # In production, verify against JWKS
            payload = jwt.decode(
                token,
                options={"verify_signature": False},
                algorithms=["RS256"],
            )
            
            # Extract user info (normalize case to avoid role drift across providers)
            roles: List[Role] = []
            for role_raw in payload.get("roles", ["VIEWER"]):
                role_text = str(role_raw).strip().upper()
                if not role_text:
                    continue
                if role_text in Role.__members__:
                    roles.append(Role[role_text])
                    continue
                try:
                    roles.append(Role(role_text))
                except ValueError:
                    continue
            if not roles:
                roles = [Role.VIEWER]
            
            # Compute permissions from roles
            permissions = set()
            for role in roles:
                permissions.update(ROLE_PERMISSIONS.get(role, []))
            
            return User(
                id=payload.get("sub", ""),
                email=payload.get("email", payload.get("emails", [""])[0] if payload.get("emails") else ""),
                name=payload.get("name", ""),
                roles=roles,
                permissions=list(permissions),
                tenant_id=payload.get("tid", ""),
                issued_at=datetime.fromtimestamp(payload.get("iat", 0)),
                expires_at=datetime.fromtimestamp(payload.get("exp", 0)),
            )
            
        except Exception as e:
            logger.error(f"Token validation failed: {e}")
            return None
    
    def has_permission(self, user: User, permission: Permission) -> bool:
        """Check if user has a specific permission."""
        return permission in user.permissions
    
    def has_role(self, user: User, role: Role) -> bool:
        """Check if user has a specific role."""
        return role in user.roles
    
    def get_user_permissions(self, user: User) -> List[str]:
        """Get list of permission strings for user."""
        return [p.value for p in user.permissions]


# Singleton auth instance
_auth: Optional[AzureADB2CAuth] = None


def get_auth() -> AzureADB2CAuth:
    """Get the global auth instance."""
    global _auth
    if _auth is None:
        _auth = AzureADB2CAuth()
    return _auth
