import React, { useRef, useEffect, useState } from 'react';
import './VideoPlayer.css';

const VideoPlayer = ({ poseData, videoSrc }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Pose connections for drawing skeleton
  const POSE_CONNECTIONS = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // Arms
    [11, 23], [12, 24], [23, 24], // Torso
    [23, 25], [25, 27], [24, 26], [26, 28], // Legs
    [15, 17], [15, 19], [15, 21], [16, 18], [16, 20], [16, 22], // Hands
    [27, 29], [27, 31], [28, 30], [28, 32], // Feet
  ];

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !poseData) return;

    const ctx = canvas.getContext('2d');
    
    const drawPose = () => {
      if (!video.videoWidth || !video.videoHeight) return;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Find pose data for current time
      const currentPose = findPoseForTime(currentTime);
      if (!currentPose || !currentPose.ok) return;
      
      // Draw skeleton
      drawSkeleton(ctx, currentPose.kp, video.videoWidth, video.videoHeight);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      drawPose();
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    // Initial draw
    drawPose();

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [currentTime, poseData]);

  const findPoseForTime = (time) => {
    if (!poseData || poseData.length === 0) return null;
    
    // Find closest pose data by time
    let closest = poseData[0];
    let minDiff = Math.abs(poseData[0].t - time);
    
    for (const pose of poseData) {
      const diff = Math.abs(pose.t - time);
      if (diff < minDiff) {
        minDiff = diff;
        closest = pose;
      }
    }
    
    return closest;
  };

  const drawSkeleton = (ctx, landmarks, videoWidth, videoHeight) => {
    if (!landmarks || landmarks.length === 0) return;
    
    // Convert world coordinates to screen coordinates
    const screenLandmarks = landmarks.map(lm => {
      // If using world coordinates, project to screen
      if (Math.abs(lm[0]) > 1 || Math.abs(lm[1]) > 1) {
        // World coordinates - simple projection
        const x = (lm[0] + 0.5) * videoWidth;
        const y = (lm[1] + 0.5) * videoHeight;
        return { x, y, visibility: lm[3] };
      } else {
        // Normalized coordinates
        const x = lm[0] * videoWidth;
        const y = lm[1] * videoHeight;
        return { x, y, visibility: lm[3] };
      }
    });

    // Draw connections
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    
    POSE_CONNECTIONS.forEach(([startIdx, endIdx]) => {
      const start = screenLandmarks[startIdx];
      const end = screenLandmarks[endIdx];
      
      if (start && end && start.visibility > 0.5 && end.visibility > 0.5) {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }
    });

    // Draw landmarks
    ctx.fillStyle = '#ff0000';
    screenLandmarks.forEach((lm, idx) => {
      if (lm.visibility > 0.5) {
        ctx.beginPath();
        ctx.arc(lm.x, lm.y, 3, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  };

  const handleVideoLoad = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
  };

  return (
    <div className="video-player">
      <div className="video-container">
        <video
          ref={videoRef}
          src={videoSrc}
          onLoadedMetadata={handleVideoLoad}
          controls
          className="video"
        />
        <canvas
          ref={canvasRef}
          className="pose-overlay"
        />
      </div>
      
      <div className="video-info">
        <p>Current Time: {currentTime.toFixed(2)}s</p>
        <p>Status: {isPlaying ? 'Playing' : 'Paused'}</p>
        {poseData && (
          <p>Pose Frames: {poseData.length}</p>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;
