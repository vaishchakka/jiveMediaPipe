#!/bin/bash

echo "🚀 Starting MediaPipe Pose Viewer Frontend"
echo "=========================================="

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "❌ Virtual environment not found. Please run setup first:"
    echo "   python3.11 -m venv .venv"
    echo "   source .venv/bin/activate"
    echo "   pip install -r requirements.txt"
    exit 1
fi

# Activate virtual environment
echo "📦 Activating Python virtual environment..."
source .venv/bin/activate

# Install API dependencies
echo "📦 Installing API dependencies..."
pip install flask flask-cors

# Check if pose data exists
if [ ! -f "out/poses.jsonl" ] || [ ! -f "out/angles.csv" ]; then
    echo "⚠️  No pose data found. Running pose extraction first..."
    python src/extract_pose.py --video videos/dance.mov --overlay out/overlay.mp4 --sample_hz 15 --alpha 0.7
fi

# Install frontend dependencies
echo "📦 Installing React dependencies..."
cd frontend
npm install

# Start API server in background
echo "🌐 Starting API server..."
cd ..
python api_server.py &
API_PID=$!

# Wait a moment for API to start
sleep 3

# Start React frontend
echo "⚛️  Starting React frontend..."
cd frontend
DANGEROUSLY_DISABLE_HOST_CHECK=true npm start &
REACT_PID=$!

echo ""
echo "✅ Frontend is starting up!"
echo "   🌐 API Server: http://localhost:5000"
echo "   ⚛️  React App: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $API_PID 2>/dev/null
    kill $REACT_PID 2>/dev/null
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for processes
wait
