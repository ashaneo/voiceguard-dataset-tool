from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
import models, schemas
from datetime import datetime
from pathlib import Path
import os, uuid

router = APIRouter()
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/uploads"))

# ── My assignments ─────────────────────────────────────────────────
@router.get("/assignments")
def my_assignments(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    assignments = db.query(models.Assignment).filter(models.Assignment.volunteer_id == user.id).all()
    result = []
    for a in assignments:
        rec = a.recording
        partner_a = db.query(models.Assignment).filter(
            models.Assignment.script_id == a.script_id,
            models.Assignment.volunteer_id != user.id,
        ).first()
        partner = {
            "full_name": partner_a.volunteer.full_name,
            "participant_id": partner_a.volunteer.participant_id,
            "role": partner_a.role.value,
        } if partner_a else None
        result.append({
            "id": a.id,
            "script": {
                "id": a.script.id,
                "script_id": a.script.script_id,
                "title": a.script.title,
                "category": a.script.category,
                "call_type": a.script.call_type,
                "description": a.script.description,
                "estimated_duration_sec": a.script.estimated_duration_sec,
                "expected_t_greeting": a.script.expected_t_greeting,
                "expected_t_setup": a.script.expected_t_setup,
                "expected_t_escalation": a.script.expected_t_escalation,
                "expected_t_harvest": a.script.expected_t_harvest,
                "has_content": bool(a.script.content),
            },
            "role": a.role,
            "assigned_date": a.assigned_date,
            "completed": a.completed,
            "partner": partner,
            "recording": {
                "recording_id": rec.recording_id,
                "status": rec.status,
                "submitted_at": rec.submitted_at,
                "audio_quality": rec.audio_quality,
                "admin_notes": rec.admin_notes,
            } if rec else None,
        })
    return result

# ── Script content ─────────────────────────────────────────────────
@router.get("/scripts/{script_id}")
def get_script(script_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    # Verify volunteer is assigned to this script
    a = db.query(models.Assignment).filter(
        models.Assignment.volunteer_id == user.id,
        models.Assignment.script_id == script_id,
    ).first()
    if not a and user.role != models.UserRole.admin:
        raise HTTPException(403, "Not assigned to this script")
    script = db.query(models.Script).filter(models.Script.id == script_id).first()
    if not script: raise HTTPException(404, "Script not found")
    return script

# ── Submit recording ───────────────────────────────────────────────
@router.post("/recordings/submit")
async def submit_recording(
    assignment_id:  int        = Form(...),
    duration_sec:   int        = Form(None),
    audio_quality:  str        = Form(None),
    off_script:     bool       = Form(False),
    off_script_notes: str      = Form(None),
    t_greeting:     int        = Form(None),
    t_setup:        int        = Form(None),
    t_escalation:   int        = Form(None),
    t_harvest:      int        = Form(None),
    volunteer_notes: str       = Form(None),
    recording_date: str        = Form(None),
    audio_file:     UploadFile = File(...),
    db: Session                = Depends(get_db),
    user: models.User          = Depends(get_current_user),
):
    # Verify assignment belongs to this user
    assignment = db.query(models.Assignment).filter(
        models.Assignment.id == assignment_id,
        models.Assignment.volunteer_id == user.id,
    ).first()
    if not assignment: raise HTTPException(403, "Assignment not found")
    if assignment.recording:
        existing = assignment.recording
        if existing.status != models.RecordingStatus.rejected:
            raise HTTPException(400, "Recording already submitted for this assignment")
        # Allow resubmission of rejected recordings — remove old file and record
        if existing.file_path and os.path.exists(existing.file_path):
            os.remove(existing.file_path)
        db.delete(existing)
        db.flush()

    # Save file
    ext = Path(audio_file.filename).suffix.lower() or ".wav"
    unique_name = f"{uuid.uuid4()}{ext}"
    save_path = UPLOAD_DIR / unique_name
    save_path.parent.mkdir(parents=True, exist_ok=True)

    content = await audio_file.read()
    with open(save_path, "wb") as f:
        f.write(content)
    file_size_mb = len(content) / (1024 * 1024)

    # Generate recording ID
    script = assignment.script
    category_code = script.category.value.upper()[:3]
    count = db.query(models.Recording).count() + 1
    recording_id = f"call_{category_code}_{count:03d}"

    # Parse date
    rec_date = None
    if recording_date:
        try: rec_date = datetime.fromisoformat(recording_date)
        except: pass

    # Create recording
    scammer_id = user.id if assignment.role == models.ParticipantRole.scammer else None
    victim_id  = user.id if assignment.role == models.ParticipantRole.victim  else None

    recording = models.Recording(
        recording_id=recording_id,
        assignment_id=assignment_id,
        script_id=assignment.script_id,
        scammer_id=scammer_id,
        victim_id=victim_id,
        recording_date=rec_date,
        duration_sec=duration_sec,
        file_path=str(save_path),
        file_name=audio_file.filename,
        file_size_mb=round(file_size_mb, 2),
        audio_quality=audio_quality,
        off_script=off_script,
        off_script_notes=off_script_notes,
        t_greeting=t_greeting,
        t_setup=t_setup,
        t_escalation=t_escalation,
        t_harvest=t_harvest,
        volunteer_notes=volunteer_notes,
        status=models.RecordingStatus.pending,
    )
    db.add(recording); db.commit(); db.refresh(recording)
    return {"ok": True, "recording_id": recording_id, "message": "Recording submitted successfully"}

# ── Consent acknowledgement ────────────────────────────────────────
@router.post("/consent/acknowledge")
def acknowledge_consent(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.consent_signed:
        return {"ok": True, "already_signed": True}
    user.consent_signed = True
    user.consent_date = datetime.utcnow()
    db.commit()
    return {"ok": True, "already_signed": False}

# ── Change password ────────────────────────────────────────────────
@router.post("/change-password")
def change_password(data: schemas.PasswordChange, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    from auth import verify_password, hash_password
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    if len(data.new_password) < 6:
        raise HTTPException(400, "New password must be at least 6 characters")
    user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"ok": True}

# ── Delete own recording ───────────────────────────────────────────
@router.delete("/recordings/{recording_id}")
def delete_recording(recording_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    r = db.query(models.Recording).filter(models.Recording.recording_id == recording_id).first()
    if not r:
        raise HTTPException(404, "Recording not found")
    if r.scammer_id != user.id and r.victim_id != user.id:
        raise HTTPException(403, "Not authorized to delete this recording")
    # If the assignment was marked completed (admin approved), roll it back
    if r.assignment and r.assignment.completed:
        r.assignment.completed = False
        r.assignment.completed_date = None
    # Delete audio file from disk
    if r.file_path and os.path.exists(r.file_path):
        os.remove(r.file_path)
    db.delete(r)
    db.commit()
    return {"ok": True}

# ── My recordings ──────────────────────────────────────────────────
@router.get("/recordings")
def my_recordings(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    recordings = db.query(models.Recording).filter(
        (models.Recording.scammer_id == user.id) | (models.Recording.victim_id == user.id)
    ).order_by(models.Recording.submitted_at.desc()).all()
    result = []
    for r in recordings:
        result.append({
            "recording_id": r.recording_id,
            "script_title": r.script.title if r.script else None,
            "script_category": r.script.category if r.script else None,
            "status": r.status,
            "audio_quality": r.audio_quality,
            "submitted_at": r.submitted_at,
            "admin_notes": r.admin_notes,
            "duration_sec": r.duration_sec,
        })
    return result
