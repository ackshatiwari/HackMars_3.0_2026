from ultralytics import YOLO
import cv2
import os
import math

# Globals filled by setup()
model = None
frames_dir = "frames"

suspicious_motion = []  


def setup(video_path="python-service\\app\\input.mp4", frames_directory="frames", frame_step=3, model_path="yolov8m-pose.pt"):
    """Prepare frames and initialize the YOLO pose model.

    This clears/creates `frames_directory`, extracts frames from `video_path`
    every `frame_step` frames, and loads the YOLO model from `model_path`.
    It sets module-level `model` and `frames_dir` so `detect_punches()` can use them.
    """
    global model, frames_dir
    frames_dir = frames_directory

    os.makedirs(frames_dir, exist_ok=True)

    # delete existing frames
    for filename in os.listdir(frames_dir):
        file_path = os.path.join(frames_dir, filename)
        if os.path.isfile(file_path):
            os.remove(file_path)

    if not os.path.exists(video_path):
        print(f"Warning: video path '{video_path}' does not exist. Skipping frame extraction.")
    else:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"Warning: failed to open video '{video_path}'. Skipping frame extraction.")
        else:
            count = 0
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                fps = cap.get(cv2.CAP_PROP_FPS) or 30
                timestamp = count / fps if fps else count

                if count % frame_step == 0:
                    out_path = os.path.join(frames_dir, f"frame_{timestamp:.2f}.jpg")
                    cv2.imwrite(out_path, frame)

                count += 1

            cap.release()

    # load model
    model = YOLO(model_path)


# Robust multi-person punch detection that tolerates people leaving the frame.
def detect_punches():
    # prev_people: list of dicts {id, left: (x,y), right: (x,y), missed}
    prev_people = []
    next_id = 0

    # process frames in order
    frames = sorted([f for f in os.listdir(frames_dir) if f.endswith(".jpg")])
    for filename in frames:
        image_path = os.path.join(frames_dir, filename)
        image = cv2.imread(image_path)
        if image is None:
            continue
        width = image.shape[1]
        wrist_movement_threshold = width / 10

        results = model(image)
        # keypoints may be None or empty when no person detected

        try:
            kps = results[0].keypoints.xy
        except Exception:
            kps = None

        if kps is None or len(kps) == 0:
            # no detections: mark previous people as missed
            for p in prev_people:
                p['missed'] += 1
            # drop people missed for too long
            prev_people = [p for p in prev_people if p['missed'] < 5]
            continue

        new_prev = []
        used_prev_idxs = set()

        for person_kp in kps:
            # ensure the wrist keypoints exist for this person
            if len(person_kp) <= 10:
                # not enough keypoints detected for this person, skip
                continue
            left = tuple(person_kp[9])
            right = tuple(person_kp[10])

            # match to previous person by nearest left-wrist (simple heuristic)
            best_idx = None
            best_dist = float('inf')
            for i, p in enumerate(prev_people):
                d = math.hypot(left[0] - p['left'][0], left[1] - p['left'][1])
                if d < best_dist:
                    best_dist = d
                    best_idx = i

            if best_idx is None or best_dist > width * 0.5:
                # new person
                pid = next_id
                next_id += 1
                new_prev.append({'id': pid, 'left': left, 'right': right, 'missed': 0})
            else:
                p = prev_people[best_idx]
                left_m = math.hypot(left[0] - p['left'][0], left[1] - p['left'][1])
                right_m = math.hypot(right[0] - p['right'][0], right[1] - p['right'][1])

                if left_m > wrist_movement_threshold:
                    print(f"Person {p['id']}: left wrist moved {left_m:.1f} -> possible punch")

                    if filename not in suspicious_motion:
                        # append the type (always high_motion_event), the person id, the frame (current, previous, and next frame for context), and the movement distance
                        suspicious_motion.append({
                            'type': 'high_motion_event',
                            'person_id': p['id'],
                            'frames': [f for f in frames if abs(float(f.split('_')[1][:-4]) - float(filename.split('_')[1][:-4])) <= 0.5],
                            'movement': left_m
                        })

                if right_m > wrist_movement_threshold:
                    print(f"Person {p['id']}: right wrist moved {right_m:.1f} -> possible punch")
                    if filename not in suspicious_motion:
                        suspicious_motion.append({
                            'type': 'high_motion_event',
                            'person_id': p['id'],
                            'frames': [f for f in frames if abs(float(f.split('_')[1][:-4]) - float(filename.split('_')[1][:-4])) <= 0.5],
                            'movement': right_m
                        })

                new_prev.append({'id': p['id'], 'left': left, 'right': right, 'missed': 0})
                used_prev_idxs.add(best_idx)

        # carry over unmatched previous people (but increase missed)
        for i, p in enumerate(prev_people):
            if i not in used_prev_idxs:
                p['missed'] += 1
                if p['missed'] < 5:
                    new_prev.append(p)

        prev_people = new_prev


def get_suspicious_motion():
    return suspicious_motion

def main(video_path="python-service\\app\\input.mp4", frames_directory="frames", frame_step=3, model_path="yolov8m-pose.pt"):
    setup(video_path=video_path, frames_directory=frames_directory, frame_step=frame_step, model_path=model_path)
    detect_punches()



if __name__ == "__main__":
    main()