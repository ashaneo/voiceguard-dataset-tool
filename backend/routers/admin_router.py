from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from auth import require_admin, hash_password
import models, schemas
from datetime import datetime
import random, string

router = APIRouter()

def gen_participant_id(db):
    while True:
        pid = "P" + "".join(random.choices(string.digits, k=3))
        if not db.query(models.User).filter(models.User.participant_id == pid).first():
            return pid

# ── Stats ──────────────────────────────────────────────────────────
@router.get("/stats")
def get_stats(db: Session = Depends(get_db), _=Depends(require_admin)):
    total_volunteers  = db.query(models.User).filter(models.User.role == models.UserRole.volunteer).count()
    total_recordings  = db.query(models.Recording).count()
    pending           = db.query(models.Recording).filter(models.Recording.status == models.RecordingStatus.pending).count()
    approved          = db.query(models.Recording).filter(models.Recording.status == models.RecordingStatus.approved).count()
    rejected          = db.query(models.Recording).filter(models.Recording.status == models.RecordingStatus.rejected).count()
    vishing_count     = db.query(models.Recording).join(models.Script).filter(models.Script.call_type == models.CallType.vishing).count()
    benign_count      = db.query(models.Recording).join(models.Script).filter(models.Script.call_type == models.CallType.benign).count()
    total_scripts     = db.query(models.Script).count()
    total_assignments = db.query(models.Assignment).count()
    completed_assignments = db.query(models.Assignment).filter(models.Assignment.completed == True).count()
    return {
        "volunteers": total_volunteers,
        "recordings": { "total": total_recordings, "pending": pending, "approved": approved, "rejected": rejected },
        "class_balance": { "vishing": vishing_count, "benign": benign_count },
        "scripts": total_scripts,
        "assignments": { "total": total_assignments, "completed": completed_assignments },
    }

# ── Volunteers ─────────────────────────────────────────────────────
@router.get("/volunteers")
def list_volunteers(db: Session = Depends(get_db), _=Depends(require_admin)):
    users = db.query(models.User).filter(models.User.role == models.UserRole.volunteer).all()
    result = []
    for u in users:
        completed = db.query(models.Assignment).filter(models.Assignment.volunteer_id == u.id, models.Assignment.completed == True).count()
        total_assigned = db.query(models.Assignment).filter(models.Assignment.volunteer_id == u.id).count()
        result.append({
            "id": u.id, "participant_id": u.participant_id, "full_name": u.full_name,
            "email": u.email, "has_android": u.has_android, "consent_signed": u.consent_signed,
            "is_active": u.is_active, "created_at": u.created_at,
            "assignments_total": total_assigned, "assignments_completed": completed,
        })
    return result

@router.post("/volunteers")
def create_volunteer(data: schemas.UserCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    if db.query(models.User).filter(models.User.email == data.email).first():
        raise HTTPException(400, "Email already registered")
    user = models.User(
        participant_id=gen_participant_id(db),
        full_name=data.full_name,
        email=data.email,
        password_hash=hash_password(data.password),
        role=models.UserRole.volunteer,
        has_android=data.has_android,
        notes=data.notes,
    )
    db.add(user); db.commit(); db.refresh(user)
    return {"participant_id": user.participant_id, "id": user.id, "full_name": user.full_name}

@router.patch("/volunteers/{user_id}")
def update_volunteer(user_id: int, data: schemas.UserUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(404, "User not found")
    if data.full_name is not None: user.full_name = data.full_name
    if data.has_android is not None: user.has_android = data.has_android
    if data.notes is not None: user.notes = data.notes
    if data.is_active is not None: user.is_active = data.is_active
    if data.consent_signed is not None:
        user.consent_signed = data.consent_signed
        if data.consent_signed: user.consent_date = datetime.utcnow()
    db.commit(); db.refresh(user)
    return user

# ── Scripts ────────────────────────────────────────────────────────
@router.get("/scripts")
def list_scripts(category: str = None, db: Session = Depends(get_db), _=Depends(require_admin)):
    q = db.query(models.Script)
    if category:
        q = q.filter(models.Script.category == category)
    scripts = q.all()
    result = []
    for s in scripts:
        assignment_count = db.query(models.Assignment).filter(models.Assignment.script_id == s.id).count()
        recording_count  = db.query(models.Recording).filter(models.Recording.script_id == s.id).count()
        assignees = db.query(models.Assignment).filter(models.Assignment.script_id == s.id).all()
        result.append({
            "id": s.id, "script_id": s.script_id, "title": s.title,
            "category": s.category, "call_type": s.call_type,
            "description": s.description, "content": s.content,
            "estimated_duration_sec": s.estimated_duration_sec,
            "expected_t_greeting": s.expected_t_greeting,
            "expected_t_setup": s.expected_t_setup,
            "expected_t_escalation": s.expected_t_escalation,
            "expected_t_harvest": s.expected_t_harvest,
            "created_at": s.created_at,
            "assignment_count": assignment_count,
            "recording_count": recording_count,
            "assignees": [
                {
                    "id": a.id,
                    "volunteer_id": a.volunteer_id,
                    "participant_id": a.volunteer.participant_id,
                    "full_name": a.volunteer.full_name,
                    "role": a.role,
                    "completed": a.completed,
                }
                for a in assignees
            ],
        })
    return result

@router.post("/scripts")
def create_script(data: schemas.ScriptCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    if db.query(models.Script).filter(models.Script.script_id == data.script_id).first():
        raise HTTPException(400, "Script ID already exists")
    script = models.Script(**data.dict())
    db.add(script); db.commit(); db.refresh(script)
    return script

@router.patch("/scripts/{script_id}")
def update_script(script_id: int, data: schemas.ScriptUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    script = db.query(models.Script).filter(models.Script.id == script_id).first()
    if not script: raise HTTPException(404, "Script not found")
    for field, val in data.dict(exclude_none=True).items():
        setattr(script, field, val)
    db.commit(); db.refresh(script)
    return {"ok": True}

@router.delete("/scripts/{script_id}")
def delete_script(script_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    script = db.query(models.Script).filter(models.Script.id == script_id).first()
    if not script: raise HTTPException(404, "Script not found")
    db.delete(script); db.commit()
    return {"ok": True}

# ── Assignments ────────────────────────────────────────────────────
@router.get("/assignments")
def list_assignments(db: Session = Depends(get_db), _=Depends(require_admin)):
    assignments = db.query(models.Assignment).order_by(models.Assignment.assigned_date.desc()).all()
    result = []
    for a in assignments:
        result.append({
            "id": a.id,
            "volunteer": {
                "id": a.volunteer.id,
                "participant_id": a.volunteer.participant_id,
                "full_name": a.volunteer.full_name,
            },
            "script": {
                "id": a.script.id,
                "script_id": a.script.script_id,
                "title": a.script.title,
                "category": a.script.category,
            },
            "role": a.role,
            "assigned_date": a.assigned_date,
            "completed": a.completed,
            "completed_date": a.completed_date,
        })
    return result

@router.post("/assignments")
def create_assignment(data: schemas.AssignmentCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    existing_count = db.query(models.Assignment).filter(models.Assignment.script_id == data.script_id).count()
    if existing_count >= 2:
        raise HTTPException(400, "This script already has 2 volunteers assigned (maximum capacity)")
    exists = db.query(models.Assignment).filter(
        models.Assignment.volunteer_id == data.volunteer_id,
        models.Assignment.script_id == data.script_id,
    ).first()
    if exists: raise HTTPException(400, "This volunteer is already assigned to this script")
    a = models.Assignment(**data.dict())
    db.add(a); db.commit(); db.refresh(a)
    return a

@router.delete("/assignments/{assignment_id}")
def delete_assignment(assignment_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    a = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not a: raise HTTPException(404, "Assignment not found")
    db.delete(a); db.commit()
    return {"ok": True}

# ── Recordings ─────────────────────────────────────────────────────
@router.get("/recordings")
def list_recordings(status: str = None, category: str = None, db: Session = Depends(get_db), _=Depends(require_admin)):
    q = db.query(models.Recording)
    if status: q = q.filter(models.Recording.status == status)
    if category: q = q.join(models.Script).filter(models.Script.category == category)
    recordings = q.order_by(models.Recording.submitted_at.desc()).all()
    result = []
    for r in recordings:
        result.append({
            "id": r.id, "recording_id": r.recording_id,
            "script": {"script_id": r.script.script_id, "title": r.script.title, "category": r.script.category, "call_type": r.script.call_type} if r.script else None,
            "scammer": r.scammer.participant_id if r.scammer else None,
            "victim": r.victim.participant_id if r.victim else None,
            "duration_sec": r.duration_sec, "file_name": r.file_name,
            "file_size_mb": r.file_size_mb, "audio_quality": r.audio_quality,
            "off_script": r.off_script, "status": r.status,
            "t_greeting": r.t_greeting, "t_setup": r.t_setup,
            "t_escalation": r.t_escalation, "t_harvest": r.t_harvest,
            "timestamps_verified": r.timestamps_verified,
            "admin_notes": r.admin_notes, "submitted_at": r.submitted_at,
        })
    return result

@router.patch("/recordings/{recording_id}/review")
def review_recording(recording_id: int, data: schemas.RecordingReview, db: Session = Depends(get_db), _=Depends(require_admin)):
    r = db.query(models.Recording).filter(models.Recording.id == recording_id).first()
    if not r: raise HTTPException(404, "Recording not found")
    for field, val in data.dict(exclude_none=True).items():
        setattr(r, field, val)
    r.reviewed_at = datetime.utcnow()
    # Mark assignment complete if approved
    if data.status == models.RecordingStatus.approved and r.assignment:
        r.assignment.completed = True
        r.assignment.completed_date = datetime.utcnow()
    db.commit(); db.refresh(r)
    return {"ok": True, "status": r.status}

@router.get("/recordings/{recording_id}/download")
def download_recording(recording_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    from fastapi.responses import FileResponse
    import os
    r = db.query(models.Recording).filter(models.Recording.id == recording_id).first()
    if not r or not r.file_path: raise HTTPException(404, "File not found")
    if not os.path.exists(r.file_path): raise HTTPException(404, "File missing from storage")
    return FileResponse(r.file_path, filename=r.file_name, media_type="audio/wav")
