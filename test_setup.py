#!/usr/bin/env python3
"""
Test script to verify MediaPipe installation and basic functionality.
"""

def test_imports():
    """Test that all required packages can be imported."""
    try:
        import mediapipe as mp
        import cv2
        import numpy as np
        import pandas as pd
        print("✓ All packages imported successfully")
        return True
    except ImportError as e:
        print(f"✗ Import error: {e}")
        return False

def test_mediapipe_pose():
    """Test MediaPipe pose detection initialization."""
    try:
        import mediapipe as mp
        
        mp_pose = mp.solutions.pose
        pose = mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            enable_segmentation=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        print("✓ MediaPipe pose detection initialized")
        pose.close()
        return True
    except Exception as e:
        print(f"✗ MediaPipe pose error: {e}")
        return False

def test_opencv():
    """Test OpenCV video capabilities."""
    try:
        import cv2
        print(f"✓ OpenCV version: {cv2.__version__}")
        return True
    except Exception as e:
        print(f"✗ OpenCV error: {e}")
        return False

if __name__ == "__main__":
    print("Testing MediaPipe pose extraction setup...")
    print()
    
    success = True
    success &= test_imports()
    success &= test_mediapipe_pose()
    success &= test_opencv()
    
    print()
    if success:
        print("✓ All tests passed! Ready to extract poses.")
    else:
        print("✗ Some tests failed. Check your Python version and dependencies.")
        print("MediaPipe requires Python 3.8-3.11")
