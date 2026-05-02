from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum

class UserRole(str, enum.Enum):
    admin = "admin"
    volunteer = "volunteer"

class CallType(str, enum.Enum):
    vishing = "vishing"
    benign = "benign"

class AttackCategory(str, enum.Enum):
    irs = "irs"
    bank = "bank"
    tech_support = "tech_support"
    social_security = "social_security"
    prize = "prize"
    utility = "utility"
    benign = "benign"

class ParticipantRole(str, enum.Enum):
    scammer = "scammer"
    victim = "victim"

class RecordingStatus(str, enum.Enum):
    pending = "pending"
    reviewed = "reviewed"
    approved = "approved"
    rejected = "rejected"

class AudioQuality(str, enum.Enum):
    good = "good"
    acceptable = "acceptable"
    poor = "poor"

class User(Base):
    __tablename__ = "users"
    id              = Column(Integer, primary_key=True, index=True)
    participant_id  = Column(String, unique=True, index=True, nullable=False)
    full_name       = Column(String, nullable=False)
    email           = Column(String, unique=True, index=True, nullable=False)
    password_hash   = Column(String, nullable=False)
    role            = Column(Enum(UserRole), default=UserRole.volunteer)
    has_android     = Column(Boolean, default=False)
    consent_signed  = Column(Boolean, default=False)
    consent_date    = Column(DateTime, nullable=True)
    notes           = Column(Text, nullable=True)
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime, server_default=func.now())
    assignments     = relationship("Assignment", back_populates="volunteer", foreign_keys="Assignment.volunteer_id")
    recordings_as_scammer = relationship("Recording", back_populates="scammer", foreign_keys="Recording.scammer_id")
    recordings_as_victim  = relationship("Recording", back_populates="victim",  foreign_keys="Recording.victim_id")

class Script(Base):
    __tablename__ = "scripts"
    id              = Column(Integer, primary_key=True, index=True)
    script_id       = Column(String, unique=True, index=True, nullable=False)
    title           = Column(String, nullable=False)
    category        = Column(Enum(AttackCategory), nullable=False)
    call_type       = Column(Enum(CallType), nullable=False)
    description     = Column(Text, nullable=True)
    content         = Column(Text, nullable=True)
    file_path       = Column(String, nullable=True)
    estimated_duration_sec = Column(Integer, nullable=True)
    expected_t_greeting    = Column(Integer, nullable=True)
    expected_t_setup       = Column(Integer, nullable=True)
    expected_t_escalation  = Column(Integer, nullable=True)
    expected_t_harvest     = Column(Integer, nullable=True)
    created_at      = Column(DateTime, server_default=func.now())
    assignments     = relationship("Assignment", back_populates="script")
    recordings      = relationship("Recording", back_populates="script")

class Assignment(Base):
    __tablename__ = "assignments"
    id              = Column(Integer, primary_key=True, index=True)
    volunteer_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    script_id       = Column(Integer, ForeignKey("scripts.id"), nullable=False)
    role            = Column(Enum(ParticipantRole), nullable=False)
    assigned_date   = Column(DateTime, server_default=func.now())
    completed       = Column(Boolean, default=False)
    completed_date  = Column(DateTime, nullable=True)
    volunteer       = relationship("User", back_populates="assignments", foreign_keys=[volunteer_id])
    script          = relationship("Script", back_populates="assignments")
    recording       = relationship("Recording", back_populates="assignment", uselist=False)

class Recording(Base):
    __tablename__ = "recordings"
    id              = Column(Integer, primary_key=True, index=True)
    recording_id    = Column(String, unique=True, index=True, nullable=False)
    assignment_id   = Column(Integer, ForeignKey("assignments.id"), nullable=True)
    script_id       = Column(Integer, ForeignKey("scripts.id"), nullable=False)
    scammer_id      = Column(Integer, ForeignKey("users.id"), nullable=True)
    victim_id       = Column(Integer, ForeignKey("users.id"), nullable=True)
    recording_date  = Column(DateTime, nullable=True)
    duration_sec    = Column(Integer, nullable=True)
    file_path       = Column(String, nullable=True)
    file_name       = Column(String, nullable=True)
    file_size_mb    = Column(Float, nullable=True)
    audio_quality   = Column(Enum(AudioQuality), nullable=True)
    off_script      = Column(Boolean, default=False)
    off_script_notes = Column(Text, nullable=True)
    t_greeting      = Column(Integer, nullable=True)
    t_setup         = Column(Integer, nullable=True)
    t_escalation    = Column(Integer, nullable=True)
    t_harvest       = Column(Integer, nullable=True)
    timestamps_verified = Column(Boolean, default=False)
    status          = Column(Enum(RecordingStatus), default=RecordingStatus.pending)
    admin_notes     = Column(Text, nullable=True)
    volunteer_notes = Column(Text, nullable=True)
    chunking_done   = Column(Boolean, default=False)
    chunks_generated = Column(Integer, nullable=True)
    manifest_added  = Column(Boolean, default=False)
    submitted_at    = Column(DateTime, server_default=func.now())
    reviewed_at     = Column(DateTime, nullable=True)
    assignment      = relationship("Assignment", back_populates="recording")
    script          = relationship("Script", back_populates="recordings")
    scammer         = relationship("User", back_populates="recordings_as_scammer", foreign_keys=[scammer_id])
    victim          = relationship("User", back_populates="recordings_as_victim",  foreign_keys=[victim_id])
