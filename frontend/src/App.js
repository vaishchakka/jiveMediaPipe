import React, { useState, useEffect, useCallback } from 'react';
import ReferenceVideo from './components/ReferenceVideo';
import LiveDance from './components/LiveDance';
import RealtimeScorer from './components/RealtimeScorer';
import GameEnding from './components/GameEnding';
import './App.css';

function App() {
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [gameStartCountdown, setGameStartCountdown] = useState(null);
  const [currentPoseData, setCurrentPoseData] = useState(null);
  const [isGameEnded, setIsGameEnded] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  // Handle pose detection from LiveDance component
  const handlePoseDetected = useCallback((poseData) => {
    setCurrentPoseData(poseData);
  }, []);

  // Handle video end - trigger game ending
  const handleVideoEnd = useCallback(() => {
    setIsGameEnded(true);
    setIsGameStarted(false);
  }, []);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setUploadedFile(file);
      setIsProcessing(true);
      // Simulate processing
      setTimeout(() => {
        setIsProcessing(false);
      }, 2000);
    }
  };

  const startGame = () => {
    if (gameStartCountdown === null) {
      setGameStartCountdown(5);
    }
  };

  // Simple reset function - no countdown needed
  const resetGame = () => {
    setIsGameStarted(false);
    setIsPaused(false);
    setGameStartCountdown(null);
    setIsGameEnded(false);
    setFinalScore(0);
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
            onScoreUpdate={setFinalScore}
          />
        )}
      </main>

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