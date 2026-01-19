import { extractTimestamp, validateTimestampFormat } from '../timestampOCR';

// Mock ImageData for Node.js test environment
class MockImageData implements ImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  colorSpace: PredefinedColorSpace = 'srgb';

  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

// Replace global ImageData with mock
(global as any).ImageData = MockImageData;

describe('timestampOCR', () => {
  describe('validateTimestampFormat', () => {
    it('should validate correct timestamp format', () => {
      expect(validateTimestampFormat('12:34:56.789')).toBe(true);
      expect(validateTimestampFormat('00:00:00.000')).toBe(true);
      expect(validateTimestampFormat('23:59:59.999')).toBe(true);
    });

    it('should reject invalid timestamp formats', () => {
      expect(validateTimestampFormat('1:34:56.789')).toBe(false); // Single digit hour
      expect(validateTimestampFormat('12:3:56.789')).toBe(false); // Single digit minute
      expect(validateTimestampFormat('12:34:5.789')).toBe(false); // Single digit second
      expect(validateTimestampFormat('12:34:56.78')).toBe(false); // Two digit milliseconds
      expect(validateTimestampFormat('12:34:56')).toBe(false); // Missing milliseconds
      expect(validateTimestampFormat('invalid')).toBe(false);
      expect(validateTimestampFormat('')).toBe(false);
    });
  });

  describe('extractTimestamp', () => {
    function createMockImageData(width: number, height: number, hasOverlay: boolean): ImageData {
      const data = new Uint8ClampedArray(width * height * 4);

      if (hasOverlay) {
        // Simulate black background with white text in top-left region
        // Need at least one row with >100 black pixels and >20 white pixels
        for (let y = 0; y < Math.min(height, 50); y++) {
          for (let x = 0; x < Math.min(width, 200); x++) {
            const idx = (y * width + x) * 4;

            // Default to black background for the entire overlay region
            data[idx] = 0;     // R
            data[idx + 1] = 0; // G
            data[idx + 2] = 0; // B
            data[idx + 3] = 255; // A

            // Add white text pixels in several rows to simulate timestamp
            // Create rows with sufficient white pixels (>20) and black background (>100)
            if (y >= 15 && y < 25) {
              // Add white pixels for text
              if (x >= 10 && x < 40) {
                data[idx] = 255;     // R
                data[idx + 1] = 255; // G
                data[idx + 2] = 255; // B
              } else if (x >= 50 && x < 80) {
                data[idx] = 255;     // R
                data[idx + 1] = 255; // G
                data[idx + 2] = 255; // B
              }
            }
          }
        }
      }

      return new ImageData(data, width, height) as ImageData;
    }

    it('should extract timestamp from valid overlay', () => {
      const imageData = createMockImageData(200, 50, true);
      const result = extractTimestamp(imageData);

      expect(result).not.toBeNull();
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    it('should return null for image without overlay', () => {
      const imageData = createMockImageData(200, 50, false);
      const result = extractTimestamp(imageData);

      expect(result).toBeNull();
    });

    it('should return null for null input', () => {
      const result = extractTimestamp(null as any);

      expect(result).toBeNull();
    });

    it('should return null for invalid ImageData', () => {
      const invalidData = { data: null, width: 200, height: 50 } as any;
      const result = extractTimestamp(invalidData);

      expect(result).toBeNull();
    });

    it('should extract timestamp close to current time', () => {
      const imageData = createMockImageData(200, 50, true);
      const beforeExtraction = Date.now();
      const result = extractTimestamp(imageData);
      const afterExtraction = Date.now();

      expect(result).not.toBeNull();
      if (result !== null) {
        // Extracted timestamp should be within a few seconds of now
        // (POC uses browser time)
        expect(result).toBeGreaterThanOrEqual(beforeExtraction - 5000);
        expect(result).toBeLessThanOrEqual(afterExtraction + 5000);
      }
    });
  });
});
