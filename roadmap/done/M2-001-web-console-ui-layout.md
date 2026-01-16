# M2-001: Design Web Console UI Layout

## Metadata
- **Milestone:** M2 - Web Console & WebRTC Connection
- **Component:** Web Console
- **Priority:** P0
- **Status:** Done

## User Story

As an operator, I want a well-designed console interface so that I can efficiently monitor and control the robot.

## Requirements

### Functional Requirements
- Display video feed prominently
- Provide control input area
- Show session status and health indicators

### Non-Functional Requirements
- Responsive design for various screen sizes
- Accessible UI elements

## Definition of Done

- [x] UI wireframes created
- [x] Component hierarchy defined
- [x] Responsive breakpoints specified
- [x] Accessibility requirements documented
- [x] Design approved by stakeholders
- [x] Code reviewed and merged
- [x] Tests passing (20 tests)

## Implementation Notes

### Component Hierarchy
```
Layout
├── Header (banner role)
│   ├── Logo + Title
│   └── SessionStatus indicator
├── Main
│   ├── VideoPanel (video feed display)
│   └── ControlPanel (input instructions)
└── StatusBar (contentinfo role)
    ├── Latency indicator
    ├── Connection quality
    └── Control rate
```

### Responsive Breakpoints
- Mobile: < 480px (vertical stack, condensed controls)
- Tablet: 480px - 768px (vertical stack)
- Desktop: > 768px (horizontal layout for main)

### Accessibility
- Semantic HTML landmarks (banner, main, contentinfo)
- Focus-visible outlines for keyboard navigation
- Skip link support (prepared)
- ARIA labels ready for dynamic content

### Tech Stack
- React 18 + TypeScript
- Vite for build
- Vitest + Testing Library for tests
- CSS Modules pattern (component-scoped CSS)

## Acceptance Tests (UAT)

### Test Case 1: Layout Review
- **Preconditions:** Wireframes complete
- **Steps:**
  1. Review with stakeholders
  2. Validate information hierarchy
  3. Check control placement
- **Expected Result:** Layout approved
- **Pass Criteria:** Stakeholder sign-off

### Test Case 2: Responsive Behavior
- **Preconditions:** Design specifications
- **Steps:**
  1. Review at desktop size (1920x1080)
  2. Review at tablet size (1024x768)
  3. Review at mobile size (375x667)
- **Expected Result:** Usable at all sizes
- **Pass Criteria:** Critical functions accessible at all breakpoints

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Poor operator UX | H | Early user testing with mockups |
| Information overload | M | Prioritize critical info, hide secondary |
| Accessibility issues | M | Follow WCAG guidelines |

## Dependencies

- **Blocked by:** M1-001 (understand capabilities)
- **Blocks:** M2-002, M2-003, M2-007, M2-008
- **Related:** M5-009

## References

- PRD Section: 7.1 (POC scope - Web Console)
- Design Decision: 16.9 (UI Framework)

## Open Questions

- ~~Dark mode support for POC?~~ → Already dark theme by default (operator preference for low light environments)
- ~~Customizable layout preferences?~~ → Deferred to post-POC, fixed layout for MVP
