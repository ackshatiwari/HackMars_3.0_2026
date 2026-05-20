from ultralytics import YOLO
import cv2
import os

cap = cv2.VideoCapture("python-service\\app\\input.mp4")
os.makedirs("frames", exist_ok=True)

# delete existing frames
for filename in os.listdir("frames"):
    file_path = os.path.join("frames", filename)
    if os.path.isfile(file_path):
        os.remove(file_path)
    

count = 0
saved = 0

while True:
    ret, frame = cap.read()
    fps = cap.get(cv2.CAP_PROP_FPS)
    # timestamp = frame count / fps
    timestamp = count / fps

    if not ret:
        break

    if count % 5 == 0:
        cv2.imwrite(
            f"frames/frame_{timestamp:.2f}.jpg",
            frame
        )
        saved += 1

    count += 1

cap.release()

# extract the wrist keypoint and detect if the wrist moved at a fast rate, then it will be considered a punch or strike
model = YOLO("yolov8m-pose.pt")

latest_left_wrist_position = None
latest_right_wrist_position = None

# wrist movement threshold must be width / 10 of the frame
def detect_punches():
    for filename in os.listdir("frames"):

        image_path = os.path.join("frames", filename)
        image = cv2.imread(image_path)
        width = image.shape[1]

        wrist_movement_threshold = width / 10

        if filename.endswith(".jpg"):
            image_path = os.path.join("frames", filename)
            results = model(image_path)
            keypoints = results[0].keypoints.xy

            # extract keypoint number 9 and 10 which are the left and right wrist keypoints

            left_wrist = keypoints[0][8]
            right_wrist = keypoints[0][9]

            print(f"Left wrist: {left_wrist}, Right wrist: {right_wrist}")

            # calculate the movement of the left wrist compared to the last position
            if latest_left_wrist_position is not None:

                left_wrist_movement = ((left_wrist[0] - latest_left_wrist_position[0]) ** 2 + (left_wrist[1] - latest_left_wrist_position[1]) ** 2) ** 0.5

                print(f"Left wrist movement: {left_wrist_movement}")

                if left_wrist_movement > wrist_movement_threshold:
                    print("Left wrist moved fast, possible punch or strike detected!")
                    left_wrist_movement = 0
                    right_wrist_movement = 0


            # calculate the movement of the right wrist compared to the last position
            if latest_right_wrist_position is not None:

                right_wrist_movement = ((right_wrist[0] - latest_right_wrist_position[0]) ** 2 + (right_wrist[1] - latest_right_wrist_position[1]) ** 2) ** 0.5

                print(f"Right wrist movement: {right_wrist_movement}")

                if right_wrist_movement > wrist_movement_threshold:
                    print("Right wrist moved fast, possible punch or strike detected!")
                    left_wrist_movement = 0
                    right_wrist_movement = 0

            latest_left_wrist_position = left_wrist
            latest_right_wrist_position = right_wrist




"""

results = model("python-service/app/image.jpg")

# extract the keypoints from the results

keypoints = results[0].keypoints
print(keypoints)
"""