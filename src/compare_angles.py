#!/usr/bin/env python3
"""
Compare two angle CSV files using cosine similarity.
"""

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd


def compare_angle_timelines(ref_csv: str, usr_csv: str, samples: int = 200) -> None:
    """Compare two angle CSV files using cosine similarity."""
    
    # Load CSV files
    try:
        ref_df = pd.read_csv(ref_csv)
        usr_df = pd.read_csv(usr_csv)
    except Exception as e:
        print(f"Error loading CSV files: {e}")
        sys.exit(1)
    
    # Check required columns
    required_cols = ['t', 'elbow_L', 'elbow_R', 'knee_L', 'knee_R']
    for df, name in [(ref_df, 'reference'), (usr_df, 'user')]:
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            print(f"Error: Missing columns in {name} CSV: {missing_cols}")
            sys.exit(1)
    
    # Find overlapping time window
    ref_start, ref_end = ref_df['t'].min(), ref_df['t'].max()
    usr_start, usr_end = usr_df['t'].min(), usr_df['t'].max()
    
    overlap_start = max(ref_start, usr_start)
    overlap_end = min(ref_end, usr_end)
    
    if overlap_start >= overlap_end:
        print("Error: No overlapping time window between reference and user data")
        sys.exit(1)
    
    print(f"Overlapping time window: {overlap_start:.2f}s to {overlap_end:.2f}s")
    
    # Create evenly spaced timestamps
    timestamps = np.linspace(overlap_start, overlap_end, samples)
    
    # Interpolate angles for both datasets
    angle_cols = ['elbow_L', 'elbow_R', 'knee_L', 'knee_R']
    
    ref_interp = {}
    usr_interp = {}
    
    for col in angle_cols:
        # Interpolate reference data
        ref_interp[col] = np.interp(timestamps, ref_df['t'], ref_df[col])
        
        # Interpolate user data
        usr_interp[col] = np.interp(timestamps, usr_df['t'], usr_df[col])
    
    # Compute cosine similarities
    similarities = []
    
    for i in range(len(timestamps)):
        # Form 4-angle vectors
        ref_vector = np.array([ref_interp[col][i] for col in angle_cols])
        usr_vector = np.array([usr_interp[col][i] for col in angle_cols])
        
        # Compute cosine similarity
        dot_product = np.dot(ref_vector, usr_vector)
        norm_ref = np.linalg.norm(ref_vector)
        norm_usr = np.linalg.norm(usr_vector)
        
        if norm_ref < 1e-6 or norm_usr < 1e-6:
            # Handle zero vectors
            cos_sim = 0.0
        else:
            cos_sim = dot_product / (norm_ref * norm_usr)
            cos_sim = np.clip(cos_sim, -1.0, 1.0)
        
        # Map to [0, 1] range
        similarity = (cos_sim + 1.0) / 2.0
        similarities.append(similarity)
    
    similarities = np.array(similarities)
    
    # Print results
    mean_sim = np.mean(similarities)
    min_sim = np.min(similarities)
    max_sim = np.max(similarities)
    
    print(f"Mean: {mean_sim:.3f}  Min: {min_sim:.3f}  Max: {max_sim:.3f}  (N={len(similarities)})")


def main():
    parser = argparse.ArgumentParser(description='Compare two angle CSV files using cosine similarity')
    parser.add_argument('--ref', required=True, help='Reference angles CSV path')
    parser.add_argument('--usr', required=True, help='User angles CSV path')
    parser.add_argument('--samples', type=int, default=200, help='Number of samples for comparison')
    
    args = parser.parse_args()
    
    # Validate inputs
    if not Path(args.ref).exists():
        print(f"Error: Reference CSV not found: {args.ref}")
        sys.exit(1)
    
    if not Path(args.usr).exists():
        print(f"Error: User CSV not found: {args.usr}")
        sys.exit(1)
    
    if args.samples < 2:
        print("Error: Samples must be at least 2")
        sys.exit(1)
    
    try:
        compare_angle_timelines(
            ref_csv=args.ref,
            usr_csv=args.usr,
            samples=args.samples
        )
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
