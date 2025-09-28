#!/usr/bin/env python3
"""
MediaPipe pose extractor with angle computation and EMA smoothing.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import List, Optional, Tuple

import cv2
import mediapipe as mp
import numpy as np
import pandas as pd


def compute_angle(p1: np.ndarray, p2: np.ndarray, p3: np.ndarray) -> float:
    """Compute angle at p2 between p1-p2-p3 in radians (0 to π)."""
    v1 = p1 - p2
    v2 = p3 - p2
    
    # Normalize vectors
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    
    if norm1 < 1e-6 or norm2 < 1e-6:
        return 0.0
    
    v1 = v1 / norm1
    v2 = v2 / norm2
    
    # Compute cosine and clamp to avoid numerical errors
    cos_angle = np.clip(np.dot(v1, v2), -1.0, 1.0)
    angle = np.arccos(cos_angle)
    
    return float(angle)


def smooth_landmarks(prev_landmarks: Optional[np.ndarray], 
                    curr_landmarks: np.ndarray, 
                    alpha: float) -> np.ndarray:
    """Apply EMA smoothing to landmarks."""
    if prev_landmarks is None:
        return curr_landmarks.copy()
    
    # Smooth x, y, z but keep current visibility
    smoothed = alpha * curr_landmarks + (1 - alpha) * prev_landmarks
    smoothed[:, 3] = curr_landmarks[:, 3]  # Keep current visibility
    
    return smoothed


def extract_pose_from_video(video_path: str, 
                          jsonl_path: str,
                          csv_path: str,
                          overlay_path: Optional[str] = None,
                          sample_hz: float = 15.0,
                          alpha: float = 0.7) -> None:
    """Extract pose landmarks and compute angles from video."""
    
    # Initialize MediaPipe
    mp_pose = mp.solutions.pose
    mp_drawing = mp.solutions.drawing_utils
    
    # Open video
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Could not open video {video_path}")
        sys.exit(1)
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_interval = max(1, round(fps / sample_hz))
    
    # Get video dimensions
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # Setup output video if overlay requested
    out_video = None
    if overlay_path:
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out_video = cv2.VideoWriter(overlay_path, fourcc, sample_hz, (width, height))
    
    # Initialize pose detection
    pose = mp_pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        enable_segmentation=False,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )
    
    # Storage for results
    jsonl_data = []
    angle_data = []
    prev_landmarks = None
    frame_idx = 0
    
    # Landmark indices for angle computation
    L_SHOULDER, L_ELBOW, L_WRIST = 11, 13, 15
    R_SHOULDER, R_ELBOW, R_WRIST = 12, 14, 16
    L_HIP, L_KNEE, L_ANKLE = 23, 25, 27
    R_HIP, R_KNEE, R_ANKLE = 24, 26, 28
    
    print(f"Processing video: {video_path}")
    print(f"FPS: {fps:.1f}, Sample interval: {frame_interval}, Target Hz: {sample_hz}")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        # Sample frames
        if frame_idx % frame_interval == 0:
            timestamp = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
            
            # Convert BGR to RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Process with MediaPipe
            results = pose.process(rgb_frame)
            
            if results.pose_world_landmarks:
                # Use world landmarks (meters)
                landmarks = results.pose_world_landmarks.landmark
                landmark_array = np.array([[lm.x, lm.y, lm.z, lm.visibility] for lm in landmarks])
                print(f"world landmarks: {landmark_array}")
                use_world = True
            elif results.pose_landmarks:
                # Use normalized landmarks, convert to pixels
                landmarks = results.pose_landmarks.landmark
                landmark_array = np.array([[lm.x * width, lm.y * height, lm.z, lm.visibility] for lm in landmarks])
                use_world = False
            else:
                # No detection
                landmark_array = np.array([])
                use_world = False
            
            # Apply EMA smoothing if we have landmarks
            if len(landmark_array) > 0:
                landmark_array = smooth_landmarks(prev_landmarks, landmark_array, alpha)
                prev_landmarks = landmark_array.copy()
                
                # Compute angles
                angles = {}
                if len(landmark_array) >= 29:  # Ensure we have enough landmarks
                    # Left elbow
                    angles['elbow_L'] = compute_angle(
                        landmark_array[L_SHOULDER][:3],
                        landmark_array[L_ELBOW][:3],
                        landmark_array[L_WRIST][:3]
                    )
                    
                    # Right elbow
                    angles['elbow_R'] = compute_angle(
                        landmark_array[R_SHOULDER][:3],
                        landmark_array[R_ELBOW][:3],
                        landmark_array[R_WRIST][:3]
                    )
                    
                    # Left knee
                    angles['knee_L'] = compute_angle(
                        landmark_array[L_HIP][:3],
                        landmark_array[L_KNEE][:3],
                        landmark_array[L_ANKLE][:3]
                    )
                    
                    # Right knee
                    angles['knee_R'] = compute_angle(
                        landmark_array[R_HIP][:3],
                        landmark_array[R_KNEE][:3],
                        landmark_array[R_ANKLE][:3]
                    )
                else:
                    angles = {'elbow_L': 0.0, 'elbow_R': 0.0, 'knee_L': 0.0, 'knee_R': 0.0}
                
                # Store results
                jsonl_data.append({
                    "t": timestamp,
                    "ok": True,
                    "kp": landmark_array.tolist()
                })
                
                angle_data.append({
                    "t": timestamp,
                    **angles
                })
                
                # Draw overlay if requested
                if out_video and not use_world:
                    # Draw skeleton on frame
                    annotated_frame = frame.copy()
                    mp_drawing.draw_landmarks(
                        annotated_frame,
                        results.pose_landmarks,
                        mp_pose.POSE_CONNECTIONS,
                        mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=2),
                        mp_drawing.DrawingSpec(color=(0, 0, 255), thickness=2)
                    )
                    out_video.write(annotated_frame)
                elif out_video and use_world:
                    # For world landmarks, we need 2D landmarks for drawing
                    # Re-run with 2D detection for overlay
                    results_2d = pose.process(rgb_frame)
                    if results_2d.pose_landmarks:
                        annotated_frame = frame.copy()
                        mp_drawing.draw_landmarks(
                            annotated_frame,
                            results_2d.pose_landmarks,
                            mp_pose.POSE_CONNECTIONS,
                            mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=2),
                            mp_drawing.DrawingSpec(color=(0, 0, 255), thickness=2)
                        )
                        out_video.write(annotated_frame)
                    else:
                        out_video.write(frame)
            else:
                # No detection
                jsonl_data.append({
                    "t": timestamp,
                    "ok": False,
                    "kp": []
                })
                
                angle_data.append({
                    "t": timestamp,
                    "elbow_L": 0.0,
                    "elbow_R": 0.0,
                    "knee_L": 0.0,
                    "knee_R": 0.0
                })
                
                if out_video:
                    out_video.write(frame)
        
        frame_idx += 1
    
    # Cleanup
    cap.release()
    if out_video:
        out_video.release()
    pose.close()
    
    # Write outputs
    Path(jsonl_path).parent.mkdir(parents=True, exist_ok=True)
    Path(csv_path).parent.mkdir(parents=True, exist_ok=True)
    
    # Write JSONL
    with open(jsonl_path, 'w') as f:
        for item in jsonl_data:
            f.write(json.dumps(item) + '\n')
    
    # Write CSV
    df = pd.DataFrame(angle_data)
    df.to_csv(csv_path, index=False)
    
    print(f"\nDone.")
    print(f"- Landmarks: {jsonl_path}")
    print(f"- Angles:    {csv_path}")
    print(f"- Overlay:   {overlay_path or '(skipped)'}")


def main():
    parser = argparse.ArgumentParser(description='Extract pose landmarks and angles from video')
    parser.add_argument('--video', required=True, help='Path to input video')
    parser.add_argument('--jsonl', default='out/poses.jsonl', help='Output JSONL path')
    parser.add_argument('--csv', default='out/angles.csv', help='Output CSV path')
    parser.add_argument('--overlay', help='Output overlay video path')
    parser.add_argument('--sample_hz', type=float, default=15.0, help='Sampling frequency in Hz')
    parser.add_argument('--alpha', type=float, default=0.7, help='EMA smoothing factor (0-1)')
    
    args = parser.parse_args()
    
    # Validate inputs
    if not Path(args.video).exists():
        print(f"Error: Video file not found: {args.video}")
        sys.exit(1)
    
    if not (0 <= args.alpha <= 1):
        print("Error: Alpha must be between 0 and 1")
        sys.exit(1)
    
    try:
        extract_pose_from_video(
            video_path=args.video,
            jsonl_path=args.jsonl,
            csv_path=args.csv,
            overlay_path=args.overlay,
            sample_hz=args.sample_hz,
            alpha=args.alpha
        )
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
