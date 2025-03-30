import pygame
import csv
import sys
import math
import numpy as np
import joblib
import tempfile
import os

# Load XGBoost model and threshold
clf = joblib.load("copy_detector_model_030_logloss.joblib")
threshold_data = joblib.load("optimal_threshold_030_logloss.joblib")
best_thresh = threshold_data["optimal_threshold"]

INTERVAL_LENGTH = 500

def compute_fft_features(segment):
    """
    Computes FFT features along with derivatives and raw time series for a single segment.
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

def predict_typing(chars_typed_series, backspaces_series, model, threshold):
    """
    Predicts whether typing data contains copied content.
    Returns the prediction for each segment and the overall prediction.
    """
    # Create signal array
    signal = np.vstack((np.array(backspaces_series), np.array(chars_typed_series)))

    # Check if we have enough data for at least one segment
    if signal.shape[1] < INTERVAL_LENGTH:
        return {
            "copy_percentage": 0.0,
            "overall_prediction": "INSUFFICIENT DATA",
            "num_segments": 0
        }

    # Segment the signal
    segments = segment_signal(signal, interval_length=INTERVAL_LENGTH)

    # Extract features
    X_test = extract_features(segments, feature_extractor=compute_fft_features)

    # Make predictions
    if len(X_test) > 0:
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
    else:
        return {
            "copy_percentage": 0.0,
            "overall_prediction": "INSUFFICIENT DATA",
            "num_segments": 0
        }

def find_cursor_pos_from_click(mx, my, typed_text, font, line_spacing, scroll_offset, x_offset, top_margin):
    lines = typed_text.split("\n")
    y = scroll_offset
    total_pos = 0
    for line in lines:
        line_surf = font.render(line, True, (255, 255, 255))
        line_height = line_surf.get_height()
        line_top = y
        line_bottom = y + line_height
        if line_top <= my <= line_bottom:
            running_width = x_offset
            best_char_index = len(line)
            for i, ch in enumerate(line):
                ch_width = font.size(ch)[0]
                if mx < running_width + ch_width / 2:
                    best_char_index = i
                    break
                running_width += ch_width
            return total_pos + best_char_index
        y += line_height + line_spacing
        total_pos += len(line) + 1
    return len(typed_text)

def get_caret_xy(typed_text, cursor_pos, font, line_spacing, scroll_offset, x_offset):
    lines = typed_text.split("\n")
    pos_left = cursor_pos
    y = scroll_offset
    for line in lines:
        line_surf = font.render(line, True, (255, 255, 255))
        line_height = line_surf.get_height()
        n = len(line) + 1
        if pos_left < n:
            sub_str = line[:pos_left]
            caret_x = x_offset + font.size(sub_str)[0]
            caret_y = y
            return caret_x, caret_y, line_height
        y += line_height + line_spacing
        pos_left -= n
    if lines:
        last_line = lines[-1]
    else:
        last_line = ""
    line_surf = font.render(last_line, True, (255, 255, 255))
    return x_offset + font.size(last_line)[0], y, line_surf.get_height()

def draw_text_with_outline(screen, text, font, x, y, text_color, outline_color=(0, 0, 0), offset=1):
    # Render text with outline
    text_surface = font.render(text, True, text_color)
    outline_surface = font.render(text, True, outline_color)
    
    # Draw outline
    screen.blit(outline_surface, (x+offset, y+offset))
    screen.blit(outline_surface, (x+offset, y-offset))
    screen.blit(outline_surface, (x-offset, y+offset))
    screen.blit(outline_surface, (x-offset, y-offset))
    
    # Draw text
    screen.blit(text_surface, (x, y))

def main():
    pygame.init()
    # Increase the window size
    screen_width = 900
    screen_height = 700
    screen = pygame.display.set_mode((screen_width, screen_height))
    pygame.display.set_caption("DeText AI")

    clock = pygame.time.Clock()
    font = pygame.font.SysFont(None, 32)
    ui_font = pygame.font.SysFont(None, 24)
    title_font = pygame.font.SysFont(None, 40, bold=True)

    # Text editing state
    typed_text = ""
    cursor_pos = 0

    # Data collection lists
    chars_typed_series = []
    backspaces_series = []
    mouse_x_series = []
    mouse_y_series = []

    # Store cumulative totals instead of per-interval
    total_chars_typed = 0
    total_backspaces_typed = 0

    # Timer/sampling
    elapsed_time = 0
    interval_length = 100  # 100 ms => 1/10 second
    
    # Analysis timer
    analysis_interval = 1000  # Analyze every 1 second
    analysis_elapsed = 0
    
    # Results
    copy_results = {
        "copy_percentage": 0.0,
        "overall_prediction": "INSUFFICIENT DATA",
        "num_segments": 0
    }

    # Scroll & scrollbar
    scroll_offset = 80  # Increased to make room for header
    line_spacing = 5
    top_margin = 80
    bottom_margin = 50
    x_text_offset = 20

    scrollbar_width = 15
    scrollbar_x = screen_width - scrollbar_width - 15
    scrollbar_y = top_margin
    scrollbar_height = screen_height - top_margin - bottom_margin

    dragging_scrollbar = False
    drag_offset_y = 0

    # Caret blink
    cursor_visible = True
    cursor_blink_time = 500
    time_since_blink = 0
    
    # Status messages
    status_message = "Type naturally or copy-paste text to see AI detection results"
    status_color = (240, 240, 240)

    running = True
    while running:
        dt = clock.tick(60)
        elapsed_time += dt
        time_since_blink += dt
        analysis_elapsed += dt

        if time_since_blink >= cursor_blink_time:
            cursor_visible = not cursor_visible
            time_since_blink = 0

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_BACKSPACE:
                    if cursor_pos > 0:
                        typed_text = typed_text[:cursor_pos - 1] + typed_text[cursor_pos:]
                        cursor_pos -= 1
                    total_backspaces_typed += 1
                elif event.key == pygame.K_RETURN:
                    typed_text = typed_text[:cursor_pos] + "\n" + typed_text[cursor_pos:]
                    cursor_pos += 1
                    total_chars_typed += 1
                elif event.key == pygame.K_s and pygame.key.get_mods() & pygame.KMOD_CTRL:
                    # Save keystroke data to CSV on Ctrl+S
                    with open("keystrokes.csv", "w", newline="") as f:
                        w = csv.writer(f)
                        w.writerow(backspaces_series)
                        w.writerow(chars_typed_series)
                    
                    # Save the actual text content
                    with open("text_content.txt", "w", encoding="utf-8") as f:
                        f.write(typed_text)
                    
                    # Immediately evaluate the data
                    if len(chars_typed_series) >= INTERVAL_LENGTH:
                        copy_results = predict_typing(chars_typed_series, backspaces_series, clf, best_thresh)
                        status_message = f"Data and text saved. Analysis: {copy_results['copy_percentage']:.1f}% copied"
                        
                        # Set status color based on copy percentage
                        percentage = copy_results["copy_percentage"]
                        if percentage < 33:
                            status_color = (100, 255, 100)  # Green for low copy %
                        elif percentage < 66:
                            status_color = (255, 255, 100)  # Yellow for medium copy %
                        else:
                            status_color = (255, 100, 100)  # Red for high copy %
                    else:
                        status_message = "Data and text saved (need more data for analysis)"
                        status_color = (100, 255, 100)
                else:
                    # Insert the character
                    typed_text = typed_text[:cursor_pos] + event.unicode + typed_text[cursor_pos:]
                    cursor_pos += 1
                    total_chars_typed += 1

                    # Auto-wrap: Check if the current line exceeds the available width.
                    # Extract the current line (everything after the last newline)
                    current_line = typed_text[:cursor_pos].rsplit("\n", 1)[-1]
                    # Define a threshold (window width minus text offset and a margin)
                    threshold = screen_width - x_text_offset - scrollbar_width - 40
                    if font.size(current_line)[0] > threshold:
                        typed_text = typed_text[:cursor_pos] + "\n" + typed_text[cursor_pos:]
                        cursor_pos += 1
                        total_chars_typed += 1

            elif event.type == pygame.MOUSEBUTTONDOWN:
                if event.button == 1:
                    mx, my = pygame.mouse.get_pos()
                    # Click on scrollbar will be handled after thumb geometry is calculated
                # Wheel scrolling
                elif event.button == 4:
                    scroll_offset += 20
                elif event.button == 5:
                    scroll_offset -= 20

            elif event.type == pygame.MOUSEBUTTONUP:
                if event.button == 1:
                    dragging_scrollbar = False

            elif event.type == pygame.MOUSEMOTION:
                if dragging_scrollbar:
                    mx, my = event.pos
                    new_thumb_y = my - drag_offset_y
                    # Thumb geometry will be clamped later

        # Sample data every 0.1 seconds
        if elapsed_time >= interval_length:
            mx, my = pygame.mouse.get_pos()
            mouse_x_series.append(mx)
            mouse_y_series.append(my)
            chars_typed_series.append(total_chars_typed)
            backspaces_series.append(total_backspaces_typed)
            elapsed_time -= interval_length
        
        # Analyze data periodically
        if analysis_elapsed >= analysis_interval and len(chars_typed_series) >= INTERVAL_LENGTH:
            copy_results = predict_typing(chars_typed_series, backspaces_series, clf, best_thresh)
            analysis_elapsed = 0

        # Background gradient
        for y in range(screen_height):
            color_value = 20 + min(35, int(y * 0.2))
            pygame.draw.line(screen, (color_value, color_value, color_value + 10), (0, y), (screen_width, y))

        # Calculate text layout
        lines = typed_text.split("\n")
        total_text_height = 0
        for line in lines:
            surf = font.render(line, True, (255, 255, 255))
            total_text_height += surf.get_height() + line_spacing
        if total_text_height > 0:
            total_text_height -= line_spacing  # remove extra spacing below last line

        usable_height = screen_height - (top_margin + bottom_margin)
        bottom_offset = screen_height - bottom_margin - total_text_height

        # Clamp scroll_offset if text is taller than the window
        if total_text_height <= usable_height:
            scroll_offset = top_margin
        else:
            if scroll_offset > top_margin:
                scroll_offset = top_margin
            if scroll_offset < bottom_offset:
                scroll_offset = bottom_offset

        # Scrollbar thumb geometry
        if total_text_height <= usable_height:
            thumb_height = scrollbar_height
            thumb_y = scrollbar_y
        else:
            ratio = usable_height / float(total_text_height)
            thumb_height = max(30, ratio * scrollbar_height)
            scroll_position = (scroll_offset - bottom_offset) / (top_margin - bottom_offset)
            thumb_travel = scrollbar_height - thumb_height
            thumb_y = scrollbar_y + thumb_travel * scroll_position

        # Check for new click on thumb or text to update caret
        mouse_buttons = pygame.mouse.get_pressed()
        if mouse_buttons[0]:
            for e in pygame.event.get(pygame.MOUSEBUTTONDOWN):
                if e.button == 1:
                    mx, my = pygame.mouse.get_pos()
                    if (mx >= scrollbar_x and mx <= scrollbar_x + scrollbar_width
                        and my >= thumb_y and my <= thumb_y + thumb_height):
                        dragging_scrollbar = True
                        drag_offset_y = my - thumb_y
                    else:
                        if my > top_margin and my < screen_height - bottom_margin:
                            if not (mx >= scrollbar_x and mx <= scrollbar_x + scrollbar_width):
                                new_pos = find_cursor_pos_from_click(
                                    mx, my, typed_text, font, line_spacing, scroll_offset,
                                    x_text_offset, top_margin
                                )
                                cursor_pos = new_pos
        else:
            dragging_scrollbar = False

        # Update scrollbar if dragging
        if dragging_scrollbar:
            mx, my = pygame.mouse.get_pos()
            new_thumb_y = my - drag_offset_y
            if new_thumb_y < scrollbar_y:
                new_thumb_y = scrollbar_y
            if new_thumb_y > scrollbar_y + (scrollbar_height - thumb_height):
                new_thumb_y = scrollbar_y + (scrollbar_height - thumb_height)
            thumb_y = new_thumb_y
            scroll_position = (thumb_y - scrollbar_y) / (scrollbar_height - thumb_height)
            scroll_offset = bottom_offset + (top_margin - bottom_offset) * scroll_position

        # Draw text area background
        pygame.draw.rect(screen, (30, 30, 40), 
                         (5, top_margin - 5, 
                          screen_width - 10, 
                          screen_height - top_margin - bottom_margin + 10), 
                         border_radius=5)

        # Draw text
        y = scroll_offset
        for line in lines:
            shadow = font.render(line, True, (0, 0, 0))
            text_surf = font.render(line, True, (255, 255, 255))
            screen.blit(shadow, (x_text_offset+1, y+1))
            screen.blit(text_surf, (x_text_offset, y))
            y += text_surf.get_height() + line_spacing

        # Draw scrollbar track
        pygame.draw.rect(screen, (60, 60, 70), 
                         (scrollbar_x, scrollbar_y, scrollbar_width, scrollbar_height),
                         border_radius=7)
        if total_text_height > usable_height:
            pygame.draw.rect(screen, (120, 120, 140), 
                             (scrollbar_x, thumb_y, scrollbar_width, thumb_height),
                             border_radius=7)

        # Draw caret
        if cursor_visible:
            cx, cy, ch = get_caret_xy(typed_text, cursor_pos, font, line_spacing, scroll_offset, x_text_offset)
            pygame.draw.line(screen, (0, 0, 0), (cx+1, cy+1), (cx+1, cy+ch+1), 2)
            pygame.draw.line(screen, (255, 255, 255), (cx, cy), (cx, cy+ch), 2)
        
        # Draw title and header
        draw_text_with_outline(screen, "DeText AI", title_font, 20, 15, (220, 220, 255))
        draw_text_with_outline(screen, "Type or paste text below to analyze typing patterns", ui_font, 20, 50, (200, 200, 200))
        
        # Draw status bar at bottom
        pygame.draw.rect(screen, (40, 40, 50), (0, screen_height - bottom_margin, screen_width, bottom_margin))
        draw_text_with_outline(screen, status_message, ui_font, 20, screen_height - 35, status_color)
        
        # Draw Ctrl+S save hint
        save_text = "Press Ctrl+S to save data"
        save_width = ui_font.size(save_text)[0]
        draw_text_with_outline(screen, save_text, ui_font, screen_width - save_width - 20, screen_height - 35, (180, 180, 180))
        
        # Draw copy detection results
        if copy_results["num_segments"] > 0:
            # Create colored box based on percentage
            box_width = 200
            box_height = 50
            box_x = screen_width - box_width - 20
            box_y = 15
            
            # Gradient color based on percentage
            percentage = copy_results["copy_percentage"]
            if percentage < 33:
                color = (100, 255, 100)  # Green for low copy %
            elif percentage < 66:
                color = (255, 255, 100)  # Yellow for medium copy %
            else:
                color = (255, 100, 100)  # Red for high copy %
                
            # Draw result box
            pygame.draw.rect(screen, (50, 50, 60), (box_x-5, box_y-5, box_width+10, box_height+10), border_radius=8)
            pygame.draw.rect(screen, color, (box_x, box_y, box_width, box_height), border_radius=5)
            
            # Display percentage
            percentage_text = f"{percentage:.1f}% Copied"
            percentage_width = title_font.size(percentage_text)[0]
            draw_text_with_outline(screen, percentage_text, title_font, 
                               box_x + (box_width - percentage_width) // 2, 
                               box_y + 10, (0, 0, 0))
            
            # Display segments analyzed
            segments_text = f"Segments: {copy_results['num_segments']}"
            draw_text_with_outline(screen, segments_text, ui_font, screen_width - 220, 70, (200, 200, 200))

        pygame.display.update()

    # Save the data when exiting
    with open("keystrokes.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(backspaces_series)
        w.writerow(chars_typed_series)
    
    # Save the text content when exiting
    with open("text_content.txt", "w", encoding="utf-8") as f:
        f.write(typed_text)
    
    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    main() 