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
import time
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Paths to data files
POSES_JSONL = "out/poses.jsonl"
POSES_JSONL_2 = "out/poses_dancevideo_real.jsonl"
ANGLES_CSV = "out/angles.csv"
OVERLAY_VIDEO = "out/overlay.mp4"
OVERLAY_VIDEO_2 = "out/overlay_dancevideo_real.mp4"
ORIGINAL_VIDEO = "videos/dance.mov"
NEW_VIDEO = "videos/dancevideo.mp4"

# Global variables for pose comparison
reference_poses = []
current_pose_index = 0
current_video = "dance"  # "dance" or "dancevideo"

# AI Coach state tracking
ai_coach_state = {
    "session_data": {
        "start_time": None,
        "total_poses_analyzed": 0,
        "performance_history": [],
        "improvement_trends": {},
        "session_id": None
    },
    "real_time_analysis": {
        "current_strengths": [],
        "current_weaknesses": [],
        "recent_scores": [],
        "coaching_tips": []
    },
    "personalized_feedback": {
        "user_profile": {
            "skill_level": "beginner",  # beginner, intermediate, advanced
            "preferred_feedback_style": "encouraging",  # encouraging, technical, motivational
            "focus_areas": []
        },
        "adaptive_coaching": {
            "difficulty_adjustment": 0,  # -2 to +2
            "feedback_frequency": "medium",  # low, medium, high
            "last_encouragement": None
        }
    }
}

def load_reference_poses():
    """Load reference poses from JSONL file."""
    global reference_poses, current_video
    
    # Choose the correct pose file based on current video
    poses_file = POSES_JSONL if current_video == "dance" else POSES_JSONL_2
    
    if not os.path.exists(poses_file):
        print(f"❌ Pose file not found: {poses_file}")
        return False
    
    try:
        reference_poses = []  # Clear existing poses
        with open(poses_file, 'r') as f:
            for line in f:
                if line.strip():
                    reference_poses.append(json.loads(line))
        print(f"✅ Loaded {len(reference_poses)} poses from {poses_file}")
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
    
    # More sensitive scoring - smaller distances = higher scores
    # Distance of 0.1 = 90% similarity, 0.2 = 80%, 0.3 = 70%, etc.
    similarity = max(0, 100 - (average_distance * 100))
    print(f"🎯 Similarity: {similarity:.1f}%")
    return min(100, similarity)

def calculate_score(similarity):
    """Calculate score based on pose similarity."""
    # More granular scoring - every 10% similarity = 10 points
    # This makes scoring more sensitive to actual pose differences
    base_score = int(similarity)
    
    # Bonus for very good poses
    if similarity >= 95:
        return base_score + 20  # Bonus for excellent poses
    elif similarity >= 85:
        return base_score + 10  # Bonus for good poses
    else:
        return base_score

def initialize_ai_coach_session():
    """Initialize a new AI coaching session."""
    global ai_coach_state
    
    session_id = f"session_{int(time.time())}"
    ai_coach_state["session_data"] = {
        "start_time": datetime.now().isoformat(),
        "total_poses_analyzed": 0,
        "performance_history": [],
        "improvement_trends": {},
        "session_id": session_id
    }
    ai_coach_state["real_time_analysis"] = {
        "current_strengths": [],
        "current_weaknesses": [],
        "recent_scores": [],
        "coaching_tips": []
    }
    
    print(f"🤖 AI Coach session initialized: {session_id}")
    return session_id

def analyze_pose_performance(similarity, live_pose, score):
    """Analyze pose performance and generate AI coaching insights."""
    global ai_coach_state
    
    # Update session data
    ai_coach_state["session_data"]["total_poses_analyzed"] += 1
    ai_coach_state["real_time_analysis"]["recent_scores"].append({
        "similarity": similarity,
        "score": score,
        "timestamp": datetime.now().isoformat()
    })
    
    # Keep only last 20 scores for real-time analysis
    if len(ai_coach_state["real_time_analysis"]["recent_scores"]) > 20:
        ai_coach_state["real_time_analysis"]["recent_scores"] = \
            ai_coach_state["real_time_analysis"]["recent_scores"][-20:]
    
    # Analyze joint-specific performance
    joint_analysis = analyze_joint_accuracy(live_pose)
    
    # Generate coaching insights
    coaching_insights = generate_coaching_insights(similarity, score, joint_analysis)
    
    # Update coaching tips
    ai_coach_state["real_time_analysis"]["coaching_tips"] = coaching_insights["tips"]
    ai_coach_state["real_time_analysis"]["current_strengths"] = coaching_insights["strengths"]
    ai_coach_state["real_time_analysis"]["current_weaknesses"] = coaching_insights["weaknesses"]
    
    return coaching_insights

def analyze_joint_accuracy(live_pose):
    """Analyze accuracy of individual joints and body parts."""
    if not live_pose or not live_pose.get('kp'):
        return {}
    
    landmarks = live_pose['kp']
    joint_scores = {}
    
    # Define joint groups for analysis
    joint_groups = {
        "left_arm": [11, 13, 15],  # Left shoulder, elbow, wrist
        "right_arm": [12, 14, 16],  # Right shoulder, elbow, wrist
        "left_leg": [23, 25, 27],  # Left hip, knee, ankle
        "right_leg": [24, 26, 28],  # Right hip, knee, ankle
        "torso": [11, 12, 23, 24],  # Shoulders and hips
        "core": [11, 12, 23, 24]   # Core stability points
    }
    
    # Calculate visibility-based scores for each group
    for group_name, indices in joint_groups.items():
        visible_joints = 0
        total_confidence = 0
        
        for idx in indices:
            if idx < len(landmarks):
                visibility = landmarks[idx][3] if len(landmarks[idx]) > 3 else 0
                if visibility > 0.5:
                    visible_joints += 1
                    total_confidence += visibility
        
        # Calculate group score
        if visible_joints > 0:
            avg_confidence = total_confidence / visible_joints
            joint_scores[group_name] = {
                "visibility_score": (visible_joints / len(indices)) * 100,
                "confidence_score": avg_confidence * 100,
                "overall_score": ((visible_joints / len(indices)) * avg_confidence) * 100
            }
    
    return joint_scores

def generate_coaching_insights(similarity, score, joint_analysis):
    """Generate AI-powered coaching insights based on performance data."""
    global ai_coach_state
    
    insights = {
        "tips": [],
        "strengths": [],
        "weaknesses": [],
        "motivation": "",
        "technical_feedback": ""
    }
    
    # Analyze recent performance trend
    recent_scores = ai_coach_state["real_time_analysis"]["recent_scores"]
    if len(recent_scores) >= 5:
        recent_avg = sum(s["similarity"] for s in recent_scores[-5:]) / 5
        older_avg = sum(s["similarity"] for s in recent_scores[-10:-5]) / 5 if len(recent_scores) >= 10 else recent_avg
        
        trend = "improving" if recent_avg > older_avg + 3 else "stable" if abs(recent_avg - older_avg) <= 3 else "declining"
    else:
        trend = "starting"
    
    # Performance-based feedback
    if similarity >= 90:
        insights["motivation"] = "🎯 Outstanding! You're hitting the poses perfectly!"
        insights["strengths"].append("Excellent pose accuracy")
        insights["tips"].append("Maintain this level of precision - you're in the zone!")
    elif similarity >= 75:
        insights["motivation"] = "👍 Great work! You're dancing with good form!"
        insights["strengths"].append("Good overall pose matching")
        insights["tips"].append("Focus on the smaller details to reach perfection")
    elif similarity >= 60:
        insights["motivation"] = "💪 Good effort! Keep working on those poses!"
        insights["tips"].append("Pay attention to arm and leg positioning")
        insights["weaknesses"].append("Pose precision needs improvement")
    elif similarity >= 40:
        insights["motivation"] = "📐 Keep practicing! Focus on matching the reference poses more closely."
        insights["tips"].append("Watch the reference video carefully and mirror the movements")
        insights["weaknesses"].append("Overall pose alignment needs work")
    else:
        insights["motivation"] = "🔄 Don't give up! Every dancer starts somewhere - keep trying!"
        insights["tips"].append("Start with simpler movements and build up your skills")
        insights["weaknesses"].append("Basic pose matching needs attention")
    
    # Joint-specific coaching
    if joint_analysis:
        for joint, scores in joint_analysis.items():
            overall_score = scores["overall_score"]
            if overall_score >= 80:
                insights["strengths"].append(f"Excellent {joint.replace('_', ' ')} positioning")
            elif overall_score >= 60:
                insights["tips"].append(f"Good {joint.replace('_', ' ')}, minor adjustments needed")
            else:
                insights["weaknesses"].append(f"{joint.replace('_', ' ').title()} needs more attention")
                insights["tips"].append(f"Focus on improving your {joint.replace('_', ' ')} positioning")
    
    # Trend-based coaching
    if trend == "improving":
        insights["motivation"] += " You're improving - keep it up!"
    elif trend == "declining":
        insights["tips"].append("Take a moment to recalibrate - focus on quality over speed")
    
    # Adaptive difficulty and encouragement
    user_profile = ai_coach_state["personalized_feedback"]["user_profile"]
    if user_profile["skill_level"] == "beginner":
        insights["technical_feedback"] = "Remember to focus on one body part at a time - start with your arms, then legs"
    elif user_profile["skill_level"] == "intermediate":
        insights["technical_feedback"] = "Work on fluidity between poses while maintaining accuracy"
    else:
        insights["technical_feedback"] = "Focus on micro-adjustments and perfecting the subtleties of each pose"
    
    return insights

def calculate_session_duration():
    """Calculate current session duration in minutes."""
    start_time = ai_coach_state["session_data"].get("start_time")
    if not start_time:
        return 0
    
    start_datetime = datetime.fromisoformat(start_time)
    duration = datetime.now() - start_datetime
    return round(duration.total_seconds() / 60, 1)

def calculate_improvement_trend(similarities):
    """Calculate if user is improving, stable, or declining."""
    if len(similarities) < 4:
        return "starting"
    
    # Compare first half vs second half of recent scores
    mid = len(similarities) // 2
    first_half_avg = sum(similarities[:mid]) / mid
    second_half_avg = sum(similarities[mid:]) / (len(similarities) - mid)
    
    difference = second_half_avg - first_half_avg
    
    if difference > 5:
        return "improving"
    elif difference < -5:
        return "declining"
    else:
        return "stable"

def generate_contextual_coaching_response(user_message, context):
    """Generate AI coaching response based on user message and performance context."""
    global ai_coach_state
    
    # Simple rule-based AI coaching responses
    # In a production app, this would use a more sophisticated AI model
    message_lower = user_message.lower()
    
    # Get current performance context
    current_similarity = context.get('currentSimilarity', 0)
    current_score = context.get('currentScore', 0)
    is_game_active = context.get('isGameActive', False)
    
    # Context-aware responses
    if "help" in message_lower or "tip" in message_lower:
        if current_similarity >= 80:
            return "You're doing great! Focus on maintaining this level of precision. Try to feel the rhythm and let your body flow naturally with the music."
        elif current_similarity >= 60:
            return "Good work! To improve further, pay closer attention to the reference video. Focus on matching the exact arm and leg positions."
        else:
            return "Let's work on the basics! Watch the reference dancer carefully and try to mirror their movements. Start with larger movements and gradually work on the details."
    
    elif "improve" in message_lower or "better" in message_lower:
        recent_scores = ai_coach_state["real_time_analysis"]["recent_scores"]
        if recent_scores:
            avg_similarity = sum(s["similarity"] for s in recent_scores[-5:]) / min(5, len(recent_scores))
            if avg_similarity < 50:
                return "Focus on one body part at a time. Start with your arms - match the arm positions first, then work on adding leg movements."
            else:
                return "You're making progress! To improve further, work on the timing and fluidity between poses. Practice the transitions between movements."
        else:
            return "Start by focusing on accuracy over speed. Watch the reference video carefully and try to match each pose precisely."
    
    elif "frustrated" in message_lower or "hard" in message_lower or "difficult" in message_lower:
        return "Don't worry, everyone finds dancing challenging at first! Take a deep breath and remember - every professional dancer started as a beginner. Focus on enjoying the movement rather than perfection."
    
    elif "score" in message_lower or "point" in message_lower:
        if current_score >= 80:
            return f"Excellent score of {current_score}! You're really getting the hang of this. Keep up the great work!"
        elif current_score >= 60:
            return f"Good score of {current_score}! You're improving. Focus on the details to boost your score even higher."
        else:
            return f"Your score of {current_score} shows you're learning! Remember, scores will improve as you practice. Focus on matching the poses rather than chasing points."
    
    elif "thank" in message_lower:
        return "You're very welcome! I'm here to help you become a better dancer. Keep practicing and stay positive!"
    
    else:
        # Generic encouraging response
        motivational_responses = [
            "Keep up the great work! Every practice session makes you a better dancer.",
            "I'm here to help you improve! Focus on enjoying the dance and the scores will follow.",
            "Dancing is all about expression and fun. You're doing great - keep it up!",
            "Remember, consistency is key in dancing. Keep practicing and you'll see amazing progress!",
            "Your dedication to improving is inspiring! Let's keep working together."
        ]
        
        # Use hash of message to get consistent but varied responses
        response_index = hash(user_message) % len(motivational_responses)
        return motivational_responses[response_index]

@app.route('/')
def root():
    """Root endpoint for debugging."""
    return jsonify({
        "message": "MediaPipe Pose API Server with AI Coach Integration",
        "endpoints": [
            "/api/poses",
            "/api/angles", 
            "/api/video",
            "/api/status",
            "/api/process",
            "/api/compare-pose",
            "/api/ai-coach/start-session",
            "/api/ai-coach/get-insights",
            "/api/ai-coach/chat",
            "/api/ai-coach/update-profile"
        ],
        "ai_coach_features": [
            "Real-time pose analysis with intelligent feedback",
            "Personalized coaching tips based on performance",
            "Interactive chat with AI coach",
            "Joint-specific accuracy scoring",
            "Performance trend analysis",
            "Adaptive difficulty adjustment"
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
    """Serve the current video."""
    global current_video
    
    # Choose video based on current selection
    video_path = ORIGINAL_VIDEO if current_video == "dance" else NEW_VIDEO
    
    if os.path.exists(video_path):
        response = send_file(video_path)
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Headers'] = 'Range'
        response.headers['Accept-Ranges'] = 'bytes'
        response.headers['Content-Type'] = 'video/mp4'
        return response
    else:
        return jsonify({"error": "No video found"}), 404

@app.route('/api/overlay')
def get_overlay():
    """Serve the current overlay video."""
    global current_video
    
    # Choose overlay based on current selection
    overlay_path = OVERLAY_VIDEO if current_video == "dance" else OVERLAY_VIDEO_2
    
    if os.path.exists(overlay_path):
        response = send_file(overlay_path)
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Headers'] = 'Range'
        response.headers['Accept-Ranges'] = 'bytes'
        response.headers['Content-Type'] = 'video/mp4'
        return response
    else:
        return jsonify({"error": "No overlay found"}), 404

@app.route('/api/switch-video/<video_name>')
def switch_video(video_name):
    """Switch between different videos."""
    global current_video, reference_poses, current_pose_index
    
    if video_name in ["dance", "dancevideo"]:
        current_video = video_name
        reference_poses = []  # Clear current poses
        current_pose_index = 0
        
        # Load new poses
        if load_reference_poses():
            return jsonify({
                "success": True,
                "current_video": current_video,
                "poses_loaded": len(reference_poses)
            })
        else:
            return jsonify({"error": "Failed to load poses for video"}), 500
    else:
        return jsonify({"error": "Invalid video name"}), 400

@app.route('/api/current-video')
def get_current_video():
    """Get current video information."""
    return jsonify({
        "current_video": current_video,
        "poses_loaded": len(reference_poses)
    })

@app.route('/api/status')
def get_status():
    """Get processing status."""
    status = {
        "poses_available": os.path.exists(POSES_JSONL),
        "poses_available_2": os.path.exists(POSES_JSONL_2),
        "angles_available": os.path.exists(ANGLES_CSV),
        "original_video": os.path.exists(ORIGINAL_VIDEO),
        "new_video": os.path.exists(NEW_VIDEO),
        "overlay_available": os.path.exists(OVERLAY_VIDEO),
        "overlay_available_2": os.path.exists(OVERLAY_VIDEO_2),
        "current_video": current_video
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
        
        print(f"🔍 Comparing with reference pose {current_pose_index-1}/{len(reference_poses)}")
        
        # Calculate similarity and score
        similarity = calculate_pose_similarity(ref_pose, live_pose)
        score = calculate_score(similarity)
        
        # Generate AI coaching insights
        ai_insights = analyze_pose_performance(similarity, live_pose, score)
        
        return jsonify({
            "similarity": round(similarity, 2),
            "score": score,
            "points_earned": score,
            "message": f"{score} points",
            "ai_coaching": ai_insights,
            "joint_analysis": analyze_joint_accuracy(live_pose)
        })
        
    except Exception as e:
        return jsonify({"error": f"Error comparing poses: {str(e)}"}), 500

@app.route('/api/ai-coach/start-session', methods=['POST'])
def start_ai_coach_session():
    """Initialize a new AI coaching session."""
    try:
        data = request.get_json() or {}
        skill_level = data.get('skill_level', 'beginner')
        feedback_style = data.get('feedback_style', 'encouraging')
        
        # Update user profile
        ai_coach_state["personalized_feedback"]["user_profile"]["skill_level"] = skill_level
        ai_coach_state["personalized_feedback"]["user_profile"]["preferred_feedback_style"] = feedback_style
        
        session_id = initialize_ai_coach_session()
        
        return jsonify({
            "success": True,
            "session_id": session_id,
            "user_profile": ai_coach_state["personalized_feedback"]["user_profile"],
            "message": "AI Coach session started successfully"
        })
        
    except Exception as e:
        return jsonify({"error": f"Error starting AI coach session: {str(e)}"}), 500

@app.route('/api/ai-coach/get-insights')
def get_ai_coach_insights():
    """Get current AI coaching insights and tips."""
    try:
        global ai_coach_state
        
        # Calculate performance summary
        recent_scores = ai_coach_state["real_time_analysis"]["recent_scores"]
        performance_summary = {}
        
        if recent_scores:
            similarities = [s["similarity"] for s in recent_scores]
            scores = [s["score"] for s in recent_scores]
            
            performance_summary = {
                "average_similarity": round(sum(similarities) / len(similarities), 2),
                "average_score": round(sum(scores) / len(scores), 2),
                "total_poses": ai_coach_state["session_data"]["total_poses_analyzed"],
                "session_duration": calculate_session_duration(),
                "improvement_trend": calculate_improvement_trend(similarities)
            }
        
        return jsonify({
            "current_tips": ai_coach_state["real_time_analysis"]["coaching_tips"],
            "strengths": ai_coach_state["real_time_analysis"]["current_strengths"],
            "weaknesses": ai_coach_state["real_time_analysis"]["current_weaknesses"],
            "performance_summary": performance_summary,
            "user_profile": ai_coach_state["personalized_feedback"]["user_profile"]
        })
        
    except Exception as e:
        return jsonify({"error": f"Error getting AI insights: {str(e)}"}), 500

@app.route('/api/ai-coach/chat', methods=['POST'])
def ai_coach_chat():
    """Handle AI coach chat interactions."""
    try:
        data = request.get_json()
        user_message = data.get('message', '')
        context = data.get('context', {})
        
        if not user_message:
            return jsonify({"error": "No message provided"}), 400
        
        # Generate contextual AI response based on current performance
        ai_response = generate_contextual_coaching_response(user_message, context)
        
        return jsonify({
            "response": ai_response,
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({"error": f"Error in AI chat: {str(e)}"}), 500

@app.route('/api/ai-coach/update-profile', methods=['POST'])
def update_ai_coach_profile():
    """Update user profile for personalized coaching."""
    try:
        data = request.get_json()
        
        profile_updates = {}
        if 'skill_level' in data:
            profile_updates['skill_level'] = data['skill_level']
        if 'preferred_feedback_style' in data:
            profile_updates['preferred_feedback_style'] = data['preferred_feedback_style']
        if 'focus_areas' in data:
            profile_updates['focus_areas'] = data['focus_areas']
        
        # Update profile
        ai_coach_state["personalized_feedback"]["user_profile"].update(profile_updates)
        
        return jsonify({
            "success": True,
            "updated_profile": ai_coach_state["personalized_feedback"]["user_profile"]
        })
        
    except Exception as e:
        return jsonify({"error": f"Error updating profile: {str(e)}"}), 500

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
