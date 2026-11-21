# Agent Guidelines (`microbomber`)

- Cap one-off CLI commands with `timeout` (e.g. `timeout --kill-after=5s 30s npx tsx ...`).
- No unbounded `while (true)` loops (ESLint enforces it): bound every search or
  simulation loop or room search and fail loudly when the bound is hit.
- Keep game logic in `src/game/` free of rendering and the DOM, so it stays testable.
- `npm run check` must pass before committing.
