from dotenv import load_dotenv
import os
import json
from pathlib import Path
from google import genai
from google.genai import types
from .prompt import prompt

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

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

    client = genai.Client(api_key=GOOGLE_API_KEY)
    frames_root = Path(frames_directory) if frames_directory else None

    def load_image_part(frame_name):
        if not frames_root or not frame_name:
            return None
        frame_path = frames_root / frame_name
        if not frame_path.exists():
            return None
        return types.Part.from_bytes(data=frame_path.read_bytes(), mime_type='image/jpeg')

    per_frame = []
    # For each suspicious motion event, call the model to get an analysis.
    for ev in suspicious_motion:
        current_frame = ev.get('frame', 'unknown')
        frame_list = ev.get('frames_context', [])
        contents = [
            types.Part.from_text(text=prompt),
            types.Part.from_text(text=f"Current frame: {current_frame}"),
            types.Part.from_text(text=f"Frames context: {frame_list}"),
            types.Part.from_text(text=f"Event details: {json.dumps(ev, default=str)}"),
        ]

        image_parts = [
            load_image_part(frame_name)
            for frame_name in [current_frame, *frame_list]
        ]
        contents.extend([part for part in image_parts if part is not None])

        try:
            response = client.models.generate_content(
                model="gemini-3.5-flash",
                contents=contents
            )
            # response may be complex; try to extract text safely
            text = None
            try:
                text = response.text
            except Exception as e:
                # if there is an error parsing the response, fall back to the raw response for debugging
                text = f"Error parsing Gemini response: {e}"
        except Exception as e:
            text = f"Gemini API call failed: {e}"

        per_frame.append({
            'frame': current_frame,
            'person_id': ev.get('person_id'),
            'side': ev.get('side'),
            'movement': ev.get('movement'),
            'analysis': text
        })

    return {'per_frame': per_frame}


    

