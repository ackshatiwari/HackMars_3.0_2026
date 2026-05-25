import os
import json
import time
import traceback
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types
from .prompt import prompt

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
# Module-scoped GenAI client (reuse connections)
GENAI_CLIENT = None
if GOOGLE_API_KEY:
    try:
        GENAI_CLIENT = genai.Client(api_key=GOOGLE_API_KEY)
    except Exception:
        GENAI_CLIENT = None

def gemini_caregiver_abuse_analysis(suspicious_motion, frames_directory=None, medical_conditions=None):
    if not GOOGLE_API_KEY:
        # Fall back to a mock analysis when no API key is present.
        analyses = []
        for ev in suspicious_motion:
            analyses.append({
                'frame': ev.get('frame'),
                'person_id': ev.get('person_id'),
                'side': ev.get('side'),
                'movement': ev.get('movement'),
                'analysis': 'GOOGLE_API_KEY not set; returning mock analysis.'
            })
        return {'per_frame': analyses}
    # Use module-scoped GenAI client
    client = GENAI_CLIENT
    if client is None:
        # fallback: attempt to create a temporary client
        try:
            client = genai.Client(api_key=GOOGLE_API_KEY)
        except Exception as e:
            return {
                'per_frame': [],
                'error': f'Failed to initialize Gemini client: {e}',
                'traceback': traceback.format_exc(),
            }
    frames_root = Path(frames_directory) if frames_directory else None

    if not suspicious_motion:
        return {'per_frame': []}

    strongest_event = max(
        suspicious_motion,
        key=lambda ev: float(ev.get('movement') or 0),
    )

    # helper to load and optionally resize a single thumbnail image
    def load_thumbnail_part(frame_name, max_width=320):
        if not frames_root or not frame_name:
            return None
        frame_path = frames_root / frame_name
        if not frame_path.exists():
            return None
        # read and resize with OpenCV to keep payload small
        import cv2
        import numpy as np

        data = frame_path.read_bytes()
        arr = np.frombuffer(data, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return None
        h, w = img.shape[:2]
        if w > max_width:
            scale = max_width / float(w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)))
        # re-encode as JPEG
        ret, buf = cv2.imencode('.jpg', img, [int(cv2.IMWRITE_JPEG_QUALITY), 60])
        if not ret:
            return None
        return types.Part.from_bytes(data=buf.tobytes(), mime_type='image/jpeg')

    current_frame = strongest_event.get('frame', 'unknown')
    medical_conditions_text = str(medical_conditions or '').strip()

    medical_context_part = None
    if medical_conditions_text:
        medical_context_part = types.Part.from_text(
            text=(
                f"THE PATIENT HAS BEEN DIAGNOSED WITH {medical_conditions_text.upper()}. "
                f"THIS IS CRITICAL CONTEXT. YOU MUST ACCOUNT FOR THIS CONDITION WHEN ASSESSING THE SCENE. "
                f"DO NOT DISMISS OR DOWNPLAY POSSIBLE ABUSE JUST BECAUSE THE PERSON'S MOVEMENT, POSTURE, "
                f"OR REACTION MAY LOOK DIFFERENT DUE TO THE MEDICAL CONDITION. "
                f"IF THE BEHAVIOR, CONTACT, FORCE, OR REACTION STILL SUGGESTS HARM, ESCALATE IT AS POSSIBLE ABUSE."
            )
        )
    # include prompt, a short textual summary, and the event details
    contents = [
        types.Part.from_text(text=prompt),
        *([medical_context_part] if medical_context_part is not None else []),
        types.Part.from_text(text=f"Current frame: {current_frame}"),
        types.Part.from_text(text=f"Event details: {json.dumps(strongest_event, default=str)}"),
    ]

    # attach current frame thumbnail (if available)
    thumb = load_thumbnail_part(current_frame)
    if thumb is not None:
        contents.append(thumb)

    # attach adjacent context frames (before and after) when present in the event's frames_context
    try:
        frames_ctx = strongest_event.get('frames_context') or []
        # ensure a stable order
        frames_ctx = sorted(frames_ctx)
        if current_frame in frames_ctx:
            idx = frames_ctx.index(current_frame)
            frame_before = frames_ctx[idx - 1] if idx - 1 >= 0 else None
            frame_after = frames_ctx[idx + 1] if idx + 1 < len(frames_ctx) else None
        else:
            # fallback: pick first and last as before/after candidates
            frame_before = frames_ctx[0] if len(frames_ctx) >= 1 else None
            frame_after = frames_ctx[-1] if len(frames_ctx) >= 2 else None

        if frame_before and frame_before != current_frame:
            part_before = load_thumbnail_part(frame_before)
            if part_before is not None:
                contents.append(part_before)

        if frame_after and frame_after != current_frame:
            part_after = load_thumbnail_part(frame_after)
            if part_after is not None:
                contents.append(part_after)
    except Exception:
        # be conservative: don't fail the overall analysis if context frames can't be read
        pass

    try:
        started_at = time.time()
        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=contents
        )
        elapsed_ms = int((time.time() - started_at) * 1000)
        # response may be complex; try to extract text safely
        text = None
        try:
            text = response.text
        except Exception as e:
            text = f"Error parsing Gemini response: {e}"
    except Exception as e:
        return {
            'per_frame': [],
            'error': f'Gemini API call failed: {e}',
            'traceback': traceback.format_exc(),
        }

    return {
        'per_frame': [{
            'frame': current_frame,
            'person_id': strongest_event.get('person_id'),
            'side': strongest_event.get('side'),
            'movement': strongest_event.get('movement'),
            'analysis': text,
            'gemini_elapsed_ms': elapsed_ms
        }]
    }


    

