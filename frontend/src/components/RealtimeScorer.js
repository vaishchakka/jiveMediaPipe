import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './RealtimeScorer.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

const RealtimeScorer = ({ isGameStarted, poseData, onScoreUpdate }) => {
  const [totalScore, setTotalScore] = useState(0);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [pointGain, setPointGain] = useState(null);
  const [showPointGain, setShowPointGain] = useState(false);
  const [accuracy, setAccuracy] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  
  // Use refs to avoid dependency issues
  const totalScoreRef = useRef(0);
  const intervalRef = useRef(null);
  const poseDataRef = useRef(null);
  const isGameStartedRef = useRef(false);

  // Update refs when props change
  useEffect(() => {
    poseDataRef.current = poseData;
    isGameStartedRef.current = isGameStarted;
  }, [poseData, isGameStarted]);

  // Send pose data to backend for scoring
  const sendPoseForScoring = async () => {
    const currentPoseData = poseDataRef.current;
    const currentGameStarted = isGameStartedRef.current;
    
    if (!currentGameStarted || !currentPoseData) {
      return;
    }

    console.log(`📊 Sending pose for scoring: ${currentPoseData.kp.length} landmarks`);

    try {
      const response = await axios.post(`${API_BASE}/api/compare-pose`, {
        live_pose: poseData
      });
      const { points_earned, similarity, message } = response.data;
      
      console.log('🎯 API Response:', response.data);
      
      // Update scores
      setCurrentPoints(points_earned);
      const newTotalScore = totalScoreRef.current + points_earned;
      totalScoreRef.current = newTotalScore;
      setTotalScore(newTotalScore);
      
      console.log(`🎯 Score updated: ${points_earned} points, Total: ${newTotalScore}`);
      
      // Update frame count and calculate accuracy
      setFrameCount(prev => {
        const newFrameCount = prev + 1;
        const newAccuracy = newFrameCount > 0 ? newTotalScore / newFrameCount : points_earned;
        setAccuracy(Math.round(newAccuracy));
        return newFrameCount;
      });
      
      // Update parent component with current total score, similarity, and current points
      if (onScoreUpdate) {
        onScoreUpdate(newTotalScore, similarity, points_earned);
      }
      
      // Show point gain animation
      if (points_earned > 0) {
        setPointGain(points_earned);
        setShowPointGain(true);
        
        // Hide point gain after animation
        setTimeout(() => {
          setShowPointGain(false);
        }, 1000);
      }
      
      console.log(`🎯 Score: ${points_earned} points (${similarity.toFixed(1)}% similarity) - ${message}`);
      
    } catch (error) {
      console.error('❌ Error scoring pose:', error);
    }
  };

  // Start/stop scoring interval based on game state
  useEffect(() => {
    if (isGameStarted) {
      console.log('🎯 Starting scoring interval...');
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // Start new interval - score every 0.5 seconds
      intervalRef.current = setInterval(() => {
        sendPoseForScoring();
      }, 500);
    } else {
      console.log('🛑 Stopping scoring interval...');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Reset scores when game stops
      setTotalScore(0);
      setCurrentPoints(0);
      setPointGain(null);
      setShowPointGain(false);
      setAccuracy(0);
      setFrameCount(0);
      totalScoreRef.current = 0;
    }

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isGameStarted, onScoreUpdate]);

  console.log('🎯 RealtimeScorer render:', { totalScore, currentPoints, accuracy });
  
  return (
    <div className="realtime-scorer">
      <div className="score-display">
        <div className="total-score">
          <div className="score-label">Total Score</div>
          <div className="score-value">{totalScore}</div>
        </div>
        
        <div className="current-score">
          <div className="score-label">Current</div>
          <div className="score-value">{currentPoints}</div>
        </div>
        
        <div className="accuracy">
          <div className="score-label">Accuracy</div>
          <div className="score-value">{accuracy}%</div>
        </div>
      </div>

      {/* Point Gain Animation */}
      {showPointGain && pointGain > 0 && (
        <div className="point-gain-animation">
          <div className="point-gain-text">
            +{pointGain}
          </div>
        </div>
      )}

      <div className="scoring-info">
        <p>🎯 Real-time pose scoring active</p>
        <p>💃 Follow the reference video closely!</p>
      </div>
    </div>
  );
};

export default RealtimeScorer;
