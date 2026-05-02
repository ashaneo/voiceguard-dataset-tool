from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from models import UserRole, CallType, AttackCategory, ParticipantRole, RecordingStatus, AudioQuality

class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    has_android: bool = False
    notes: Optional[str] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    has_android: Optional[bool] = None
    consent_signed: Optional[bool] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class UserOut(BaseModel):
    id: int
    participant_id: str
    full_name: str
    email: str
    role: UserRole
    has_android: bool
    consent_signed: bool
    consent_date: Optional[datetime]
    notes: Optional[str]
    is_active: bool
    created_at: datetime
    class Config: from_attributes = True

class ScriptCreate(BaseModel):
    script_id: str
    title: str
    category: AttackCategory
    call_type: CallType
    description: Optional[str] = None
    content: Optional[str] = None
    estimated_duration_sec: Optional[int] = None
    expected_t_greeting: Optional[int] = None
    expected_t_setup: Optional[int] = None
    expected_t_escalation: Optional[int] = None
    expected_t_harvest: Optional[int] = None

class ScriptOut(BaseModel):
    id: int
    script_id: str
    title: str
    category: AttackCategory
    call_type: CallType
    description: Optional[str]
    content: Optional[str]
    estimated_duration_sec: Optional[int]
    expected_t_greeting: Optional[int]
    expected_t_setup: Optional[int]
    expected_t_escalation: Optional[int]
    expected_t_harvest: Optional[int]
    created_at: datetime
    class Config: from_attributes = True

class AssignmentCreate(BaseModel):
    volunteer_id: int
    script_id: int
    role: ParticipantRole

class AssignmentOut(BaseModel):
    id: int
    volunteer_id: int
    script_id: int
    role: ParticipantRole
    assigned_date: datetime
    completed: bool
    completed_date: Optional[datetime]
    script: ScriptOut
    class Config: from_attributes = True

class RecordingSubmit(BaseModel):
    assignment_id: int
    recording_date: Optional[datetime] = None
    duration_sec: Optional[int] = None
    audio_quality: Optional[AudioQuality] = None
    off_script: bool = False
    off_script_notes: Optional[str] = None
    t_greeting: Optional[int] = None
    t_setup: Optional[int] = None
    t_escalation: Optional[int] = None
    t_harvest: Optional[int] = None
    volunteer_notes: Optional[str] = None

class RecordingReview(BaseModel):
    status: Optional[RecordingStatus] = None
    audio_quality: Optional[AudioQuality] = None
    timestamps_verified: Optional[bool] = None
    t_greeting: Optional[int] = None
    t_setup: Optional[int] = None
    t_escalation: Optional[int] = None
    t_harvest: Optional[int] = None
    admin_notes: Optional[str] = None

class ScriptUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[AttackCategory] = None
    call_type: Optional[CallType] = None
    description: Optional[str] = None
    content: Optional[str] = None
    estimated_duration_sec: Optional[int] = None
    expected_t_greeting: Optional[int] = None
    expected_t_setup: Optional[int] = None
    expected_t_escalation: Optional[int] = None
    expected_t_harvest: Optional[int] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class RecordingOut(BaseModel):
    id: int
    recording_id: str
    script_id: int
    scammer_id: Optional[int]
    victim_id: Optional[int]
    recording_date: Optional[datetime]
    duration_sec: Optional[int]
    file_name: Optional[str]
    file_size_mb: Optional[float]
    audio_quality: Optional[AudioQuality]
    off_script: bool
    off_script_notes: Optional[str]
    t_greeting: Optional[int]
    t_setup: Optional[int]
    t_escalation: Optional[int]
    t_harvest: Optional[int]
    timestamps_verified: bool
    status: RecordingStatus
    admin_notes: Optional[str]
    volunteer_notes: Optional[str]
    submitted_at: datetime
    reviewed_at: Optional[datetime]
    script: ScriptOut
    class Config: from_attributes = True
