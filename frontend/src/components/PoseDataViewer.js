import React, { useState } from 'react';
import './PoseDataViewer.css';

const PoseDataViewer = ({ poseData }) => {
  const [selectedFrame, setSelectedFrame] = useState(0);
  const [showRawData, setShowRawData] = useState(false);

  if (!poseData || poseData.length === 0) {
    return (
      <div className="pose-data-viewer">
        <h3>Pose Data</h3>
        <p>No pose data available</p>
      </div>
    );
  }

  const currentPose = poseData[selectedFrame];
  const totalFrames = poseData.length;

  const handleFrameChange = (direction) => {
    if (direction === 'prev' && selectedFrame > 0) {
      setSelectedFrame(selectedFrame - 1);
    } else if (direction === 'next' && selectedFrame < totalFrames - 1) {
      setSelectedFrame(selectedFrame + 1);
    }
  };

  const handleFrameJump = (frameIndex) => {
    setSelectedFrame(Math.max(0, Math.min(frameIndex, totalFrames - 1)));
  };

  const getLandmarkName = (index) => {
    const names = [
      'Nose', 'Left Eye Inner', 'Left Eye', 'Left Eye Outer', 'Right Eye Inner',
      'Right Eye', 'Right Eye Outer', 'Left Ear', 'Right Ear', 'Mouth Left',
      'Mouth Right', 'Left Shoulder', 'Right Shoulder', 'Left Elbow', 'Right Elbow',
      'Left Wrist', 'Right Wrist', 'Left Pinky', 'Right Pinky', 'Left Index',
      'Right Index', 'Left Thumb', 'Right Thumb', 'Left Hip', 'Right Hip',
      'Left Knee', 'Right Knee', 'Left Ankle', 'Right Ankle', 'Left Heel',
      'Right Heel', 'Left Foot Index', 'Right Foot Index'
    ];
    return names[index] || `Landmark ${index}`;
  };

  return (
    <div className="pose-data-viewer">
      <h3>Pose Data Explorer</h3>
      
      <div className="frame-controls">
        <button 
          onClick={() => handleFrameChange('prev')}
          disabled={selectedFrame === 0}
        >
          ← Previous
        </button>
        
        <span className="frame-info">
          Frame {selectedFrame + 1} of {totalFrames}
          <br />
          Time: {currentPose.t.toFixed(3)}s
        </span>
        
        <button 
          onClick={() => handleFrameChange('next')}
          disabled={selectedFrame === totalFrames - 1}
        >
          Next →
        </button>
      </div>

      <div className="frame-slider">
        <input
          type="range"
          min="0"
          max={totalFrames - 1}
          value={selectedFrame}
          onChange={(e) => handleFrameJump(parseInt(e.target.value))}
          className="slider"
        />
      </div>

      <div className="pose-status">
        <div className={`status-indicator ${currentPose.ok ? 'detected' : 'not-detected'}`}>
          {currentPose.ok ? '✓ Pose Detected' : '✗ No Pose'}
        </div>
        
        {currentPose.ok && (
          <div className="landmark-count">
            {currentPose.kp.length} landmarks detected
          </div>
        )}
      </div>

      {currentPose.ok && (
        <div className="landmarks-section">
          <div className="landmarks-header">
            <h4>Landmarks</h4>
            <label className="toggle-raw">
              <input
                type="checkbox"
                checked={showRawData}
                onChange={(e) => setShowRawData(e.target.checked)}
              />
              Show Raw Data
            </label>
          </div>
          
          <div className="landmarks-grid">
            {currentPose.kp.map((landmark, index) => (
              <div key={index} className="landmark-item">
                <div className="landmark-header">
                  <span className="landmark-name">{getLandmarkName(index)}</span>
                  <span className="visibility">
                    Visibility: {(landmark[3] * 100).toFixed(1)}%
                  </span>
                </div>
                
                {showRawData ? (
                  <div className="raw-coordinates">
                    <div>X: {landmark[0].toFixed(4)}</div>
                    <div>Y: {landmark[1].toFixed(4)}</div>
                    <div>Z: {landmark[2].toFixed(4)}</div>
                  </div>
                ) : (
                  <div className="coordinates">
                    <div>X: {landmark[0].toFixed(2)}</div>
                    <div>Y: {landmark[1].toFixed(2)}</div>
                    <div>Z: {landmark[2].toFixed(2)}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!currentPose.ok && (
        <div className="no-pose-message">
          <p>No pose detected in this frame</p>
        </div>
      )}
    </div>
  );
};

export default PoseDataViewer;
