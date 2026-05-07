from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import engine, SessionLocal
import models
from auth import hash_password
from routers import auth_router, admin_router, volunteer_router, call_router

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="VoiceGuard Dataset Portal", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router.router,      prefix="/api/auth",      tags=["auth"])
app.include_router(admin_router.router,     prefix="/api/admin",     tags=["admin"])
app.include_router(volunteer_router.router, prefix="/api/volunteer", tags=["volunteer"])
app.include_router(call_router.router,      prefix="/api/call",      tags=["call"])

# Seed default admin on startup
@app.on_event("startup")
def seed_admin():
    db = SessionLocal()
    try:
        admin = db.query(models.User).filter(models.User.email == "admin@voiceguard.research").first()
        if not admin:
            admin = models.User(
                participant_id="ADMIN",
                full_name="Admin",
                email="admin@voiceguard.research",
                password_hash=hash_password("voiceguard2024"),
                role=models.UserRole.admin,
                consent_signed=True,
                is_active=True,
            )
            db.add(admin)
            db.commit()
            print("✓ Default admin created: admin@voiceguard.research / voiceguard2024")
    finally:
        db.close()

