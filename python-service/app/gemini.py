from dotenv import load_dotenv
import os
from google import genai
from .prompt import prompt

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

def gemini_caregiver_abuse_analysis(suspicious_motion):
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

    per_frame = []
    # For each suspicious motion event, call the model to get an analysis.
    for ev in suspicious_motion:
        current_frame = ev.get('frame', 'unknown')
        frame_list = ev.get('frames_context', [])
        contents = [
            prompt,
            f"Current frame: {current_frame}",
            f"Frames context: {frame_list}",
            f"Event details: {ev}"
        ]

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


    

