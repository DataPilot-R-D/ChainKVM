---
# Code Standards Plugin Configuration
# Generated: 2026-01-16

enabled: true
proactive_analysis: true

languages:
  - typescript
  - javascript
  - python

thresholds:
  file_loc: 250
  function_loc: 30
  complexity: 10

# Strictness level: strict
---

# Code Standards Settings

This project uses **strict** code quality thresholds.

## Configured Languages
- TypeScript/JavaScript (.ts, .tsx, .js, .jsx)
- Python (.py)

## Thresholds
| Metric | Target | Max |
|--------|--------|-----|
| File size | 200 LOC | 250 LOC |
| Function size | 25 LOC | 30 LOC |
| Cyclomatic complexity | 8 | 10 |

## Commands
- `/code-standards:check [path]` - Analyze specific files
- `/code-standards:config` - View/edit configuration
- `/code-standards:checklist` - Get review checklist
- `/code-standards:fix [path]` - Auto-refactor violations
