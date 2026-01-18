# M1-008: Create Offline Test Harness

## Metadata
- **Milestone:** M1 - Robot Agent Video Stream & Local Control
- **Component:** Robot Agent
- **Priority:** P2
- **Status:** Todo

## User Story

As a developer, I want an offline test harness so that I can develop and test Robot Agent functionality without physical hardware.

## Requirements

### Functional Requirements
- Simulate camera input
- Simulate motor/KVM outputs
- Simulate network conditions

### Non-Functional Requirements
- Harness should not significantly slow development iteration

## Definition of Done

- [ ] Feature branch created (`feature/M1-008-offline-test-harness`)
- [ ] Virtual camera feed (test patterns, recorded video)
- [ ] Motor output verification
- [ ] KVM output verification
- [ ] Network condition simulation (latency, packet loss)
- [ ] Scriptable test scenarios
- [ ] Documentation for harness usage
- [ ] Tests passing
- [ ] PR created
- [ ] Code simplified
- [ ] PR reviewed
- [ ] Merged to main

## Acceptance Tests (UAT)

### Test Case 1: Camera Simulation
- **Preconditions:** Harness installed
- **Steps:**
  1. Configure virtual camera with test pattern
  2. Start Robot Agent with virtual camera
  3. Verify video stream output
- **Expected Result:** Video stream contains test pattern
- **Pass Criteria:** Pattern matches expected

### Test Case 2: Command Verification
- **Preconditions:** Harness with motor simulation
- **Steps:**
  1. Send drive command
  2. Check simulated motor state
- **Expected Result:** Motor state matches command
- **Pass Criteria:** Velocity and direction correct

### Test Case 3: Network Simulation
- **Preconditions:** Harness with network simulation
- **Steps:**
  1. Configure 50ms latency, 1% packet loss
  2. Run control command test
  3. Verify behavior under conditions
- **Expected Result:** System handles degraded network
- **Pass Criteria:** Graceful handling, no crashes

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Simulation differs from reality | M | Validate against real hardware periodically |
| Maintenance burden | L | Keep harness simple, document well |
| Over-reliance on simulation | M | Require hardware testing before release |

## Dependencies

- **Blocked by:** M1-002, M1-003
- **Blocks:** None
- **Related:** M1-007, M6-006

## References

- PRD Section: 7.1 (POC scope)
- Design Decision: 16.8 (Simulation Approach)

## Open Questions

- Video file format for recorded playback?
- Integration with CI for automated testing?
