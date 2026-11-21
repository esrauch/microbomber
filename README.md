# microbomber

A flip-screen adventure for phones where your only tool is bombs: top-down
2.5D, built with three.js, TypeScript and Vite.

```sh
npm install
npm run dev     # http://localhost:5178
npm run check   # lint, format, typecheck, tests
```

Arrow keys or WASD to walk, Space to drop a bomb. On a phone, use the joystick
(bottom left) and the bomb button (bottom right).

## Layout

- `src/game/`: the rules and state (rooms, movement, bombs), plain data with no
  three.js, so they're tested headless.
- `src/render/`: the three.js view (one room at a time, and a fixed camera that
  frames it).
- `tests/`: Vitest tests.

Design decisions are in `GAME.md`.
