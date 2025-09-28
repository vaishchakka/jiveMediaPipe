import React, { useEffect, useRef, useState } from 'react';
import { useCedarState } from 'cedar-os';
import { diffActions } from '../store/cedarStore';
import './PoseDiffVisualizer.css';

const PoseDiffVisualizer = ({ currentPose, referencePose, width = 640, height = 480 }) => {
  const canvasRef = useRef(null);
  const [diffState, diffDispatch] = useCedarState('diffState');
  const [visualizationMode, setVisualizationMode] = useState('overlay');
  const [showHeatmap, setShowHeatmap] = useState(true);

  useEffect(() => {
    if (currentPose && referencePose) {
      updatePoseDifferences();
    }
  }, [currentPose, referencePose]);

  useEffect(() => {
    drawPoseComparison();
  }, [diffState, visualizationMode, showHeatmap]);

  const updatePoseDifferences = () => {
    const differences = calculatePoseDifferences(currentPose, referencePose);
    const jointScores = calculateJointAccuracyScores(currentPose, referencePose);
    
    diffDispatch(diffActions.updatePoseDifferences(differences));
    diffDispatch(diffActions.updateJointScores(jointScores));
  };

  const calculatePoseDifferences = (current, reference) => {
    if (!current?.kp || !reference?.kp) return [];
    
    const differences = [];
    const minLength = Math.min(current.kp.length, reference.kp.length);
    
    for (let i = 0; i < minLength; i++) {
      const currentPoint = current.kp[i];
      const refPoint = reference.kp[i];
      
      if (currentPoint[3] > 0.5 && refPoint[3] > 0.5) {
        const distance = Math.sqrt(
          Math.pow(currentPoint[0] - refPoint[0], 2) +
          Math.pow(currentPoint[1] - refPoint[1], 2)
        );
        
        differences.push({
          jointIndex: i,
          distance,
          severity: distance > 0.1 ? 'high' : distance > 0.05 ? 'medium' : 'low',
          currentPosition: [currentPoint[0], currentPoint[1]],
          referencePosition: [refPoint[0], refPoint[1]]
        });
      }
    }
    
    return differences;
  };

  const calculateJointAccuracyScores = (current, reference) => {
    const scores = {};
    const criticalJoints = {
      'leftShoulder': 11, 'rightShoulder': 12,
      'leftElbow': 13, 'rightElbow': 14,
      'leftWrist': 15, 'rightWrist': 16,
      'leftHip': 23, 'rightHip': 24,
      'leftKnee': 25, 'rightKnee': 26,
      'leftAnkle': 27, 'rightAnkle': 28
    };
    
    Object.entries(criticalJoints).forEach(([jointName, index]) => {
      if (current?.kp?.[index] && reference?.kp?.[index]) {
        const currentPoint = current.kp[index];
        const refPoint = reference.kp[index];
        
        const distance = Math.sqrt(
          Math.pow(currentPoint[0] - refPoint[0], 2) +
          Math.pow(currentPoint[1] - refPoint[1], 2)
        );
        
        const accuracy = Math.max(0, 100 - (distance * 1000));
        scores[jointName] = {
          accuracy: Math.round(accuracy),
          distance,
          status: accuracy > 80 ? 'excellent' : accuracy > 60 ? 'good' : 'needsWork'
        };
      }
    });
    
    return scores;
  };

  const drawPoseComparison = () => {
    const canvas = canvasRef.current;
    if (!canvas || !currentPose?.kp || !referencePose?.kp) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    
    // Draw reference pose in green
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
    ctx.fillStyle = 'rgba(34, 197, 94, 0.6)';
    drawPoseSkeleton(ctx, referencePose.kp, false);
    
    // Draw current pose in blue
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
    ctx.fillStyle = 'rgba(59, 130, 246, 0.6)';
    drawPoseSkeleton(ctx, currentPose.kp, true);
  };

  const drawPoseSkeleton = (ctx, landmarks, isCurrent = false) => {
    const connections = [
      [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // Arms
      [11, 23], [12, 24], [23, 24], // Torso
      [23, 25], [25, 27], [24, 26], [26, 28] // Legs
    ];
    
    ctx.lineWidth = isCurrent ? 3 : 2;
    
    // Draw connections
    connections.forEach(([startIdx, endIdx]) => {
      const start = landmarks[startIdx];
      const end = landmarks[endIdx];
      
      if (start && end && start[3] > 0.5 && end[3] > 0.5) {
        ctx.beginPath();
        ctx.moveTo(start[0] * width, start[1] * height);
        ctx.lineTo(end[0] * width, end[1] * height);
        ctx.stroke();
      }
    });
    
    // Draw landmarks
    landmarks.forEach((landmark, index) => {
      if (landmark[3] > 0.5) {
        const x = landmark[0] * width;
        const y = landmark[1] * height;
        
        ctx.beginPath();
        ctx.arc(x, y, isCurrent ? 4 : 3, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  };

  return (
    <div className="pose-diff-visualizer">
      <div className="visualizer-controls">
        <div className="mode-selector">
          <button 
            className={`mode-btn ${visualizationMode === 'overlay' ? 'active' : ''}`}
            onClick={() => setVisualizationMode('overlay')}
          >
            🔄 Overlay
          </button>
          <button 
            className={`mode-btn ${visualizationMode === 'sideBySide' ? 'active' : ''}`}
            onClick={() => setVisualizationMode('sideBySide')}
          >
            ↔️ Side by Side
          </button>
        </div>
      </div>
      
      <div className="canvas-container">
        <canvas 
          ref={canvasRef}
          width={width}
          height={height}
          className="comparison-canvas"
        />
      </div>
      
      <div className="legend">
        <div className="legend-item">
          <div className="legend-color reference"></div>
          <span>Reference Pose</span>
        </div>
        <div className="legend-item">
          <div className="legend-color current"></div>
          <span>Your Pose</span>
        </div>
        <div className="legend-item">
          <div className="legend-color error"></div>
          <span>Needs Adjustment</span>
        </div>
      </div>
      
      {diffState.poseDifferences && diffState.poseDifferences.length > 0 && (
        <div className="difference-summary">
          <h4>📊 Pose Analysis Summary</h4>
          <div className="summary-stats">
            <div className="stat">
              <span className="stat-value">
                {diffState.poseDifferences.filter(d => d.severity === 'high').length}
              </span>
              <span className="stat-label">Major Issues</span>
            </div>
            <div className="stat">
              <span className="stat-value">
                {diffState.poseDifferences.filter(d => d.severity === 'medium').length}
              </span>
              <span className="stat-label">Minor Issues</span>
            </div>
            <div className="stat">
              <span className="stat-value">
                {Math.round(
                  (diffState.poseDifferences.filter(d => d.severity === 'low').length / 
                   diffState.poseDifferences.length) * 100
                )}%
              </span>
              <span className="stat-label">Accuracy</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PoseDiffVisualizer;