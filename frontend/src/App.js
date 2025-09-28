import React, { useState, useEffect, useCallback } from 'react';
import ReferenceVideo from './components/ReferenceVideo';
import LiveDance from './components/LiveDance';
import RealtimeScorer from './components/RealtimeScorer';
import GameEnding from './components/GameEnding';
import AIChatCoach from './components/AIChatCoach';
import { initializeCedarStore } from './store/cedarStore';
import axios from 'axios';
import './App.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

function App() {
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [gameStartCountdown, setGameStartCountdown] = useState(null);
  const [currentPoseData, setCurrentPoseData] = useState(null);
  const [isGameEnded, setIsGameEnded] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  
  // AI Coach state
  const [aiCoachSessionId, setAiCoachSessionId] = useState(null);
  const [currentSimilarity, setCurrentSimilarity] = useState(0);
  const [currentScore, setCurrentScore] = useState(0);
  const [aiCoachEnabled, setAiCoachEnabled] = useState(true);

  // Initialize CedarOS and AI Coach
  useEffect(() => {
    initializeCedarStore();
    startAiCoachSession();
  }, []);

  // AI Coach session management
  const startAiCoachSession = async () => {
    if (!aiCoachEnabled) return;
    
    try {
      const response = await axios.post(`${API_BASE}/api/ai-coach/start-session`, {
        skill_level: 'beginner',
        feedback_style: 'encouraging'
      });
      
      if (response.data.success) {
        setAiCoachSessionId(response.data.session_id);
        console.log('🤖 AI Coach session started:', response.data.session_id);
      }
    } catch (error) {
      console.error('Error starting AI Coach session:', error);
    }
  };

  // Handle pose detection from LiveDance component
  const handlePoseDetected = useCallback((poseData) => {
    setCurrentPoseData(poseData);
  }, []);

  // Handle video end - trigger game ending
  const handleVideoEnd = useCallback(() => {
    setIsGameEnded(true);
    setIsGameStarted(false);
  }, []);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setUploadedFile(file);
      setIsProcessing(true);
      
      // Auto-detect video type based on filename
      const fileName = file.name.toLowerCase();
      let videoType = 'dance'; // default
      
      if (fileName.includes('dancevideo') || fileName.includes('dance_video')) {
        videoType = 'dancevideo';
      }
      
      // Switch to the appropriate video
      try {
        const response = await fetch(`http://localhost:5000/api/switch-video/${videoType}`);
        const data = await response.json();
        if (data.success) {
          console.log(`🎬 Auto-switched to video: ${videoType}`);
        }
      } catch (error) {
        console.error('Error switching video:', error);
      }
      
      // Simulate processing
      setTimeout(() => {
        setIsProcessing(false);
      }, 2000);
    }
  };

  const startGame = () => {
    if (gameStartCountdown === null) {
      setGameStartCountdown(5);
      // Initialize AI Coach session for the new game
      if (aiCoachEnabled && !aiCoachSessionId) {
        startAiCoachSession();
      }
    }
  };

  // Simple reset function - no countdown needed
  const resetGame = () => {
    setIsGameStarted(false);
    setIsPaused(false);
    setGameStartCountdown(null);
    setIsGameEnded(false);
    setFinalScore(0);
    setCurrentSimilarity(0);
    setCurrentScore(0);
    // Start new AI Coach session
    if (aiCoachEnabled) {
      startAiCoachSession();
    }
  };

  // Handle play again
  const handlePlayAgain = () => {
    setIsGameEnded(false);
    setFinalScore(0);
    setGameStartCountdown(5);
  };


  // Countdown effect for game start
  useEffect(() => {
    if (gameStartCountdown > 0) {
      const timer = setTimeout(() => {
        setGameStartCountdown(gameStartCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (gameStartCountdown === 0) {
      // Show "GO!" for a moment before starting the game
      setTimeout(() => {
        setIsGameStarted(true);
        setIsPaused(false);
        setGameStartCountdown(null);
      }, 500);
    }
  }, [gameStartCountdown]);


  return (
    <div className="App">
      <header className="app-header">
        <div className="title-section">
          <span className="title-icon">🎵</span>
          <h1 className="app-title">Just Dance Clone</h1>
          <span className="title-icon">💃</span>
        </div>
        <p className="app-subtitle">
          Upload a video and dance along with real-time pose detection!
        </p>
      </header>

      <div className="upload-section">
        <input
          type="file"
          accept="video/*"
          onChange={handleFileUpload}
          id="video-upload"
          style={{ display: 'none' }}
        />
        <label htmlFor="video-upload" className="upload-button">
          📁 Upload Video
        </label>
        
        {uploadedFile && (
          <div className="upload-info">
            <p>Selected: {uploadedFile.name}</p>
            {isProcessing && <p>Processing...</p>}
          </div>
        )}
      </div>


      <div className="game-controls">
        <button 
          className="start-button"
          onClick={startGame}
          disabled={!uploadedFile || isProcessing || gameStartCountdown !== null}
        >
          {gameStartCountdown !== null ? `🎮 Starting in ${gameStartCountdown}...` : '► Start Game'}
        </button>
        <button 
          className="reset-button"
          onClick={resetGame}
        >
          🔄 Reset
        </button>
      </div>

      <main className="dance-area">
        {gameStartCountdown !== null && (
          <div className="game-countdown-overlay">
            <div className="countdown-content">
              <div className={`countdown-number ${gameStartCountdown === 0 ? 'go-message' : ''}`}>
                {gameStartCountdown > 0 ? gameStartCountdown : 'GO!'}
              </div>
              <div className="countdown-text">
                {gameStartCountdown > 0 ? 'Get Ready to Dance!' : 'Start Dancing!'}
              </div>
            </div>
          </div>
        )}
        
        <div className="video-panels">
          <ReferenceVideo 
            isGameStarted={isGameStarted}
            isPaused={isPaused}
            onVideoEnd={handleVideoEnd}
          />
          <LiveDance 
            isGameStarted={isGameStarted}
            isPaused={isPaused}
            onPoseDetected={handlePoseDetected}
          />
        </div>
        
        {isGameStarted && (
          <RealtimeScorer 
            isGameStarted={isGameStarted}
            poseData={currentPoseData}
            onScoreUpdate={(score, similarity, currentPoints) => {
              setFinalScore(score);
              setCurrentSimilarity(similarity || 0);
              setCurrentScore(currentPoints || 0);
            }}
          />
        )}
      </main>

      {/* AI Coach Integration */}
      {aiCoachEnabled && aiCoachSessionId && (
        <AIChatCoach
          currentPose={currentPoseData}
          similarity={currentSimilarity}
          score={currentScore}
          gameActive={isGameStarted}
        />
      )}

      {/* AI Coach Toggle */}
      <div className="ai-coach-controls">
        <button 
          className={`ai-toggle ${aiCoachEnabled ? 'enabled' : 'disabled'}`}
          onClick={() => {
            setAiCoachEnabled(!aiCoachEnabled);
            if (!aiCoachEnabled) {
              startAiCoachSession();
            }
          }}
        >
          🤖 AI Coach {aiCoachEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {isGameEnded && (
        <GameEnding 
          finalScore={finalScore}
          onPlayAgain={handlePlayAgain}
          onReset={resetGame}
        />
      )}
    </div>
  );
}

export default App;