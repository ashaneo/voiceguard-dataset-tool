from fastapi import APIRouter, Depends, HTTPException, Header, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from database import get_db
import models, auth, schemas
import os, hmac

router = APIRouter()


class BootstrapBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1)
    participant_id: str = Field(default="ADMIN", min_length=1)


@router.post("/bootstrap", status_code=201)
def bootstrap_admin(
    body: BootstrapBody,
    x_bootstrap_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    """One-shot endpoint to create the very first admin. Inert once any admin exists."""
    expected = os.getenv("BOOTSTRAP_TOKEN")
    if not expected:
        raise HTTPException(503, "Bootstrap not configured (BOOTSTRAP_TOKEN env var missing)")
    if not x_bootstrap_token or not hmac.compare_digest(x_bootstrap_token, expected):
        raise HTTPException(401, "Invalid bootstrap token")

    existing = db.query(models.User).filter(models.User.role == models.UserRole.admin).first()
    if existing is not None:
        raise HTTPException(409, "An admin already exists; bootstrap is disabled")

    if db.query(models.User).filter(models.User.email == body.email).first():
        raise HTTPException(400, "Email already registered")
    if db.query(models.User).filter(models.User.participant_id == body.participant_id).first():
        raise HTTPException(400, "participant_id already taken")

    admin = models.User(
        participant_id=body.participant_id,
        full_name=body.full_name,
        email=body.email,
        password_hash=auth.hash_password(body.password),
        role=models.UserRole.admin,
        consent_signed=True,
        is_active=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return {"id": admin.id, "email": admin.email, "participant_id": admin.participant_id}


@router.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account disabled")
    token = auth.create_access_token(data={"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "name": user.full_name,
        "participant_id": user.participant_id,
    }

@router.get("/me")
def me(current_user: models.User = Depends(auth.get_current_user)):
    return {
        "id": current_user.id,
        "participant_id": current_user.participant_id,
        "name": current_user.full_name,
        "email": current_user.email,
        "role": current_user.role,
        "consent_signed": current_user.consent_signed,
    }
