from ultralytics import YOLO


model = YOLO("yolov8n-pose.pt")

# the goal of this is to detect caregiver abuse in the video footage.
# we will check for the following:
# - rapid arm / leg movement of the caregiver
# - Unusual proximity between the caregiver and the patient 

# How do we do this?
# - We can use the pose estimation to track the movement of the caregiver and the patient.
# - We can use the keypoints to determine the proximity between the caregiver and the patient.
# - We can use the keypoints to determine the movement of the caregiver and the patient.
# We can use the following keypoints to determine the movement of the caregiver and the patient:
# - 0: nose
# - 1: left eye
# - 2: right eye
# - 3: left ear
# - 4: right ear
# - 5: left shoulder
# - 6: right shoulder
# - 7: left elbow
# - 8: right elbow
# - 9: left wrist
# - 10: right wrist
# - 11: left hip
# - 12: right hip
# - 13: left knee
# - 14: right knee
# - 15: left ankle
# - 16: right ankle
