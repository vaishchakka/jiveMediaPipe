import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Pose } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import './LiveDance.css';

const LiveDance = ({ isGameStarted, isPaused, onPoseDetected }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [poseStatus, setPoseStatus] = useState('Webcam Ready');
  // Removed unused currentPose state

  // Real MediaPipe pose detection
  const detectPose = useCallback((results) => {
    if (!canvasRef.current || !results.poseLandmarks) {
      console.log('⚠️ No canvas or landmarks available');
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const landmarks = results.poseLandmarks;
    console.log('🎯 Drawing pose with', landmarks.length, 'landmarks');
    
    // Create pose data for scoring
    const poseData = {
      kp: landmarks.map(landmark => [landmark.x, landmark.y, landmark.z, landmark.visibility]),
      timestamp: Date.now()
    };
    
    // Send pose data for scoring if callback provided
    if (onPoseDetected) {
      console.log(`🎯 Sending pose data: ${landmarks.length} landmarks`);
      onPoseDetected(poseData);
    } else {
      console.log('❌ No onPoseDetected callback provided');
    }
    
    // Pose connections for drawing skeleton
    const POSE_CONNECTIONS = [
      [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // Arms
      [11, 23], [12, 24], [23, 24], // Torso
      [23, 25], [25, 27], [24, 26], [26, 28], // Legs
      [15, 17], [15, 19], [15, 21], [16, 18], [16, 20], [16, 22], // Hands
      [27, 29], [27, 31], [28, 30], [28, 32], // Feet
    ];
    
    // Draw connections
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    POSE_CONNECTIONS.forEach(([startIdx, endIdx]) => {
      const start = landmarks[startIdx];
      const end = landmarks[endIdx];
      
      if (start && end && start.visibility > 0.5 && end.visibility > 0.5) {
        ctx.beginPath();
        ctx.moveTo(start.x * canvas.width, start.y * canvas.height);
        ctx.lineTo(end.x * canvas.width, end.y * canvas.height);
        ctx.stroke();
      }
    });

    // Draw landmarks
    ctx.fillStyle = '#00ff88';
    landmarks.forEach((landmark) => {
      if (landmark.visibility > 0.5) {
        ctx.beginPath();
        ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    setPoseStatus('Pose Detected');
  }, [onPoseDetected]);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      console.log('🎯 Starting camera with MediaPipe...');
      
      // Check if MediaPipe is available
      if (typeof Pose === 'undefined' || typeof Camera === 'undefined') {
        throw new Error('MediaPipe not loaded. Please refresh the page.');
      }
      
      // Initialize MediaPipe Pose
      const poseInstance = new Pose({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
      });
      
      poseInstance.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      
      poseInstance.onResults(detectPose);
      
      // Initialize camera
      const cameraInstance = new Camera(videoRef.current, {
        onFrame: async () => {
          await poseInstance.send({ image: videoRef.current });
        },
        width: 640,
        height: 480
      });
      
      await cameraInstance.start();
      
      setIsStreaming(true);
      setPoseStatus('Webcam Active - Pose Detection Ready');
      
    } catch (err) {
      setError(`Camera error: ${err.message}`);
      console.error('❌ Camera error:', err);
    }
  }, [detectPose]);


  // Auto-start camera when game starts
  useEffect(() => {
    console.log('🎮 LiveDance useEffect - isGameStarted:', isGameStarted, 'isStreaming:', isStreaming);
    if (isGameStarted && !isStreaming) {
      console.log('🎮 Game started - auto-starting camera...');
      startCamera();
    }
  }, [isGameStarted, isStreaming, startCamera]);

  // Auto-stop camera when game stops
  useEffect(() => {
    if (!isGameStarted && isStreaming) {
      console.log('🛑 Game stopped - camera will be available when game restarts');
      setIsStreaming(false);
      setPoseStatus('Webcam Ready');
    }
  }, [isGameStarted, isStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup MediaPipe instances when component unmounts
      console.log('🧹 Cleaning up MediaPipe instances...');
    };
  }, []);

  return (
    <div className="live-dance">
      <h3 className="panel-title">Your Dance</h3>
      <div className="video-status">{poseStatus}</div>
      
      <div className="video-container">
        <video
          ref={videoRef}
          className="live-video-element"
          autoPlay
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="pose-overlay"
        />
        
        {!isStreaming && (
          <div className="camera-placeholder">
            <div className="placeholder-content">
              <span className="camera-icon">📹</span>
              <p>{isGameStarted ? 'Starting camera...' : 'Camera will start automatically when you begin the game'}</p>
            </div>
          </div>
        )}
      </div>
      
      {error && (
        <div className="camera-error">
          <p>⚠️ {error}</p>
          <p>Make sure to allow camera access when prompted.</p>
        </div>
      )}
      
      <div className="video-info">
        <p>🎥 Camera starts automatically when you begin the game</p>
        <p>💃 Dance along with the reference video!</p>
        <p>🎯 Real-time pose detection with MediaPipe</p>
      </div>
    </div>
  );
};

export default LiveDance;

