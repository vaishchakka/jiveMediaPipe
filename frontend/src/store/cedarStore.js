import { createStateSlice, setCedarStore } from 'cedar-os';

// Cedar OS state slices for pose management
export const poseStateSlice = createStateSlice({
  name: 'poseState',
  initialState: {
    currentPose: null,
    referencePose: null,
    similarity: 0,
    score: 0,
    isGameActive: false,
    gameStartTime: null,
    totalScore: 0,
    poseHistory: [],
    frameCount: 0
  },
  reducers: {
    updateCurrentPose: (state, action) => {
      state.currentPose = action.payload;
      if (action.payload) {
        state.poseHistory.push({
          pose: action.payload,
          timestamp: Date.now(),
          frame: state.frameCount++
        });
        // Keep only last 100 poses for performance
        if (state.poseHistory.length > 100) {
          state.poseHistory = state.poseHistory.slice(-100);
        }
      }
    },
    updateReferencePose: (state, action) => {
      state.referencePose = action.payload;
    },
    updateSimilarity: (state, action) => {
      state.similarity = action.payload;
    },
    updateScore: (state, action) => {
      state.score = action.payload;
      state.totalScore += action.payload;
    },
    startGame: (state) => {
      state.isGameActive = true;
      state.gameStartTime = Date.now();
      state.totalScore = 0;
      state.poseHistory = [];
      state.frameCount = 0;
    },
    endGame: (state) => {
      state.isGameActive = false;
    },
    resetGame: (state) => {
      state.currentPose = null;
      state.referencePose = null;
      state.similarity = 0;
      state.score = 0;
      state.isGameActive = false;
      state.gameStartTime = null;
      state.totalScore = 0;
      state.poseHistory = [];
      state.frameCount = 0;
    }
  }
});

export const aiCoachingSlice = createStateSlice({
  name: 'aiCoaching',
  initialState: {
    messages: [],
    isTyping: false,
    currentTip: null,
    improvementSuggestions: [],
    performanceAnalysis: null,
    chatHistory: []
  },
  reducers: {
    addMessage: (state, action) => {
      state.messages.push({
        id: Date.now(),
        content: action.payload.content,
        type: action.payload.type || 'info', // info, tip, warning, success
        timestamp: Date.now()
      });
      // Keep last 50 messages
      if (state.messages.length > 50) {
        state.messages = state.messages.slice(-50);
      }
    },
    setTyping: (state, action) => {
      state.isTyping = action.payload;
    },
    updateCurrentTip: (state, action) => {
      state.currentTip = action.payload;
    },
    addImprovementSuggestion: (state, action) => {
      state.improvementSuggestions.push(action.payload);
      // Keep last 10 suggestions
      if (state.improvementSuggestions.length > 10) {
        state.improvementSuggestions = state.improvementSuggestions.slice(-10);
      }
    },
    updatePerformanceAnalysis: (state, action) => {
      state.performanceAnalysis = action.payload;
    },
    addChatMessage: (state, action) => {
      state.chatHistory.push({
        id: Date.now(),
        message: action.payload.message,
        sender: action.payload.sender, // 'user' or 'ai'
        timestamp: Date.now()
      });
    },
    clearMessages: (state) => {
      state.messages = [];
      state.currentTip = null;
    }
  }
});

export const diffStateSlice = createStateSlice({
  name: 'diffState',
  initialState: {
    poseDifferences: [],
    highlightedJoints: [],
    diffVisualization: null,
    comparisonMode: 'overlay', // 'overlay', 'sideBySide', 'diff'
    showDifferenceHeatmap: true,
    jointAccuracyScores: {}
  },
  reducers: {
    updatePoseDifferences: (state, action) => {
      state.poseDifferences = action.payload;
    },
    highlightJoints: (state, action) => {
      state.highlightedJoints = action.payload;
    },
    setVisualization: (state, action) => {
      state.diffVisualization = action.payload;
    },
    setComparisonMode: (state, action) => {
      state.comparisonMode = action.payload;
    },
    toggleHeatmap: (state) => {
      state.showDifferenceHeatmap = !state.showDifferenceHeatmap;
    },
    updateJointScores: (state, action) => {
      state.jointAccuracyScores = action.payload;
    }
  }
});

export const voiceControlSlice = createStateSlice({
  name: 'voiceControl',
  initialState: {
    isListening: false,
    lastCommand: null,
    recognition: null,
    voiceFeedbackEnabled: true,
    availableCommands: [
      'start game',
      'pause game',
      'resume game',
      'reset game',
      'show tips',
      'hide tips',
      'switch video',
      'analyze performance'
    ],
    commandHistory: []
  },
  reducers: {
    setListening: (state, action) => {
      state.isListening = action.payload;
    },
    addCommand: (state, action) => {
      state.lastCommand = action.payload;
      state.commandHistory.push({
        command: action.payload,
        timestamp: Date.now(),
        executed: false
      });
      // Keep last 20 commands
      if (state.commandHistory.length > 20) {
        state.commandHistory = state.commandHistory.slice(-20);
      }
    },
    markCommandExecuted: (state) => {
      if (state.commandHistory.length > 0) {
        state.commandHistory[state.commandHistory.length - 1].executed = true;
      }
    },
    toggleVoiceFeedback: (state) => {
      state.voiceFeedbackEnabled = !state.voiceFeedbackEnabled;
    },
    setRecognition: (state, action) => {
      // Note: We can't store the recognition object directly in state
      // This would be handled in the component
    }
  }
});

// Initialize Cedar store with our slices
export const initializeCedarStore = () => {
  setCedarStore({
    slices: [
      poseStateSlice,
      aiCoachingSlice,
      diffStateSlice,
      voiceControlSlice
    ]
  });
};

// Export action creators for easy use
export const poseActions = poseStateSlice.actions;
export const aiCoachingActions = aiCoachingSlice.actions;
export const diffActions = diffStateSlice.actions;
export const voiceActions = voiceControlSlice.actions;