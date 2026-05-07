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

# Per-process presence store: user_id -> WebSocket (the volunteer portal keeps this open)
presence: Dict[int, WebSocket] = {}


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


async def _safe_send_json(ws: WebSocket, payload: dict):
    try:
        await ws.send_json(payload)
        return True
    except Exception:
        return False


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


# ── Presence WebSocket (always-on per logged-in volunteer) ─────────────────────
@router.websocket("/ws/presence")
async def presence_websocket(
    websocket: WebSocket,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    user = _token_to_user(token, db)
    if not user:
        await websocket.close(code=4001)
        return

    await websocket.accept()

    # If a previous presence socket exists for this user (e.g. tab reload), close it.
    old = presence.get(user.id)
    if old is not None and old is not websocket:
        try:
            await old.close()
        except Exception:
            pass
    presence[user.id] = websocket

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            mtype = msg.get("type")

            if mtype == "reject":
                # Callee rejected an incoming call → tell everyone in the room
                room_id = msg.get("room_id")
                for sock in list(rooms.get(room_id, [])):
                    await _safe_send_json(sock, {
                        "type": "call_rejected",
                        "by_user_id": user.id,
                        "by_name": user.full_name,
                    })
    except WebSocketDisconnect:
        pass
    finally:
        if presence.get(user.id) is websocket:
            del presence[user.id]


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
        # Ring the partner via their presence socket if they're online
        partner_a = db.query(models.Assignment).filter(
            models.Assignment.script_id == script_id,
            models.Assignment.volunteer_id != user.id,
        ).first()
        if partner_a:
            partner_ws = presence.get(partner_a.volunteer_id)
            if partner_ws is not None:
                await _safe_send_json(partner_ws, {
                    "type": "incoming_call",
                    "from_user_id": user.id,
                    "from_name": user.full_name,
                    "room_id": room_id,
                    "assignment_id": partner_a.id,
                    "script_id": script_id,
                    "script_title": a.script.title,
                })

    try:
        while True:
            data = await websocket.receive_text()
            # Relay message to the other peer in this room
            for other in list(rooms.get(room_id, [])):
                if other is not websocket:
                    await other.send_text(data)
    except WebSocketDisconnect:
        was_lone = (
            room_id in rooms
            and len(rooms[room_id]) == 1
            and websocket in rooms[room_id]
        )
        if room_id in rooms and websocket in rooms[room_id]:
            rooms[room_id].remove(websocket)

        # If the caller cancelled before the partner joined, stop the partner's ringtone.
        if was_lone:
            partner_a = db.query(models.Assignment).filter(
                models.Assignment.script_id == script_id,
                models.Assignment.volunteer_id != user.id,
            ).first()
            if partner_a:
                partner_ws = presence.get(partner_a.volunteer_id)
                if partner_ws is not None:
                    await _safe_send_json(partner_ws, {
                        "type": "call_cancelled",
                        "room_id": room_id,
                        "from_user_id": user.id,
                    })

        for other in list(rooms.get(room_id, [])):
            await _safe_send_json(other, {"type": "peer_left"})
        if room_id in rooms and not rooms[room_id]:
            del rooms[room_id]
