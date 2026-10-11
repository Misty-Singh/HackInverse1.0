# CampusPrep AI

Placement-prep platform for GNIT: AI mock interviews (Hinglish-friendly), teacher-set quizzes,
study materials, and per-student progress tracking, with role-based access for **students, teachers and admins**.

---

## 🌐 Live Demo & Video Walkthrough

- **Live Application:** [https://campusprep-ai.onrender.com](https://campusprep-ai.onrender.com)
- **YouTube Demo Video:** [https://youtu.be/9ezp2klkZBI?si=ATCEgxQn9q-RprLU]

---

## 📁 File & Project Structure

```text
campusprep-fullstack/
├── public/                 # Frontend (HTML, CSS, JS single-page application)
├── server/                 # Backend Node.js / Express application
│   ├── data/               # Persistent data storage
│   │   ├── uploads/        # Uploaded study materials and resources
│   │   ├── .jwt_secret     # Auto-generated JWT secret backup
│   │   └── db.json         # JSON database store
│   ├── routes/             # API Express routes (auth, materials, progress, quizzes)
│   ├── auth.js             # Authentication middleware & password verification
│   ├── db.js               # Database helper functions
│   ├── seed.js             # Database seeder for demo accounts & sample data
│   └── server.js           # Server entry point & API routes setup
├── .env                    # Local environment variables configuration
├── .env.example            # Environment variables template
├── .gitignore              # Files ignored by Git
├── package.json            # Node.js dependencies & scripts
└── README.md               # Project documentation





## System Architecture Flow Diagram
[ Client (Browser) ]
   │
   ├──▶ Web Speech API (Speech-to-Text & Audio Capture)
   │
   ├──▶ HTTP / REST API Requests (JWT Authenticated)
   │         │
   │         ▼
   │  [ Express.js Server ]
   │         │
   │         ├──▶ Auth & Middleware (RBAC: Student / Teacher / Admin Verification)
   │         │
   │         ├──▶ Anthropic API (Claude Model - Evaluation & Feedback)
   │         │
   │         └──▶ Local Database Engine (server/data/db.json)



## Run it

```bash
npm install
cp .env.example .env        # then edit .env (see below)
npm run seed                # optional: demo accounts + sample data
npm start                   # http://localhost:3000  (use Chrome)
```

In `.env`: set `ANTHROPIC_API_KEY` (for AI questions/scoring) and change `ADMIN_PASSWORD`.
Without an API key everything still works; mock interviews use a fallback question set and rough scoring.

**Demo logins after `npm run seed`** (password `demo1234`): `teacher@gnit.demo`, `riya@gnit.demo`, `arjun@gnit.demo`, `sneha@gnit.demo`.
Admin = the `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` (default `admin@campusprep.local` / `Admin@12345`).

## Roles

| | Student | Teacher | Admin |
|---|---|---|---|
| Sign up | Instant | Needs admin approval | Created from `.env` only |
| AI mock interview | ✓ (saved to progress) | – | – |
| Take quizzes, see own progress & charts | ✓ | – | – |
| Download study material | ✓ (own branch) | ✓ | ✓ |
| Create/publish quizzes, see results | – | ✓ (own) | ✓ (all) |
| Upload materials & links | – | ✓ (own) | ✓ (all) |
| Manage interview question bank | – | ✓ | ✓ |
| See every student's progress | – | ✓ | ✓ |
| Approve/disable/delete users, change roles | – | – | ✓ |

Permissions are enforced on the **server** for every request (the UI hiding a button is not the security).

## Stack

- **Frontend:** plain HTML/CSS/JS single-page app in `public/` (no build step)
- **Backend:** Node.js + Express, routes in `server/routes/`
- **Auth:** bcrypt password hashing + signed JWT (7 days); role/status re-checked from the DB on every request
- **AI:** Anthropic API called server-side only (key never reaches the browser)
- **Speech:** browser Web Speech API (Chrome)
- **Storage:** JSON file `server/data/db.json`, uploads in `server/data/uploads/`

## Notes for deploying

- Mic/camera work on `localhost` or `https://` only.
- The JSON-file database and local uploads suit a demo / single server. On hosts with ephemeral disks
  (e.g. Render free tier) data resets on redeploy. For real use, move `server/db.js` to SQLite/Postgres and uploads to object storage.
- Set `JWT_SECRET` and `ADMIN_PASSWORD` as environment variables on the host. Never commit `.env`.

## Not built yet
- Real eye-contact tracking (camera is preview-only; MediaPipe FaceMesh is the natural next step)
- Password reset / email verification
- Transcripts are deliberately **not stored**, only scores and feedback, for student privacy
