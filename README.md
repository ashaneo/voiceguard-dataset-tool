# VoiceGuard Dataset Portal

A web application for managing the VoiceGuard vishing detection dataset collection — volunteer management, script assignment, recording submission, and admin review.

## Quick start

```bash
# 1. Clone / copy this directory
cd voiceguard-app

# 2. Start everything
docker compose up --build

# 3. Open http://localhost:8000

# Default admin credentials:
#   Email:    admin@voiceguard.research
#   Password: voiceguard2024
```

## What it does

### Volunteer portal (`/volunteer`)
- See assigned scripts and role (scammer / victim)
- Read full script content
- Submit recording with audio file upload
- Fill in phase timestamps (t_greeting, t_setup, t_escalation, t_harvest)
- Track submission status and read admin feedback

### Admin portal (`/admin`)
- Dashboard with dataset statistics and class balance
- Review recordings — verify timestamps, set quality, approve/reject
- Add volunteers with auto-generated participant IDs
- Add scripts with expected phase timestamps
- Assign scripts to volunteers with a specific role

## Architecture

```
docker-compose.yml
├── db        — PostgreSQL 16
└── app       — FastAPI + SQLAlchemy
      ├── /api/auth/*      — JWT login
      ├── /api/admin/*     — admin endpoints
      ├── /api/volunteer/* — volunteer endpoints
      └── /frontend/*      — static HTML pages
```

## File layout

```
voiceguard-app/
├── backend/
│   ├── main.py            — FastAPI app + startup
│   ├── models.py          — SQLAlchemy ORM models
│   ├── schemas.py         — Pydantic request/response schemas
│   ├── database.py        — DB connection
│   ├── auth.py            — JWT auth utilities
│   ├── routers/
│   │   ├── auth_router.py
│   │   ├── admin_router.py
│   │   └── volunteer_router.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── index.html         — Login page
│   ├── volunteer.html     — Volunteer portal
│   ├── admin.html         — Admin portal
│   └── static/css/style.css
├── uploads/               — Audio file storage (Docker volume)
├── scripts_store/         — Script PDF storage (optional)
└── docker-compose.yml
```

## Data model

- **users** — volunteers + admins with participant IDs
- **scripts** — vishing/benign scripts with expected phase timestamps
- **assignments** — volunteer ↔ script ↔ role mappings
- **recordings** — submitted recordings with timestamps, quality, review status

## After recording is approved

Export the Recording Log to CSV and run your chunking pipeline:

```python
import pandas as pd

df = pd.read_csv("recordings_export.csv")
for _, row in df.iterrows():
    process_call(
        wav_path   = row['file_path'],
        call_id    = row['recording_id'],
        call_type  = row['call_type'],
        boundaries = [
            (row['t_greeting'],   'greeting'),
            (row['t_setup'],      'setup'),
            (row['t_escalation'], 'escalation'),
            (row['t_harvest'],    'harvest'),
        ]
    )
```

## Security notes

- Change `SECRET_KEY` in `docker-compose.yml` before deploying
- Change the default admin password immediately after first login
- Audio files are stored in the `uploads/` volume — back this up
- The database is in the `pg_data` Docker volume — back this up too
