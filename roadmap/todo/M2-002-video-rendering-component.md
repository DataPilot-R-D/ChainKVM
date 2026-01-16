# M2-002: Implement Video Rendering Component

## Metadata
- **Milestone:** M2 - Web Console & WebRTC Connection
- **Component:** Web Console
- **Priority:** P0
- **Status:** Todo

## User Story

As an operator, I want to see the robot's video feed in real-time so that I can make informed decisions while controlling it.

## Requirements

### Functional Requirements
- FR-8: Display video stream from Robot Agent

### Non-Functional Requirements
- NFR-P3: Video latency < 200ms (p95)
- Smooth playback without tearing

## Definition of Done

- [ ] HTML5 video element integration
- [ ] WebRTC video track handling
- [ ] Resolution display indicator
- [ ] FPS counter display
- [ ] Full-screen mode support
- [ ] Graceful handling of stream interruption
- [ ] Unit tests for component
- [ ] Code reviewed and merged
- [ ] Tests passing

## Acceptance Tests (UAT)

### Test Case 1: Video Display
- **Preconditions:** WebRTC connection established
- **Steps:**
  1. Connect to Robot Agent
  2. Verify video appears
  3. Check video quality
- **Expected Result:** Clear video feed displayed
- **Pass Criteria:** Video renders at expected resolution

### Test Case 2: Stream Interruption
- **Preconditions:** Video streaming
- **Steps:**
  1. Simulate network interruption
  2. Observe UI behavior
  3. Restore connection
- **Expected Result:** Graceful handling, recovery
- **Pass Criteria:** User notified of issue, auto-recovery

### Test Case 3: Full-Screen Mode
- **Preconditions:** Video streaming
- **Steps:**
  1. Click full-screen button
  2. Verify video fills screen
  3. Exit full-screen
- **Expected Result:** Smooth full-screen transitions
- **Pass Criteria:** No UI glitches, controls accessible

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Browser compatibility issues | M | Test across browsers, use polyfills |
| Playback stuttering | H | Buffer management, adaptive bitrate |
| Memory leaks | M | Proper cleanup on unmount |

## Dependencies

- **Blocked by:** M2-001, M1-002, M2-004
- **Blocks:** M6-003
- **Related:** M2-008

## References

- PRD Section: 8.3 (FR-8: Video streaming)
- Design Decision: 16.10 (Video Codec Compatibility)

## Open Questions

- Picture-in-picture support needed?
- Screenshot/recording functionality?
