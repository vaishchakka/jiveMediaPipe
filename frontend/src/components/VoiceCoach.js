import React, { useEffect, useState, useRef } from 'react';
import { useVoice, useCedarState } from 'cedar-os';
import { voiceActions, poseActions, aiCoachingActions } from '../store/cedarStore';
import './VoiceCoach.css';

const VoiceCoach = ({ 
  gameActive, 
  onStartGame, 
  onPauseGame, 
  onResetGame, 
  onShowTips,
  currentScore,
  similarity 
}) => {
  const [voiceState, voiceDispatch] = useCedarState('voiceControl');
  const [aiState, aiDispatch] = useCedarState('aiCoaching');
  const [poseState] = useCedarState('poseState');
  
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState(null);
  const [feedbackQueue, setFeedbackQueue] = useState([]);
  const recognitionRef = useRef(null);
  
  // CedarOS voice integration
  const { 
    startListening, 
    stopListening, 
    speak,
    isSupported: voiceSupported,
    isListening: voiceIsListening 
  } = useVoice({
    onCommand: handleVoiceCommand,
    onSpeechEnd: handleSpeechEnd,
    language: 'en-US',
    continuous: true,
    interimResults: false
  });
  
  // Voice command patterns
  const commandPatterns = {
    startGame: /\b(start|begin|play|go)\b.*\b(game|dancing)\b/i,
    pauseGame: /\b(pause|stop|halt)\b.*\b(game|dancing)\b/i,
    resumeGame: /\b(resume|continue|unpause)\b.*\b(game|dancing)\b/i,
    resetGame: /\b(reset|restart|new)\b.*\b(game|round)\b/i,
    showTips: /\b(help|tips|advice|guide|coach)\b/i,
    hideTips: /\b(hide|close|dismiss)\b.*\b(tips|help)\b/i,
    analyzePerformance: /\b(analyze|check|review)\b.*\b(performance|score)\b/i,
    switchVideo: /\b(switch|change)\b.*\b(video|song|dance)\b/i,
    increaseVolume: /\b(louder|volume up|turn up)\b/i,
    decreaseVolume: /\b(quieter|volume down|turn down)\b/i,
    repeatInstructions: /\b(repeat|again|what)\b/i
  };
  
  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      const recognition = recognitionRef.current;
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
        setIsListening(true);
        voiceDispatch(voiceActions.setListening(true));
      };
      
      recognition.onend = () => {
        setIsListening(false);
        voiceDispatch(voiceActions.setListening(false));
      };
      
      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim();
        processVoiceCommand(transcript);
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        voiceDispatch(voiceActions.setListening(false));
      };
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);
  
  // Provide real-time feedback based on performance
  useEffect(() => {
    if (gameActive && similarity !== null) {
      provideFeedback(similarity, currentScore);
    }
  }, [similarity, currentScore, gameActive]);
  
  // Process feedback queue
  useEffect(() => {
    if (feedbackQueue.length > 0 && voiceState.voiceFeedbackEnabled) {
      const nextFeedback = feedbackQueue[0];
      speak(nextFeedback);
      setFeedbackQueue(prev => prev.slice(1));
    }
  }, [feedbackQueue, voiceState.voiceFeedbackEnabled]);
  
  function handleVoiceCommand(command) {
    processVoiceCommand(command);
  }
  
  function handleSpeechEnd() {
    // Handle when speech synthesis ends
  }
  
  const processVoiceCommand = (transcript) => {
    setLastCommand(transcript);
    voiceDispatch(voiceActions.addCommand(transcript));
    
    // Match command against patterns
    let commandExecuted = false;
    
    Object.entries(commandPatterns).forEach(([commandName, pattern]) => {
      if (pattern.test(transcript)) {
        executeCommand(commandName, transcript);
        commandExecuted = true;
      }
    });
    
    if (!commandExecuted) {
      // Try partial matches or provide help
      provideFallbackResponse(transcript);
    } else {
      voiceDispatch(voiceActions.markCommandExecuted());
    }
  };
  
  const executeCommand = (commandName, transcript) => {
    let response = '';
    
    switch (commandName) {
      case 'startGame':
        if (!gameActive) {
          onStartGame?.();
          response = 'Starting the game! Get ready to dance!';
        } else {
          response = 'Game is already running!';
        }
        break;
        
      case 'pauseGame':
        if (gameActive) {
          onPauseGame?.();
          response = 'Game paused. Take a break!';
        } else {
          response = 'Game is not running.';
        }
        break;
        
      case 'resumeGame':
        if (!gameActive) {
          onStartGame?.();
          response = 'Resuming the game! Keep dancing!';
        } else {
          response = 'Game is already running!';
        }
        break;
        
      case 'resetGame':
        onResetGame?.();
        response = 'Game reset! Ready for a new round?';
        break;
        
      case 'showTips':
        onShowTips?.(true);
        response = 'Here are some tips to improve your dancing!';
        break;
        
      case 'hideTips':
        onShowTips?.(false);
        response = 'Tips hidden. Focus on your dancing!';
        break;
        
      case 'analyzePerformance':
        response = analyzeCurrentPerformance();
        break;
        
      case 'switchVideo':
        response = 'Video switching is not available via voice commands yet.';
        break;
        
      case 'repeatInstructions':
        response = getLastInstructions();
        break;
        
      default:
        response = 'Command understood but not implemented yet.';
    }
    
    queueFeedback(response);
  };
  
  const provideFallbackResponse = (transcript) => {
    const responses = [
      "I didn't understand that command. Try saying 'start game' or 'help'.",
      "Sorry, I didn't catch that. You can say 'pause game' or 'show tips'.",
      "Command not recognized. Try 'reset game' or 'analyze performance'."
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    queueFeedback(randomResponse);
  };
  
  const analyzeCurrentPerformance = () => {
    const avgScore = poseState.totalScore / Math.max(1, poseState.frameCount);
    
    if (avgScore > 80) {
      return `Excellent performance! Your average score is ${Math.round(avgScore)}. Keep up the great work!`;
    } else if (avgScore > 60) {
      return `Good job! Your average score is ${Math.round(avgScore)}. Try to match the poses more precisely.`;
    } else if (avgScore > 40) {
      return `Your average score is ${Math.round(avgScore)}. Focus on arm and leg positioning for better scores.`;
    } else {
      return `Your average score is ${Math.round(avgScore)}. Take your time to match each pose carefully.`;
    }
  };
  
  const getLastInstructions = () => {
    const recentTip = aiState.currentTip;
    if (recentTip) {
      return `Here's the latest tip: ${recentTip}`;
    } else {
      return 'No recent instructions. Keep dancing and I\'ll provide feedback!';
    }
  };
  
  const provideFeedback = (similarity, score) => {
    // Throttle feedback to avoid overwhelming the user
    const now = Date.now();
    const timeSinceLastFeedback = now - (provideFeedback.lastTime || 0);
    
    if (timeSinceLastFeedback < 3000) return; // Wait at least 3 seconds between feedback
    
    provideFeedback.lastTime = now;
    
    let feedback = '';
    
    if (similarity > 90) {
      const encouragements = [
        'Perfect form!',
        'Excellent pose!',
        'You nailed it!',
        'Spot on!',
        'Amazing!'
      ];
      feedback = encouragements[Math.floor(Math.random() * encouragements.length)];
    } else if (similarity > 75) {
      const goodFeedback = [
        'Great job!',
        'Nice work!',
        'Well done!',
        'Good pose!'
      ];
      feedback = goodFeedback[Math.floor(Math.random() * goodFeedback.length)];
    } else if (similarity > 50) {
      const improvementTips = [
        'Good effort! Adjust your arm position.',
        'Nice try! Check your leg stance.',
        'Getting closer! Focus on matching the pose.',
        'Keep practicing! Watch your posture.'
      ];
      feedback = improvementTips[Math.floor(Math.random() * improvementTips.length)];
    } else {
      const encouragingTips = [
        'Keep trying! Focus on the key positions.',
        'Take your time to match the pose.',
        'You can do it! Watch the reference carefully.',
        'Don\'t give up! Every pose is practice.'
      ];
      feedback = encouragingTips[Math.floor(Math.random() * encouragingTips.length)];
    }
    
    if (feedback) {
      queueFeedback(feedback);
    }
  };
  
  const queueFeedback = (message) => {
    setFeedbackQueue(prev => [...prev, message]);
  };
  
  const toggleListening = () => {
    if (!voiceSupported) {
      alert('Voice recognition is not supported in your browser.');
      return;
    }
    
    if (isListening) {
      recognitionRef.current?.stop();
      stopListening?.();
    } else {
      recognitionRef.current?.start();
      startListening?.();
    }
  };
  
  const toggleVoiceFeedback = () => {
    voiceDispatch(voiceActions.toggleVoiceFeedback());
  };
  
  const getAvailableCommands = () => {
    return [
      { command: 'Start game', example: '"Start game" or "Begin dancing"' },
      { command: 'Pause game', example: '"Pause game" or "Stop dancing"' },
      { command: 'Reset game', example: '"Reset game" or "New round"' },
      { command: 'Show tips', example: '"Help" or "Show tips"' },
      { command: 'Analyze performance', example: '"Check my score" or "How am I doing?"' },
      { command: 'Repeat instructions', example: '"What did you say?" or "Repeat"' }
    ];
  };
  
  return (
    <div className="voice-coach">
      <div className="voice-controls">
        <div className="voice-status">
          <div className={`microphone-icon ${isListening ? 'listening' : ''}`}>
            🎤
          </div>
          <div className="status-text">
            {isListening ? 'Listening...' : 'Voice Coach Ready'}
          </div>
        </div>
        
        <div className="voice-buttons">
          <button 
            onClick={toggleListening}
            className={`voice-btn ${isListening ? 'active' : ''}`}
            disabled={!voiceSupported}
          >
            {isListening ? '🔇 Stop Listening' : '🎤 Start Listening'}
          </button>
          
          <button 
            onClick={toggleVoiceFeedback}
            className={`feedback-btn ${voiceState.voiceFeedbackEnabled ? 'active' : ''}`}
          >
            {voiceState.voiceFeedbackEnabled ? '🔊 Feedback On' : '🔇 Feedback Off'}
          </button>
        </div>
      </div>
      
      {lastCommand && (
        <div className="last-command">
          <strong>Last command:</strong> "{lastCommand}"
        </div>
      )}
      
      {feedbackQueue.length > 0 && (
        <div className="feedback-queue">
          <div className="feedback-indicator">
            🗣️ Speaking: "{feedbackQueue[0]}"
          </div>
          {feedbackQueue.length > 1 && (
            <div className="queue-count">
              +{feedbackQueue.length - 1} more messages
            </div>
          )}
        </div>
      )}
      
      <div className="voice-help">
        <details>
          <summary>🗨️ Voice Commands Help</summary>
          <div className="commands-list">
            {getAvailableCommands().map((cmd, index) => (
              <div key={index} className="command-item">
                <strong>{cmd.command}:</strong> {cmd.example}
              </div>
            ))}
          </div>
        </details>
      </div>
      
      {!voiceSupported && (
        <div className="voice-warning">
          ⚠️ Voice recognition is not supported in your browser.
        </div>
      )}
    </div>
  );
};

export default VoiceCoach;