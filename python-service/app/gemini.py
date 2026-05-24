from dotenv import load_dotenv
import os
import json
import time
import traceback
from pathlib import Path
from google import genai
from google.genai import types
from .prompt import prompt

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Module-scoped GenAI client (reuse connections)
GENAI_CLIENT = None
if GOOGLE_API_KEY:
    try:
        GENAI_CLIENT = genai.Client(api_key=GOOGLE_API_KEY)
    except Exception:
        GENAI_CLIENT = None

def gemini_caregiver_abuse_analysis(suspicious_motion, frames_directory=None):
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
    # use only the current frame thumbnail to reduce payload and latency
    contents = [
        types.Part.from_text(text=prompt),
        types.Part.from_text(text=f"Current frame: {current_frame}"),
        types.Part.from_text(text=f"Event details: {json.dumps(strongest_event, default=str)}"),
    ]

    thumb = load_thumbnail_part(current_frame)
    if thumb is not None:
        contents.append(thumb)

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


    

