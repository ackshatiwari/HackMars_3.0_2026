# GuardSight

## Inspiration

The foundation of GuardSight was built on a deeply troubling reality: caregiver abuse is one of the most underreported crimes in the world. Studies consistently show that approximately **90% of caregiver abuse cases are never formally reported**, meaning that the vast majority of victims—often elderly, cognitively impaired, or physically dependent individuals—have no voice and no witness to their suffering.

Every day, news stories surface about long-term abuse that went undetected for months or even years before finally coming to light, whether through a concerned neighbor, a medical examination, or an accidental discovery by a family member. This pattern reveals a systemic failure: the people most vulnerable to abuse are also the least equipped to report it.

What made this problem particularly urgent for us was the realization that abusers are allowed to simply walk away. Because care often happens in private settings—a bedroom, a care home room, a facility corridor—there are rarely witnesses. Without documentation or physical evidence, even when abuse is suspected, prosecution becomes nearly impossible. And even when a perpetrator is convicted, the damage to the victim has already been done: PTSD, depression, lasting physical injuries, broken trust, and the lingering trauma of having been harmed by someone who was supposed to protect them.

We wanted to change that environment entirely—not by adding more social workers or hotlines, but by removing the core condition that enables abuse: **the absence of a witness**.

GuardSight was born from the question:

> What if there was always a witness?

By combining AI-powered computer vision with real-time alerting, we set out to create a system that watches when no one else can, documents what it sees, and immediately notifies the people who care most.

---

## What It Does

GuardSight is a full-stack, AI-powered monitoring web application designed to detect caregiver abuse of elderly patients, dependent individuals, or children in real time. At its core, it uses computer vision and a large language model to analyze video footage and distinguish normal caregiving from aggressive or abusive handling—then immediately alerts emergency contacts when something suspicious is detected.

### Key Features

#### Dual-role Account System

Users register as either:

- **Patient** (the monitored individual or their representative)
- **Family Member** (a trusted contact who receives alerts)

Patients can link their account to a family member's email, enabling cross-account notification.

#### Patient Dashboard

Patients can manage:

- Profile information
- Medical conditions
- Emergency phone contacts
- Emergency email contacts
- Notification preferences

A safety checklist confirms that the account is properly configured before monitoring begins.

#### Live Video Recording and Real-Time Analysis

Using the browser Camera API, patients or caregivers can record video directly from the web application. Frames are streamed to the backend and analyzed in near real time while recording continues.

#### Video Upload for Retrospective Analysis

Pre-recorded videos can be uploaded and fully analyzed, enabling review of historical footage if abuse is suspected after the fact.

#### AI-Powered Abuse Classification

Every suspicious event is evaluated by Google Gemini and classified into one of five categories:

| Classification | Description |
|---------------|-------------|
| Normal caregiving assistance | Routine, expected physical interaction |
| Accidental movement | Unintentional contact with no harmful intent |
| Aggressive handling | Forceful or rough physical treatment |
| Potential physical abuse | Strong indicators of intentional harm |
| Unknown | Ambiguous, flagged for human review |

#### Instant Email Alerts

When abuse is detected, automated emails are dispatched to all configured emergency contacts. Each alert includes:

- Classification type
- Confidence score (0–1)
- Evidence-based written reason
- Attached frame images (before, during, and after the event) as visual proof

#### Family Dashboard

Family members can view a chronological, filterable log of all alerts associated with their linked patient, complete with thumbnails and detailed event metadata.

#### Persistent Report Database

All detected incidents are stored in PostgreSQL, creating a documented record that can support medical or legal intervention.

---

## How We Built It

GuardSight is built as a three-tier distributed system consisting of:

1. A React frontend
2. A Node.js/Express backend
3. A Python FastAPI service dedicated to AI and computer vision processing

### Tech Stack

| Layer | Technology | Purpose |
|---------|------------|----------|
| Frontend | React 19, Vite, CSS | UI, video capture, dashboard views |
| Backend API | Node.js, Express v5 | Authentication, routing, database access, email dispatch |
| AI/CV Service | Python, FastAPI, Uvicorn | Pose detection, frame analysis, Gemini integration |
| Database | Neon Serverless PostgreSQL | User data, linked accounts, abuse reports |
| Computer Vision | YOLOv8 (Ultralytics), OpenCV | Pose keypoint detection, frame processing |
| LLM Analysis | Google Gemini API | Behavioral classification of suspicious events |
| Email | Nodemailer | Emergency contact alerting |
| File Handling | Multer | Video upload and frame storage |

---

## The Computer Vision Pipeline

The core innovation behind GuardSight begins with **YOLOv8 pose detection**.

When a video is processed, every frame is passed through a pretrained YOLOv8 pose model, which identifies up to 17 body keypoints per person—including the nose, shoulders, elbows, wrists, hips, knees, and ankles.

We specifically focus on **wrist keypoints** because wrist motion is the most reliable proxy for striking or grabbing behavior.

### Motion Detection

The system tracks wrist positions frame-to-frame for each detected person using a persistent ID system that tolerates brief disappearances from the frame.

A suspicious event is flagged when:

- A wrist moves more than approximately 50 pixels within a 0.5-second window
- Multiple people are present in the scene

This two-condition requirement dramatically reduces false positives from normal self-motion or gesturing.

### Gemini Behavioral Analysis

Once an event is flagged:

1. A three-frame context window is captured:
   - Before the event
   - During the event
   - After the event

2. The frames, patient medical conditions, and a behavioral analysis prompt are sent to Google Gemini.

3. Gemini evaluates:
   - Motion intensity
   - Speed
   - Force
   - Body posture
   - Contextual clues

4. Gemini returns structured JSON containing:
   - Classification
   - Confidence score
   - Evidence-based explanation

The Gemini interaction is handled asynchronously through a background job queue with polling support, ensuring the system remains responsive even under load.

---

## Challenges We Ran Into

Building GuardSight required balancing two competing goals:

- Detecting real abuse reliably
- Avoiding excessive false positives

### Fine-Tuning Detection Sensitivity

Early versions of the system flagged nearly everything:

- A caregiver adjusting a pillow
- A nurse catching a falling object
- Routine mobility assistance
- Helping someone sit upright in bed

This was problematic because excessive false alarms reduce trust in the system.

#### Solutions

**Multi-person requirement**

If only one person appears in the frame, no abuse alert is generated.

**Medical-context prompting**

Patient medical conditions are included in the Gemini prompt, allowing the model to recognize:

- Spasms
- Fall-prevention grabs
- Physical therapy maneuvers

as expected behavior.

**Conservative classification bias**

Gemini is instructed to prioritize catching genuine abuse while using contextual medical information to avoid unnecessary escalation.

### Reducing Latency in the AI Response Loop

The original architecture was fully synchronous:

```text
Frontend → YOLO → Gemini → Response
```

This introduced delays of 5–10 seconds per event, making real-time monitoring impractical.

#### Solution: Asynchronous Processing

When YOLO flags an event:

1. A background job is created immediately
2. A unique job ID is returned
3. Processing continues without blocking

A dedicated endpoint:

```text
/gemini-result/{job_id}
```

allows the frontend to poll for completed results.

This dramatically reduced perceived latency and enabled concurrent event processing.

---

## Accomplishments That We're Proud Of

### Fully Functional End-to-End Application

GuardSight is not a prototype with hardcoded data. It includes:

- Real user authentication
- Neon-hosted PostgreSQL
- Persistent report storage
- Multi-page React frontend
- Live alerts
- Historical report review

### AI-Powered Abuse Detection Pipeline

The combination of YOLOv8 pose detection and Gemini behavioral analysis creates a fully automated workflow:

```text
Video → Detection → Classification → Alert
```

No human intervention is required.

### First Computer Vision Project for the Team

This was our team's first experience with:

- Pose estimation
- Keypoint analysis
- Multi-person tracking
- LLM-enhanced computer vision

Successfully shipping a working system was a major milestone.

### Solving a Real Problem

Many hackathon projects solve hypothetical problems. GuardSight addresses a real issue that harms vulnerable people every day.

We believe removing the "no witness" environment is a meaningful step toward protecting people who cannot protect themselves.

---

## What We Learned

### YOLOv8 and Pose Estimation

We learned:

- How pretrained pose models operate
- Keypoint extraction techniques
- Confidence threshold tuning
- Tracking individuals across frames

We also explored the trade-offs between model size and performance:

| Model | Size | Benefit |
|---------|------|----------|
| YOLOv8 Nano | 6.8 MB | Faster inference |
| YOLOv8 Medium | 53 MB | Higher accuracy |

### FastAPI and Async Python Architecture

We learned how to:

- Build asynchronous FastAPI services
- Handle multipart uploads
- Implement job queues
- Design AI microservices

The asynchronous Gemini job pattern is directly transferable to many long-running AI workloads.

### Prompt Engineering for Behavioral Analysis

Reliable behavioral classification required:

- Structured personas
- Strict output formats
- Well-defined classification categories
- Medical-context integration

This highlighted the importance of prompt design in LLM-powered systems.

---

## What's Next for GuardSight

GuardSight is currently a strong proof of concept. Our roadmap spans short-term, medium-term, and long-term goals.

### Short Term

#### Complete Video Upload Analysis Workflow

The backend processing exists, but the end-to-end user experience still requires refinement and testing.

#### Export Evidence Packages

Allow family members to download:

- Individual frames
- Complete event packages
- Before/during/after evidence bundles

for medical, legal, or personal records.

### Medium Term

#### Privacy-Preserving AI Models

Replace Gemini with a self-hosted vision model to:

- Eliminate third-party data sharing
- Improve privacy
- Support HIPAA-compliant deployments

#### Expanded Detection Signals

Add:

- Voice analysis
- Distress detection
- Fall detection
- Elbow and leg motion analysis
- Facial expression recognition

to improve accuracy and reduce false negatives.

#### Native Mobile Application

Develop dedicated:

- iOS applications
- Android applications

to enable passive monitoring using mobile devices.

### Long Term

#### Dedicated Smart Camera Hardware

A purpose-built device could include:

- Motorized servo tracking
- Active motion following
- 360° field-of-view coverage

reducing blind spots and making monitoring more robust.

#### Care Facility Integration

Integrate directly with:

- Nursing home management systems
- Compliance workflows
- Incident reporting platforms

allowing GuardSight to scale from a family-level safety tool to an institution-wide safeguard.

---

## Vision

> No vulnerable person should suffer abuse simply because nobody was there to witness it.

By combining computer vision, AI-powered behavioral analysis, and instant family notification, GuardSight creates accountability in environments where abuse has historically remained hidden.

## How to Set Up

GuardSight runs as three separate services. You will need **Node.js**, **Python 3.10+**, and a terminal open in the project root.

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [Python](https://www.python.org/) 3.10 or later
- A [Neon](https://neon.tech/) serverless PostgreSQL database
- A [Google Gemini API key](https://aistudio.google.com/app/apikey)
- A Gmail account with an [App Password](https://support.google.com/accounts/answer/185833) enabled for outgoing email alerts

---

### 1. Backend (Node.js / Express)

```bash
cd backend
npm install
```

Create a `.env` file by copying the example:

```bash
cp .env.example .env
```

Fill in the values:

```env
PORT=3000
DATABASE_URL=your_neon_database_url
PYTHON_SERVICE_URL=http://localhost:8000
GMAIL_APP_PASSWORD=your_gmail_app_password
GMAIL_USER=your_gmail_address@gmail.com
EMAIL_FROM_NAME=GuardSight
```

Start the server:

```bash
npm run dev      # development (nodemon)
npm start        # production
```

The backend will be available at `http://localhost:3000`.

---

### 2. Python AI / Computer Vision Service (FastAPI)

```bash
cd python-service/app
pip install -r requirements.txt
```

Create a `.env` file by copying the example:

```bash
cp ../env.example .env
```

Fill in the value:

```env
GOOGLE_API_KEY=your_google_gemini_api_key
```

Start the service:

```bash
uvicorn main:app --reload --port 8000
```

The Python service will be available at `http://localhost:8000`.

> **Note:** The YOLOv8 model files (`yolov8n-pose.pt` and `yolov8m-pose.pt`) are included in the project root. No additional model downloads are required.

---

### 3. Frontend (React / Vite)

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

---

### Running All Three Services

Open three separate terminal windows and start each service in the order listed above:

| Terminal | Directory | Command |
|----------|-----------|---------|
| 1 | `backend/` | `npm run dev` |
| 2 | `python-service/app/` | `uvicorn main:app --reload --port 8000` |
| 3 | `frontend/` | `npm run dev` |

Once all three are running, open `http://localhost:5173` in your browser to use the app.

---

**Made with ❤️ for HackMars 3.0**