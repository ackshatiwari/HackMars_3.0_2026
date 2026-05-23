"""CLI entry for the detector processor."""
from .detector import main as detector_main, get_suspicious_motion, live_video_analysis
from .gemini import gemini_caregiver_abuse_analysis as gemini_analysis
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np

# env package
from dotenv import load_dotenv
import os
from pathlib import Path



app = FastAPI()

# Allow frontend/backend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()


app = FastAPI()

# Use package-relative directories for uploaded videos and extracted frames
app_dir = Path(__file__).resolve().parent
UPLOAD_DIRECTORY = str(app_dir.parent / 'uploads')
FRAME_DIRECTORY = str(app_dir.parent / 'frames')

# ensure directories exist
Path(UPLOAD_DIRECTORY).mkdir(parents=True, exist_ok=True)
Path(FRAME_DIRECTORY).mkdir(parents=True, exist_ok=True)

@app.post("/upload-video/")
async def upload_video(file: UploadFile = File(...)):
    # Save uploaded file into the python-service/uploads directory
    safe_name = Path(file.filename).name
    upload_dir = Path(UPLOAD_DIRECTORY)
    file_location = str(upload_dir / safe_name)
    try:
        contents = await file.read()
        with open(file_location, "wb+") as file_object:
            file_object.write(contents)

        # Run the detector on the uploaded video (may be CPU/GPU intensive)
        detector_main(video_path=file_location, frames_directory=FRAME_DIRECTORY)

        return {"message": "Video uploaded and processed successfully.", "saved_to": file_location}
    except Exception as e:
        # return JSON error so upstream can parse it
        import traceback
        tb = traceback.format_exc()
        print('Error processing upload-video:', e)
        print(tb)
        raise HTTPException(status_code=500, detail={
            "error": str(e),
            "traceback": tb.splitlines()[-10:]
        })

@app.get("/pass-to-gemini/")
async def pass_to_gemini():
    suspicious_motion = get_suspicious_motion()
    # Pass the suspicious_motion data to Gemini and return its analysis
    try:
        analysis = gemini_analysis(suspicious_motion, frames_directory=FRAME_DIRECTORY)
    except Exception as e:
        # return structured error
        raise HTTPException(status_code=500, detail={"error": str(e)})

    return {"suspicious_motion": suspicious_motion, "gemini_analysis": analysis}


@app.post("/analyze-frame/")
async def analyze_frame(
    frame: UploadFile = File(...),
    frame_before: UploadFile | None = File(None),
    frame_after_1: UploadFile | None = File(None),
    frame_after_2: UploadFile | None = File(None),
):
    async def decode_image(upload_file: UploadFile):

        contents = await upload_file.read()
        image_array = np.frombuffer(contents, dtype=np.uint8)
        image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

        if image is None:
            raise HTTPException(status_code=400, detail={"error": f"Could not decode image: {upload_file.filename}"})
        return image

    frames = []

    if frame_before is not None:
        frames.append(await decode_image(frame_before))
    frames.append(await decode_image(frame))

    if frame_after_1 is not None:
        frames.append(await decode_image(frame_after_1))
        
    if frame_after_2 is not None:
        frames.append(await decode_image(frame_after_2))

    suspicious_motion = live_video_analysis(frames=frames, frames_directory=FRAME_DIRECTORY)
    try:
        analysis = gemini_analysis(suspicious_motion, frames_directory=FRAME_DIRECTORY)
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": str(e)})
    return {"suspicious_motion": suspicious_motion, "gemini_analysis": analysis}
    