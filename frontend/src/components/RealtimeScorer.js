import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import './RealtimeScorer.css';

const RealtimeScorer = ({ isGameStarted, poseData, onScoreUpdate }) => {
  const [totalScore, setTotalScore] = useState(0);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [pointGain, setPointGain] = useState(null);
  const [showPointGain, setShowPointGain] = useState(false);
  const [accuracy, setAccuracy] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [gameStartTime, setGameStartTime] = useState(null);
  const totalScoreRef = useRef(0);

  // Send pose data to backend for scoring every 0.5 seconds
  const sendPoseForScoring = useCallback(async (poseData) => {
    if (!isGameStarted || !poseData) {
      console.log('❌ Not sending pose - game not started or no pose data:', { isGameStarted, hasPoseData: !!poseData });
      return;
    }

    console.log(`📊 Sending pose for scoring: ${poseData.kp.length} landmarks`);

    try {
      const response = await axios.post('http://localhost:5000/api/compare-pose', {
        live_pose: poseData
      });

      console.log('🎯 API Response:', response.data);
      const { points_earned, similarity, message } = response.data;
      
      // Update scores
      setCurrentPoints(points_earned);
      const newTotalScore = totalScoreRef.current + points_earned;
      totalScoreRef.current = newTotalScore;
      setTotalScore(newTotalScore);
      setFrameCount(prev => prev + 1);
      
      // Update parent component with current total score
      if (onScoreUpdate) {
        onScoreUpdate(newTotalScore);
      }
      
      // Calculate accuracy
      const newAccuracy = frameCount > 0 ? newTotalScore / (frameCount + 1) : points_earned;
      setAccuracy(Math.round(newAccuracy));
      
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
  }, [isGameStarted, onScoreUpdate]);

  // Process pose data when it changes - use interval for continuous scoring
  useEffect(() => {
    console.log('🔄 RealtimeScorer useEffect triggered:', { poseData: !!poseData, isGameStarted });
    
    if (poseData && isGameStarted) {
      console.log('🎯 Starting scoring interval...');
      // Send pose for scoring every 0.5 seconds
      const interval = setInterval(() => {
        sendPoseForScoring(poseData);
      }, 500);

      return () => {
        console.log('🛑 Clearing scoring interval');
        clearInterval(interval);
      };
    }
  }, [poseData, isGameStarted, sendPoseForScoring]);

  // Reset scores when game resets
  useEffect(() => {
    if (!isGameStarted) {
      setTotalScore(0);
      setCurrentPoints(0);
      setPointGain(null);
      setShowPointGain(false);
      setAccuracy(0);
      setFrameCount(0);
    }
  }, [isGameStarted]);

  return (
    <div className="realtime-scorer">
      <div className="score-display">
        <div className="total-score">
          <div className="score-label">Total Score</div>
          <div className="score-value">{totalScore}</div>
        </div>
        <div className="debug-info">
          <div>Game Started: {isGameStarted ? '✅' : '❌'}</div>
          <div>Pose Data: {poseData ? `✅ (${poseData.kp.length} landmarks)` : '❌'}</div>
          <div>Current Points: {currentPoints}</div>
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
