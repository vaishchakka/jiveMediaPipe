# MediaPipe Pose Extractor & Angle Comparer

A minimal Python project that extracts human pose from videos using MediaPipe, computes joint angles, applies EMA smoothing, and provides angle comparison via cosine similarity.

## Features

- **Pose Extraction**: Extract 33 pose landmarks from video using MediaPipe
- **World Landmarks**: Prefer 3D world coordinates (meters), fallback to 2D normalized→pixels
- **Angle Computation**: Calculate elbow and knee angles in radians (0 to π)
- **EMA Smoothing**: Temporal smoothing with configurable alpha parameter
- **Video Overlay**: Optional skeleton overlay video output
- **Angle Comparison**: Compare two angle timelines using cosine similarity

## Setup

**Note**: MediaPipe requires Python 3.8-3.11. Python 3.13 is not yet supported.

```bash
# Use Python 3.11 or earlier
python3.11 -m venv .venv  # or python3.10, python3.9
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

If you only have Python 3.13 available, you can:
1. Install Python 3.11 via Homebrew: `brew install python@3.11`
2. Use conda: `conda create -n pose python=3.11 && conda activate pose`

## Usage

### 🎬 Web Frontend (Recommended)

Launch the interactive web viewer:

```bash
# One-command startup (installs dependencies and starts both API + React)
./start_frontend.sh
```

This opens:
- **React Frontend**: http://localhost:3000 (Interactive pose viewer)
- **API Server**: http://localhost:5000 (Serves pose data)

### 📊 Command Line Tools

#### Extract Pose from Video

```bash
# Basic extraction
python src/extract_pose.py --video videos/dance.mov

# With overlay video and custom parameters
python src/extract_pose.py --video videos/dance.mov --overlay out/overlay.mp4 --sample_hz 15 --alpha 0.7

# Custom output paths
python src/extract_pose.py --video videos/dance.mov --jsonl out/poses.jsonl --csv out/angles.csv
```

#### Compare Angle Timelines

```bash
# Compare two angle CSV files
python src/compare_angles.py --ref out/angles.csv --usr out/user_angles.csv

# With custom sample count
python src/compare_angles.py --ref out/angles.csv --usr out/user_angles.csv --samples 500
```

## Parameters

### extract_pose.py
- `--video`: Path to input video (required)
- `--jsonl`: Output landmarks JSONL path (default: `out/poses.jsonl`)
- `--csv`: Output angles CSV path (default: `out/angles.csv`)
- `--overlay`: Output overlay video path (optional)
- `--sample_hz`: Sampling frequency in Hz (default: 15.0)
- `--alpha`: EMA smoothing factor 0-1 (default: 0.7)

### compare_angles.py
- `--ref`: Reference angles CSV path (required)
- `--usr`: User angles CSV path (required)
- `--samples`: Number of comparison samples (default: 200)

## Output Files

### JSONL Format (Landmarks)
```json
{"t": 0.0, "ok": true, "kp": [[x, y, z, visibility], ...]}
{"t": 0.067, "ok": true, "kp": [[x, y, z, visibility], ...]}
```

### CSV Format (Angles)
```csv
t,elbow_L,elbow_R,knee_L,knee_R
0.0,1.23,1.45,2.1,1.9
0.067,1.25,1.43,2.05,1.95
```

## Project Structure

```
.
├─ README.md
├─ requirements.txt
├─ requirements_api.txt
├─ .gitignore
├─ start_frontend.sh    # One-command frontend startup
├─ api_server.py       # Flask API server
├─ videos/              # Input videos
│  └─ dance.mov
├─ out/                 # Output files
│  ├─ poses.jsonl      # Pose landmarks
│  ├─ angles.csv       # Joint angles
│  └─ overlay.mp4      # Skeleton overlay video
├─ frontend/            # React web interface
│  ├─ src/
│  │  ├─ components/
│  │  │  ├─ VideoPlayer.js      # Video with pose overlay
│  │  │  ├─ AngleCharts.js      # Interactive angle charts
│  │  │  └─ PoseDataViewer.js    # Pose data explorer
│  │  └─ App.js
│  └─ package.json
└─ src/
   ├─ extract_pose.py   # Main extractor
   └─ compare_angles.py # Angle comparer
```

## Dependencies

- `mediapipe==0.10.14`
- `opencv-python`
- `numpy`
- `pandas`

## Algorithm Details

### Pose Extraction
1. Sample video at specified Hz by frame skipping
2. Run MediaPipe Pose detection
3. Prefer world landmarks (3D meters), fallback to 2D normalized→pixels
4. Apply EMA smoothing: `out = α*curr + (1-α)*prev`
5. Compute angles using 3-point angle formula

### Angle Computation
- **Elbow angles**: (shoulder, elbow, wrist)
- **Knee angles**: (hip, knee, ankle)
- All angles in radians (0 to π)

### Comparison
1. Find overlapping time window between datasets
2. Resample to common timestamps via linear interpolation
3. Compute cosine similarity of 4-angle vectors
4. Map to [0,1] range: `(cos_sim + 1) / 2`
5. Report mean/min/max similarity scores
