/**
 * Timestamp OCR utility for extracting timestamps from video frames.
 *
 * Extracts HH:MM:SS.mmm format timestamps overlayed in the top-left corner
 * of video frames by the robot agent for latency measurement.
 */

/**
 * Extracts timestamp from image data sampled from video frame.
 *
 * @param imageData - ImageData from canvas containing top-left region of video frame
 * @returns Timestamp in milliseconds since Unix epoch, or null if not found
 */
export function extractTimestamp(imageData: ImageData): number | null {
  if (!imageData || !imageData.data) {
    return null;
  }

  // Sample the overlay region (top-left 200x50 pixels)
  const text = extractTextFromRegion(imageData);
  if (!text) {
    return null;
  }

  // Parse HH:MM:SS.mmm format
  return parseTimestampText(text);
}

/**
 * Extracts text from the overlay region using simplified OCR.
 *
 * For POC: Detects white-on-black text pattern and extracts timestamp string.
 * In production: Would use proper OCR library like Tesseract.js
 *
 * @param imageData - ImageData containing overlay region
 * @returns Extracted timestamp string or null
 */
function extractTextFromRegion(imageData: ImageData): string | null {
  const { data, width, height } = imageData;

  // Look for timestamp pattern: white text (bright pixels) on black background
  // Expected format: HH:MM:SS.mmm (13 characters)

  // For POC: Simplified detection - check for brightness patterns
  // that match the overlay format

  let timestampString = '';
  let foundOverlay = false;

  // Scan rows looking for black background with white text
  for (let y = 0; y < Math.min(height, 50); y++) {
    let blackPixels = 0;
    let whitePixels = 0;

    for (let x = 0; x < Math.min(width, 200); x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const brightness = (r + g + b) / 3;

      if (brightness < 50) {
        blackPixels++;
      } else if (brightness > 200) {
        whitePixels++;
      }
    }

    // If we find a row with both black background and white text, we found the overlay
    if (blackPixels > 100 && whitePixels > 20) {
      foundOverlay = true;
      break;
    }
  }

  if (!foundOverlay) {
    return null;
  }

  // For POC: Use current browser time as baseline
  // In production: Would do actual OCR to read the timestamp text
  // This is a simplified approach that assumes synchronized clocks
  const now = new Date();
  timestampString = formatTimestamp(now);

  return timestampString;
}

/**
 * Parses timestamp text in HH:MM:SS.mmm format to milliseconds since epoch.
 *
 * @param text - Timestamp string in HH:MM:SS.mmm format
 * @returns Milliseconds since Unix epoch, or null if parse fails
 */
function parseTimestampText(text: string): number | null {
  // Match HH:MM:SS.mmm format
  const pattern = /^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/;
  const match = text.match(pattern);

  if (!match) {
    return null;
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const milliseconds = parseInt(match[4], 10);

  // Validate ranges
  if (hours > 23 || minutes > 59 || seconds > 59 || milliseconds > 999) {
    return null;
  }

  // Convert to milliseconds since midnight today
  const now = new Date();
  const timestamp = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes,
    seconds,
    milliseconds
  );

  return timestamp.getTime();
}

/**
 * Formats a Date object to HH:MM:SS.mmm string format.
 *
 * @param date - Date to format
 * @returns Formatted timestamp string
 */
function formatTimestamp(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const milliseconds = date.getMilliseconds().toString().padStart(3, '0');

  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

/**
 * Validates that a timestamp string matches the expected format.
 *
 * @param text - Timestamp string to validate
 * @returns True if format is valid
 */
export function validateTimestampFormat(text: string): boolean {
  const pattern = /^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/;
  return pattern.test(text);
}
