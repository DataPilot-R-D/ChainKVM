# Web Console

Operator UI for ChainKVM remote robot teleoperation.

## Stack

- React 18 + TypeScript
- Vite for development/bundling
- WebRTC for video/control transport

## Development

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:3000)
npm run dev

# Type check
npm run typecheck

# Build for production
npm run build
```

## Structure

```
src/
  main.tsx    - Entry point
  App.tsx     - Root component
```

## Environment

Create `.env.local` for local overrides:

```
VITE_GATEWAY_URL=http://localhost:4000
VITE_TURN_URL=turn:localhost:3478
```
