from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine
import models
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

