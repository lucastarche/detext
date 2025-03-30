import numpy as np
import joblib
import csv
import os
import json

INTERVAL_LENGTH = 500

# If you need any functions from your original script (like segmenting or feature extraction),
# either copy them here or import them from a shared module.

# Example of how to load
clf = joblib.load("data/copy_detector_model_030_logloss.joblib")
threshold_data = joblib.load("data/optimal_threshold_030_logloss.joblib")
best_thresh = threshold_data["optimal_threshold"]

def compute_fft_features(segment):
    """
    Computes FFT features along with derivatives and raw time series for a single segment.
    segment: numpy array of shape (2, interval_length)
    """
    # Extract backspace and key series
    backspace_series = segment[0]
    key_series = segment[1]

    # Compute FFT
    fft_backspaces = np.abs(np.fft.fft(backspace_series))
    fft_keys = np.abs(np.fft.fft(key_series))

    # Use only first half (due to symmetry)
    half_length = len(backspace_series) // 2
    fft_backspaces = fft_backspaces[:half_length]
    fft_keys = fft_keys[:half_length]

    # Compute derivatives (rate of change)
    backspace_derivatives = np.diff(backspace_series, prepend=backspace_series[0])
    keystroke_derivatives = np.diff(key_series, prepend=key_series[0])

    # Combine all features
    return np.concatenate(
        [
            fft_backspaces,  # FFT of backspace series
            fft_keys,  # FFT of keystroke series
            backspace_derivatives,  # Rate of change of backspaces
            keystroke_derivatives,  # Rate of change of keystrokes
            backspace_series,  # Original backspace series
            key_series,  # Original keystroke series
        ]
    )


def segment_signal(signal, interval_length):
    """
    Divides a 2 x total_samples signal into intervals of length interval_length.
    Centers each segment by subtracting its first value.
    """
    num_intervals = signal.shape[1] // interval_length
    segments = []

    for i in range(num_intervals):
        # Extract segment
        segment = signal[:, i * interval_length : (i + 1) * interval_length].copy()

        # Center each row of the segment by subtracting its first value
        segment[0] = segment[0] - segment[0][0]
        segment[1] = segment[1] - segment[1][0]

        segments.append(segment)

    return segments


def extract_features(segments, feature_extractor):
    """Extract features from segments using the provided feature extractor"""
    features = []
    for segment in segments:
        if feature_extractor:
            feature_vector = feature_extractor(segment)
            features.append(feature_vector)

    return np.array(features)


def predict(rows, model, threshold):
    # Convert each row of strings to integers
    chars_typed = np.array([int(x) for x in rows[0]])
    backspaces = np.array([int(x) for x in rows[1]])

    # Create signal array
    signal = np.vstack((backspaces, chars_typed))

    # Segment the signal
    segments = segment_signal(signal, interval_length=INTERVAL_LENGTH)

    # Extract features
    X_test = extract_features(segments, feature_extractor=compute_fft_features)

    # Make predictions
    y_prob = model.predict_proba(X_test)[:, 1]
    y_pred = (y_prob >= threshold).astype(int)

    # Calculate overall prediction
    copy_percentage = np.mean(y_pred) * 100
    overall_prediction = "COPIED" if np.mean(y_pred) >= 0.5 else "NOT COPIED"

    return {
        "segment_predictions": y_pred,
        "segment_probabilities": y_prob,
        "copy_percentage": copy_percentage,
        "overall_prediction": overall_prediction,
        "num_segments": len(segments)
    }

from http.server import BaseHTTPRequestHandler
 
class handler(BaseHTTPRequestHandler):
 
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        text = self.rfile.read(content_length).decode('utf-8')
        response = predict(rows, clf, best_thresh)
        response_json = json.dumps(response)

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response_json)))
        self.end_headers()

        self.wfile.write(response_json.encode('utf-8'))