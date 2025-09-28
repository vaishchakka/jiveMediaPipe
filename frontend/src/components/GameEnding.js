import React, { useEffect, useState } from 'react';
import './GameEnding.css';

const GameEnding = ({ finalScore, onPlayAgain, onReset }) => {
  const [showScore, setShowScore] = useState(false);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    // Show score after a brief delay
    const scoreTimer = setTimeout(() => {
      setShowScore(true);
    }, 1000);

    return () => clearTimeout(scoreTimer);
  }, []);

  const getScoreMessage = (score) => {
    return "Good Job! 🎉";
  };


  return (
    <div className="game-ending-overlay">
      <div className="game-ending-content">
        <div className="ending-header">
          <h1 className="ending-title">🎵 DANCE COMPLETE! 🎵</h1>
        </div>
        
        {showScore && (
          <div className="score-display">
            <div className="final-score-section">
              <div className="score-label">FINAL SCORE</div>
              <div className="score-number">{finalScore}</div>
            </div>
            
            <div className="score-message">
              {getScoreMessage(finalScore)}
            </div>
          </div>
        )}

        <div className="ending-actions">
          <button 
            className="play-again-button"
            onClick={onPlayAgain}
          >
            🎮 Play Again
          </button>
          <button 
            className="reset-button"
            onClick={onReset}
          >
            🔄 Reset
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameEnding;
