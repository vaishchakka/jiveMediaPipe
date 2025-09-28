#!/usr/bin/env python3
"""
Simple API server to serve MediaPipe pose data to the React frontend.
"""

import json
import csv
import os
import math
from pathlib import Path
from flask import Flask, jsonify, send_file, send_from_directory, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Paths to data files
POSES_JSONL = "out/poses.jsonl"
ANGLES_CSV = "out/angles.csv"
OVERLAY_VIDEO = "out/overlay.mp4"
ORIGINAL_VIDEO = "videos/dance.mov"

# Global variables for pose comparison
reference_poses = []
current_pose_index = 0

def load_reference_poses():
    """Load reference poses from JSONL file."""
    global reference_poses
    if not os.path.exists(POSES_JSONL):
        return False
    
    try:
        with open(POSES_JSONL, 'r') as f:
            for line in f:
                if line.strip():
                    reference_poses.append(json.loads(line))
        return True
    except Exception as e:
        print(f"Error loading reference poses: {e}")
        return False

def calculate_pose_similarity(ref_pose, live_pose):
    """Calculate similarity between reference and live poses."""
    if not ref_pose or not live_pose or not ref_pose.get('kp') or not live_pose.get('kp'):
        print("❌ Missing pose data")
        return 0
    
    ref_landmarks = ref_pose['kp']
    live_landmarks = live_pose['kp']
    
    # Handle landmark count mismatch by using the minimum length
    min_length = min(len(ref_landmarks), len(live_landmarks))
    if min_length < 10:  # Need at least 10 landmarks for meaningful comparison
        print(f"❌ Too few landmarks: ref={len(ref_landmarks)}, live={len(live_landmarks)}")
        return 0
    
    if len(ref_landmarks) != len(live_landmarks):
        print(f"⚠️ Landmark count mismatch: ref={len(ref_landmarks)}, live={len(live_landmarks)}, using {min_length}")
        # Truncate to minimum length
        ref_landmarks = ref_landmarks[:min_length]
        live_landmarks = live_landmarks[:min_length]
    
    # Key joint indices for comparison (shoulders, elbows, wrists, hips, knees, ankles)
    key_points = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
    
    total_distance = 0
    valid_points = 0
    
    for index in key_points:
        if index < len(ref_landmarks) and index < len(live_landmarks):
            ref_point = ref_landmarks[index]
            live_point = live_landmarks[index]
            
            # Check visibility (4th element is visibility score)
            if ref_point[3] > 0.5 and live_point[3] > 0.5:
                # Calculate Euclidean distance
                distance = math.sqrt(
                    (ref_point[0] - live_point[0]) ** 2 +
                    (ref_point[1] - live_point[1]) ** 2
                )
                total_distance += distance
                valid_points += 1
    
    if valid_points == 0:
        print("❌ No valid points for comparison")
        return 0
    
    # Convert distance to similarity percentage
    average_distance = total_distance / valid_points
    print(f"🔍 Average distance: {average_distance:.3f}, Valid points: {valid_points}")
    
    # Much more lenient scoring
    similarity = max(0, 100 - (average_distance * 20))
    print(f"🎯 Similarity: {similarity:.1f}%")
    return min(100, similarity)

def calculate_score(similarity):
    """Calculate score based on pose similarity."""
    if similarity >= 90:
        return 100  # Perfect
    elif similarity >= 80:
        return 80   # Great
    elif similarity >= 70:
        return 60   # Good
    elif similarity >= 60:
        return 40   # Fair
    elif similarity >= 50:
        return 20   # Poor
    else:
        return 0    # Miss

@app.route('/')
def root():
    """Root endpoint for debugging."""
    return jsonify({
        "message": "MediaPipe Pose API Server",
        "endpoints": [
            "/api/poses",
            "/api/angles", 
            "/api/video",
            "/api/status",
            "/api/process"
        ]
    })

@app.route('/api/poses')
def get_poses():
    """Serve pose data as JSON."""
    if not os.path.exists(POSES_JSONL):
        return jsonify({"error": "Pose data not found. Run pose extraction first."}), 404
    
    poses = []
    try:
        with open(POSES_JSONL, 'r') as f:
            for line in f:
                if line.strip():
                    poses.append(json.loads(line))
        return jsonify(poses)
    except Exception as e:
        return jsonify({"error": f"Error reading pose data: {str(e)}"}), 500

@app.route('/api/angles')
def get_angles():
    """Serve angle data as JSON."""
    if not os.path.exists(ANGLES_CSV):
        return jsonify({"error": "Angle data not found. Run pose extraction first."}), 404
    
    angles = []
    try:
        with open(ANGLES_CSV, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Convert string values to float
                for key in ['t', 'elbow_L', 'elbow_R', 'knee_L', 'knee_R']:
                    if key in row:
                        row[key] = float(row[key])
                angles.append(row)
        return jsonify(angles)
    except Exception as e:
        return jsonify({"error": f"Error reading angle data: {str(e)}"}), 500

@app.route('/api/video')
def get_video():
    """Serve the original user video."""
    if os.path.exists(ORIGINAL_VIDEO):
        response = send_file(ORIGINAL_VIDEO)
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Headers'] = 'Range'
        response.headers['Accept-Ranges'] = 'bytes'
        return response
    else:
        return jsonify({"error": "No video found"}), 404

@app.route('/api/status')
def get_status():
    """Get processing status."""
    status = {
        "poses_available": os.path.exists(POSES_JSONL),
        "angles_available": os.path.exists(ANGLES_CSV),
        "overlay_available": os.path.exists(OVERLAY_VIDEO),
        "original_video": os.path.exists(ORIGINAL_VIDEO)
    }
    return jsonify(status)

@app.route('/api/compare-pose', methods=['POST'])
def compare_pose():
    """Compare live pose with reference pose and return score."""
    global current_pose_index
    
    try:
        data = request.get_json()
        live_pose = data.get('live_pose')
        
        if not live_pose:
            return jsonify({"error": "No live pose data provided"}), 400
        
        # Load reference poses if not already loaded
        if not reference_poses:
            if not load_reference_poses():
                return jsonify({"error": "Reference poses not available"}), 404
        
        # Get current reference pose (cycle through poses)
        if current_pose_index >= len(reference_poses):
            current_pose_index = 0
        
        ref_pose = reference_poses[current_pose_index]
        current_pose_index = (current_pose_index + 1) % len(reference_poses)
        
        # Calculate similarity and score
        similarity = calculate_pose_similarity(ref_pose, live_pose)
        score = calculate_score(similarity)
        
        return jsonify({
            "similarity": round(similarity, 2),
            "score": score,
            "points_earned": score,
            "message": get_score_message(score)
        })
        
    except Exception as e:
        return jsonify({"error": f"Error comparing poses: {str(e)}"}), 500

def get_score_message(score):
    """Get message based on score."""
    if score >= 100:
        return "PERFECT!"
    elif score >= 80:
        return "GREAT!"
    elif score >= 60:
        return "GOOD!"
    elif score >= 40:
        return "FAIR"
    elif score >= 20:
        return "POOR"
    else:
        return "MISS"

@app.route('/api/process', methods=['POST'])
def process_video():
    """Trigger video processing."""
    import subprocess
    import sys
    
    try:
        # Run pose extraction
        cmd = [
            sys.executable, 
            "src/extract_pose.py",
            "--video", ORIGINAL_VIDEO,
            "--overlay", OVERLAY_VIDEO,
            "--sample_hz", "15",
            "--alpha", "0.7"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            return jsonify({"success": True, "message": "Video processed successfully"})
        else:
            return jsonify({"success": False, "error": result.stderr}), 500
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    print("Starting MediaPipe Pose API Server...")
    print("Available endpoints:")
    print("  GET  /api/poses     - Get pose landmarks data")
    print("  GET  /api/angles    - Get joint angles data") 
    print("  GET  /api/video     - Get video file")
    print("  GET  /api/status    - Get processing status")
    print("  POST /api/process   - Process video")
    print("\nStarting server on http://localhost:5000")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
