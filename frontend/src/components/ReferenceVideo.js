import React, { useRef, useEffect, useState } from 'react';
import './ReferenceVideo.css';

const ReferenceVideo = ({ isGameStarted, isPaused, onVideoEnd }) => {
  const videoRef = useRef(null);
  const [poseStatus, setPoseStatus] = useState('Video Pose Detection Ready');

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      if (isGameStarted && !isPaused) {
        video.play();
        setPoseStatus('Pose Detected');
      } else if (isPaused) {
        video.pause();
        setPoseStatus('Paused');
      } else {
        video.pause();
        video.currentTime = 0;
        setPoseStatus('Video Pose Detection Ready');
      }
    }
  }, [isGameStarted, isPaused]);

  const handleVideoLoad = () => {
    setPoseStatus('Video Loaded - Ready to Dance!');
    // Don't auto-play - wait for game to start
    console.log('🎬 Video loaded, waiting for game to start...');
  };

  const handleVideoError = (e) => {
    console.error('Video load error:', e);
    setPoseStatus('Video Load Error');
  };

  const handleVideoEnd = () => {
    console.log('🎬 Video ended - triggering game end');
    setPoseStatus('Video Complete');
    if (onVideoEnd) {
      onVideoEnd();
    }
  };

  return (
    <div className="reference-video">
      <h3 className="panel-title">Reference Video</h3>
      <div className="video-status">{poseStatus}</div>
      
      <div className="video-container">
                <video
                  ref={videoRef}
                  src="/api/video"
                  className="reference-video-element"
                  muted
                  onLoadedData={handleVideoLoad}
                  onError={handleVideoError}
                  onEnded={handleVideoEnd}
                  controls
                />
        
        {/* Pose overlay canvas will be handled by the backend overlay video */}
        <div className="video-overlay">
          <div className="pose-indicator">
            <span className="pose-dot"></span>
            <span>Pose Detection Active</span>
          </div>
        </div>
      </div>
      
      <div className="video-info">
        <p>🎯 Follow the movements shown in this video</p>
        <p>💃 Dance along with the reference video!</p>
        <p>📹 Video Status: {poseStatus}</p>
      </div>
    </div>
  );
};

export default ReferenceVideo;
