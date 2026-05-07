from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
from jose import JWTError, jwt
import models, os, json
from typing import Dict, List

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "voiceguard-secret-change-in-production")
ALGORITHM  = "HS256"

# In-memory per-process room store: room_id -> list of connected WebSockets
rooms: Dict[str, List[WebSocket]] = {}


def _token_to_user(token: str, db: Session):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        uid = payload.get("sub")
        if not uid:
            return None
    except JWTError:
        return None
    return db.query(models.User).filter(
        models.User.id == int(uid),
        models.User.is_active == True,
    ).first()


# ── Room info (HTTP) ───────────────────────────────────────────────────────────
@router.get("/room/{assignment_id}")
def get_room_info(
    assignment_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    a = db.query(models.Assignment).filter(
        models.Assignment.id == assignment_id,
        models.Assignment.volunteer_id == user.id,
    ).first()
    if not a:
        raise HTTPException(403, "Assignment not found")

    partner_a = db.query(models.Assignment).filter(
        models.Assignment.script_id == a.script_id,
        models.Assignment.volunteer_id != user.id,
    ).first()
    partner = {
        "full_name": partner_a.volunteer.full_name,
        "participant_id": partner_a.volunteer.participant_id,
        "role": partner_a.role.value,
    } if partner_a else None

    return {
        "room_id": f"script-{a.script_id}",
        "script_id": a.script_id,
        "script_title": a.script.title,
        "role": a.role.value,
        "partner": partner,
    }


# ── WebSocket signaling ────────────────────────────────────────────────────────
@router.websocket("/ws/{room_id}")
async def call_websocket(
    websocket: WebSocket,
    room_id: str,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    user = _token_to_user(token, db)
    if not user:
        await websocket.close(code=4001)
        return

    # room_id format: "script-{script_id}"
    try:
        script_id = int(room_id.split("-", 1)[1])
    except (ValueError, IndexError):
        await websocket.close(code=4002)
        return

    a = db.query(models.Assignment).filter(
        models.Assignment.volunteer_id == user.id,
        models.Assignment.script_id == script_id,
    ).first()
    if not a and user.role != models.UserRole.admin:
        await websocket.close(code=4003)
        return

    await websocket.accept()

    if room_id not in rooms:
        rooms[room_id] = []

    if len(rooms[room_id]) >= 2:
        await websocket.send_json({"type": "error", "message": "Room is full. Only 2 participants allowed."})
        await websocket.close()
        return

    peer = rooms[room_id][0] if rooms[room_id] else None
    rooms[room_id].append(websocket)

    if peer:
        # We're second — we initiate the offer
        await websocket.send_json({"type": "peer_present"})
        await peer.send_json({"type": "peer_joined"})
    else:
        await websocket.send_json({"type": "waiting"})

    try:
        while True:
            data = await websocket.receive_text()
            # Relay message to the other peer in this room
            for other in list(rooms.get(room_id, [])):
                if other is not websocket:
                    await other.send_text(data)
    except WebSocketDisconnect:
        if room_id in rooms and websocket in rooms[room_id]:
            rooms[room_id].remove(websocket)
        for other in list(rooms.get(room_id, [])):
            try:
                await other.send_json({"type": "peer_left"})
            except Exception:
                pass
        if room_id in rooms and not rooms[room_id]:
            del rooms[room_id]
