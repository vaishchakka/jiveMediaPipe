import React, { useEffect, useRef, useState } from 'react';
import { 
  useChatInput, 
  useMessages, 
  useCedarState, 
  CedarCopilot 
} from 'cedar-os';
import { aiCoachingActions, poseActions } from '../store/cedarStore';
import './AIChatCoach.css';

const AIChatCoach = ({ currentPose, similarity, score, gameActive }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [userInput, setUserInput] = useState('');
  const messagesEndRef = useRef(null);
  
  // CedarOS hooks for chat functionality
  const { sendMessage, isTyping } = useChatInput({
    onMessage: handleAIResponse,
    systemPrompt: `You are an AI dance coach for a pose-matching game. 
    Analyze user poses, provide constructive feedback, and give encouraging tips. 
    Keep responses concise and actionable. Focus on specific body parts that need improvement.
    Be motivational and positive while being technically helpful.`
  });
  
  const messages = useMessages();
  
  // Cedar state for AI coaching
  const [aiState, dispatch] = useCedarState('aiCoaching', {
    messages: [],
    isTyping: false,
    currentTip: null,
    improvementSuggestions: [],
    performanceAnalysis: null,
    chatHistory: []
  });
  
  const [poseState, poseDispatch] = useCedarState('poseState');
  
  // AI analysis of pose performance
  useEffect(() => {
    if (currentPose && similarity !== null && gameActive) {
      analyzePosePerformance();
    }
  }, [currentPose, similarity, score, gameActive]);
  
  // Auto-scroll to bottom of messages
  useEffect(() => {
    scrollToBottom();
  }, [aiState.chatHistory, messages]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const analyzePosePerformance = () => {
    // Generate AI coaching based on similarity score
    let tip = null;
    let suggestionType = 'info';
    
    if (similarity >= 90) {
      tip = "🎯 Excellent form! You're nailing this pose!";
      suggestionType = 'success';
    } else if (similarity >= 75) {
      tip = "👍 Great job! Minor adjustments will perfect this pose.";
      suggestionType = 'success';
    } else if (similarity >= 60) {
      tip = "💪 Good effort! Focus on matching the reference pose more closely.";
      suggestionType = 'tip';
    } else if (similarity >= 40) {
      tip = "📐 Check your arm and leg positioning - they need adjustment.";
      suggestionType = 'warning';
    } else {
      tip = "🔄 Let's work on this pose - focus on the key body positions.";
      suggestionType = 'warning';
    }
    
    // Add contextual suggestions based on pose analysis
    const suggestions = generateImprovementSuggestions(similarity, currentPose);
    
    if (tip) {
      dispatch(aiCoachingActions.addMessage({
        content: tip,
        type: suggestionType
      }));
      
      dispatch(aiCoachingActions.updateCurrentTip(tip));
    }
    
    if (suggestions.length > 0) {
      suggestions.forEach(suggestion => {
        dispatch(aiCoachingActions.addImprovementSuggestion(suggestion));
      });
    }
  };
  
  const generateImprovementSuggestions = (similarity, pose) => {
    const suggestions = [];
    
    if (similarity < 70) {
      suggestions.push({
        joint: 'arms',
        suggestion: 'Focus on matching the arm positions more precisely',
        priority: 'high'
      });
    }
    
    if (similarity < 60) {
      suggestions.push({
        joint: 'legs',
        suggestion: 'Adjust your leg stance to better match the reference',
        priority: 'high'
      });
    }
    
    if (similarity < 50) {
      suggestions.push({
        joint: 'torso',
        suggestion: 'Work on your torso alignment and posture',
        priority: 'medium'
      });
    }
    
    return suggestions;
  };
  
  function handleAIResponse(response) {
    dispatch(aiCoachingActions.addChatMessage({
      message: response.content,
      sender: 'ai'
    }));
    
    dispatch(aiCoachingActions.setTyping(false));
  }
  
  const handleUserMessage = async (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;
    
    // Add user message to chat
    dispatch(aiCoachingActions.addChatMessage({
      message: userInput,
      sender: 'user'
    }));
    
    // Show typing indicator
    dispatch(aiCoachingActions.setTyping(true));
    
    // Send to AI with current context
    const context = {
      currentSimilarity: similarity,
      currentScore: score,
      isGameActive: gameActive,
      recentSuggestions: aiState.improvementSuggestions.slice(-3)
    };
    
    await sendMessage(userInput, context);
    setUserInput('');
  };
  
  const getPerformanceAnalysis = () => {
    const avgSimilarity = poseState.poseHistory.length > 0 
      ? poseState.poseHistory.reduce((sum, pose) => sum + (pose.similarity || 0), 0) / poseState.poseHistory.length
      : 0;
    
    return {
      averageSimilarity: avgSimilarity,
      totalFrames: poseState.frameCount,
      improvementTrend: calculateImprovementTrend(),
      strongPoints: identifyStrengths(),
      areasToImprove: identifyWeaknesses()
    };
  };
  
  const calculateImprovementTrend = () => {
    const recent = poseState.poseHistory.slice(-10);
    const older = poseState.poseHistory.slice(-20, -10);
    
    if (recent.length === 0 || older.length === 0) return 'neutral';
    
    const recentAvg = recent.reduce((sum, p) => sum + (p.similarity || 0), 0) / recent.length;
    const olderAvg = older.reduce((sum, p) => sum + (p.similarity || 0), 0) / older.length;
    
    if (recentAvg > olderAvg + 5) return 'improving';
    if (recentAvg < olderAvg - 5) return 'declining';
    return 'stable';
  };
  
  const identifyStrengths = () => {
    // Mock analysis - in real implementation, this would analyze specific joints
    return ['Arm positioning', 'Balance'];
  };
  
  const identifyWeaknesses = () => {
    // Mock analysis - in real implementation, this would analyze specific joints
    return ['Leg alignment', 'Posture'];
  };
  
  const toggleExpansion = () => {
    setIsExpanded(!isExpanded);
  };
  
  const renderMessage = (message) => {
    const isAI = message.sender === 'ai';
    return (
      <div 
        key={message.id} 
        className={`message ${isAI ? 'ai-message' : 'user-message'}`}
      >
        <div className="message-avatar">
          {isAI ? '🤖' : '👤'}
        </div>
        <div className="message-content">
          <div className="message-text">{message.message}</div>
          <div className="message-time">
            {new Date(message.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className={`ai-chat-coach ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Header */}
      <div className="coach-header" onClick={toggleExpansion}>
        <div className="coach-info">
          <span className="coach-avatar">🤖</span>
          <div>
            <div className="coach-name">AI Dance Coach</div>
            <div className="coach-status">
              {gameActive ? (
                <span className="active-status">
                  📊 Analyzing Performance • Score: {score}
                </span>
              ) : (
                <span className="idle-status">💭 Ready to help</span>
              )}
            </div>
          </div>
        </div>
        <button className="expand-toggle">
          {isExpanded ? '▼' : '▲'}
        </button>
      </div>
      
      {/* Real-time tips (always visible) */}
      {aiState.currentTip && (
        <div className="current-tip">
          <div className="tip-content">
            {aiState.currentTip}
          </div>
        </div>
      )}
      
      {/* Expanded chat interface */}
      {isExpanded && (
        <div className="chat-expanded">
          {/* Performance Summary */}
          {gameActive && poseState.frameCount > 10 && (
            <div className="performance-summary">
              <h4>📈 Performance Summary</h4>
              <div className="summary-stats">
                <div className="stat">
                  <span className="stat-label">Avg Similarity:</span>
                  <span className="stat-value">
                    {Math.round(getPerformanceAnalysis().averageSimilarity)}%
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">Trend:</span>
                  <span className={`stat-value trend-${getPerformanceAnalysis().improvementTrend}`}>
                    {getPerformanceAnalysis().improvementTrend}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {/* Auto-generated suggestions */}
          {aiState.improvementSuggestions.length > 0 && (
            <div className="improvement-suggestions">
              <h4>💡 Improvement Tips</h4>
              {aiState.improvementSuggestions.slice(-3).map((suggestion, index) => (
                <div key={index} className={`suggestion priority-${suggestion.priority}`}>
                  <strong>{suggestion.joint}:</strong> {suggestion.suggestion}
                </div>
              ))}
            </div>
          )}
          
          {/* Chat messages */}
          <div className="chat-messages">
            {aiState.chatHistory.map(renderMessage)}
            {aiState.isTyping && (
              <div className="typing-indicator">
                <div className="message ai-message">
                  <div className="message-avatar">🤖</div>
                  <div className="message-content">
                    <div className="typing-dots">
                      <span>●</span><span>●</span><span>●</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Chat input */}
          <form onSubmit={handleUserMessage} className="chat-input-form">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Ask for coaching tips..."
              className="chat-input"
              disabled={aiState.isTyping}
            />
            <button 
              type="submit" 
              className="send-button"
              disabled={!userInput.trim() || aiState.isTyping}
            >
              📤
            </button>
          </form>
        </div>
      )}
      
      {/* CedarOS Copilot Integration */}
      <CedarCopilot
        context={{
          currentPose,
          similarity,
          score,
          gameActive,
          performanceAnalysis: getPerformanceAnalysis()
        }}
        tools={[
          {
            name: 'analyzePose',
            description: 'Analyze current pose and provide feedback',
            handler: analyzePosePerformance
          },
          {
            name: 'getPerformanceStats',
            description: 'Get detailed performance statistics',
            handler: getPerformanceAnalysis
          }
        ]}
      />
    </div>
  );
};

export default AIChatCoach;