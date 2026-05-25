"""CLI entry for the detector processor."""
from .detector import main as detector_main, get_suspicious_motion, live_video_analysis
from .gemini import gemini_caregiver_abuse_analysis as gemini_analysis
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import uuid
import asyncio
import time
from datetime import datetime
import logging
import traceback
try:
    import httpx
except Exception:
    httpx = None

# env package
from dotenv import load_dotenv
import os
from pathlib import Path



app = FastAPI()
logger = logging.getLogger("uvicorn.error")

# Allow frontend/backend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()

# Use package-relative directories for uploaded videos and extracted frames
app_dir = Path(__file__).resolve().parent
UPLOAD_DIRECTORY = str(app_dir.parent / 'uploads')
FRAME_DIRECTORY = str(app_dir.parent / 'frames')

# ensure directories exist
Path(UPLOAD_DIRECTORY).mkdir(parents=True, exist_ok=True)
Path(FRAME_DIRECTORY).mkdir(parents=True, exist_ok=True)

# In-memory job store for async Gemini results
# structure: JOBS[job_id] = {"status": "pending"|"done"|"error", "suspicious_motion": [...], "gemini_analysis": {...} }
JOBS = {}


async def _run_gemini_job(job_id: str, suspicious_motion, frames_directory: str, medical_conditions: str | None = None, callback_url: str | None = None):
    try:
        JOBS[job_id]["stage"] = "gemini_starting"
        logger.info("Gemini job %s starting (%s suspicious events)", job_id, len(suspicious_motion) if suspicious_motion else 0)
        JOBS[job_id]["start_time"] = datetime.utcnow().isoformat() + 'Z'
        t0 = time.time()
        # Run the potentially blocking Gemini call in a thread to avoid blocking the event loop
        # If Gemini hangs, convert it to an error instead of leaving the job pending forever.
        JOBS[job_id]["stage"] = "gemini_running"
        result = await asyncio.wait_for(
            asyncio.to_thread(gemini_analysis, suspicious_motion, frames_directory, medical_conditions),
            timeout=90.0,
        )
        t1 = time.time()
        if isinstance(result, dict) and result.get('error'):
            JOBS[job_id]["gemini_analysis"] = result
            JOBS[job_id]["status"] = "error"
        else:
            JOBS[job_id]["gemini_analysis"] = result
            JOBS[job_id]["status"] = "done"
            JOBS[job_id]["stage"] = "gemini_done"
        JOBS[job_id]["end_time"] = datetime.utcnow().isoformat() + 'Z'
        JOBS[job_id]["elapsed_ms"] = int((t1 - t0) * 1000)
        logger.info("Gemini job %s finished in %sms with status=%s", job_id, JOBS[job_id]["elapsed_ms"], JOBS[job_id]["status"])

        # If a callback URL was provided, attempt to POST the result to it using a long-lived httpx client
        if callback_url:
            payload = {"job_id": job_id, "suspicious_motion": suspicious_motion, "gemini_analysis": result}
            try:
                JOBS[job_id]["stage"] = "callback_posting"
                client = getattr(app.state, 'httpx_client', None)
                if client is not None:
                    await client.post(callback_url, json=payload)
                else:
                    # fall back to a short-lived client if persistent client isn't available
                    if httpx is not None:
                        async with httpx.AsyncClient(timeout=30.0, http2=True) as tmp_client:
                            await tmp_client.post(callback_url, json=payload)
                    else:
                        import requests

                        def _post():
                            try:
                                requests.post(callback_url, json=payload, timeout=30.0)
                            except Exception:
                                pass

                        await asyncio.to_thread(_post)
                JOBS[job_id]["stage"] = "callback_done"
            except Exception:
                # don't fail the job if callback delivery fails
                JOBS[job_id]["stage"] = "callback_failed"
                JOBS[job_id]["last_error"] = "Callback delivery failed"
                logger.exception("Callback delivery failed for job %s", job_id)
    except asyncio.TimeoutError:
        JOBS[job_id]["status"] = "error"
        JOBS[job_id]["end_time"] = datetime.utcnow().isoformat() + 'Z'
        JOBS[job_id]["elapsed_ms"] = int((time.time() - t0) * 1000)
        JOBS[job_id]["stage"] = "gemini_timeout"
        JOBS[job_id]["last_error"] = "Gemini analysis timed out after 90s"
        JOBS[job_id]["gemini_analysis"] = {
            "error": "Gemini analysis timed out after 90s",
        }
        logger.error("Gemini job %s timed out after 90s", job_id)
    except Exception as e:
        JOBS[job_id]["status"] = "error"
        JOBS[job_id]["end_time"] = datetime.utcnow().isoformat() + 'Z'
        JOBS[job_id]["elapsed_ms"] = int((time.time() - t0) * 1000)
        JOBS[job_id]["stage"] = "gemini_failed"
        JOBS[job_id]["last_error"] = str(e)
        JOBS[job_id]["last_error_traceback"] = traceback.format_exc()
        JOBS[job_id]["gemini_analysis"] = {"error": str(e), "traceback": traceback.format_exc()}
        logger.exception("Gemini job %s failed", job_id)


@app.on_event("startup")
async def preload_model_on_startup():
    # Preload the YOLO model to avoid cold-start latency on first request
    try:
        from . import detector
        detector.ensure_model_loaded()
        print("Detector model preloaded at startup.")
    except Exception as e:
        print("Warning: failed to preload detector model:", e)
    # initialize a long-lived httpx AsyncClient for callbacks and reuse
    if httpx is not None:
        try:
            app.state.httpx_client = httpx.AsyncClient(timeout=30.0, http2=True)
            print("httpx AsyncClient initialized (http2=True).")
        except Exception as e:
            app.state.httpx_client = None
            print("Warning: failed to create httpx AsyncClient:", e)
    else:
        app.state.httpx_client = None


@app.on_event("shutdown")
async def shutdown_cleanup():
    # close the persistent httpx client if present
    client = getattr(app.state, 'httpx_client', None)
    if client is not None:
        try:
            await client.aclose()
        except Exception:
            pass

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
    if not suspicious_motion:
        return {"suspicious_motion": suspicious_motion, "gemini_analysis": {"per_frame": []}}

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
    frame_after: UploadFile | None = File(None),
    medical_conditions: str | None = File(None),
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
    if frame_after is not None:
        frames.append(await decode_image(frame_after))

    suspicious_motion = live_video_analysis(frames=frames, frames_directory=FRAME_DIRECTORY)

    # If no suspicious motion, return immediately with empty analysis (no job created)
    if not suspicious_motion:
        return {"job_id": None, "suspicious_motion": suspicious_motion, "gemini_analysis": {"per_frame": []}}

    # create a job and schedule background Gemini analysis
    job_id = str(uuid.uuid4())
    JOBS[job_id] = {
        "status": "pending",
        "suspicious_motion": suspicious_motion,
        "gemini_analysis": None,
        "created_at": datetime.utcnow().isoformat() + 'Z',
        "start_time": None,
        "end_time": None,
        "elapsed_ms": None,
        "stage": "queued",
        "last_error": None,
    }

    # optional callback URL support: accept ?callback_url=... on request
    # try to read it from headers or query params
    callback_url = None
    # query params are not directly available in this signature; check headers for an optional X-Callback-Url
    if "x-callback-url" in (app.extra or {}):
        callback_url = app.extra.get("x-callback-url")
    # but allow callers to set header 'X-Callback-Url'
    # FastAPI allows access via request if needed; to keep compatibility, read from environ headers
    # try to import Request to read real header if present
    try:
        from fastapi import Request
        # attempt to get Request from current scope via contextvars (best-effort)
        # If unavailable, skip callback_url extraction here; callers can use polling endpoint
    except Exception:
        pass

    # schedule the background task
    task = asyncio.create_task(_run_gemini_job(job_id, suspicious_motion, FRAME_DIRECTORY, medical_conditions, callback_url))

    def _log_task_result(done_task: asyncio.Task):
        try:
            exc = done_task.exception()
            if exc is not None:
                JOBS[job_id]["status"] = "error"
                JOBS[job_id]["stage"] = "task_exception"
                JOBS[job_id]["last_error"] = str(exc)
                JOBS[job_id]["last_error_traceback"] = ''.join(traceback.format_exception(type(exc), exc, exc.__traceback__))
                logger.exception("Unhandled exception in Gemini job task %s", job_id)
        except asyncio.CancelledError:
            JOBS[job_id]["status"] = "error"
            JOBS[job_id]["stage"] = "task_cancelled"
            JOBS[job_id]["last_error"] = "Gemini job task was cancelled"
            logger.error("Gemini job task cancelled for %s", job_id)
        except Exception:
            logger.exception("Failed to inspect Gemini job task %s", job_id)

    task.add_done_callback(_log_task_result)

    return {"job_id": job_id, "suspicious_motion": suspicious_motion, "gemini_analysis": {"status": "pending"}}


@app.get("/gemini-result/{job_id}")
async def gemini_result(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail={"error": "job_id not found"})
    return {
        "job_id": job_id,
        "status": job.get("status"),
        "stage": job.get("stage"),
        "last_error": job.get("last_error"),
        "last_error_traceback": job.get("last_error_traceback"),
        "created_at": job.get("created_at"),
        "start_time": job.get("start_time"),
        "end_time": job.get("end_time"),
        "elapsed_ms": job.get("elapsed_ms"),
        "suspicious_motion": job.get("suspicious_motion"),
        "gemini_analysis": job.get("gemini_analysis"),
    }
    